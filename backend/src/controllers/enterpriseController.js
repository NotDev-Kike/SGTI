const db = require('../config/db');
const crypto = require('crypto');
const { registrarEvento } = require('../services/auditService');
const microsoft = require('../services/microsoftService');
const { rolesParaDepartamento } = require('../services/ticketAccessService');

const adminRoles = ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'];
const routeByCategory = {
  hardware: 'admin_infra', infraestructura: 'admin_infra', software: 'admin_desarrollo', desarrollo: 'admin_desarrollo',
  redes: 'admin_infra', gps: 'admin_gps', 'gps / rutas': 'admin_gps'
};

async function assignTicket(client, ticketId, categoria, departamentoId) {
  const role = routeByCategory[String(categoria || '').toLowerCase()];
  // Si la categoría no es reconocible, el gerente recibe el caso para clasificarlo.
  const targetRole = role || 'gerente_it';
  const departmentResult = await client.query('SELECT nombre FROM departamentos WHERE id=$1', [departamentoId]);
  const rolesDepartamento = rolesParaDepartamento(departmentResult.rows[0]?.nombre);
  const result = await client.query(`SELECT u.id FROM usuarios u
    WHERE u.activo = TRUE AND u.rol = ANY($2::text[])
      AND (u.departamento_id = $1 OR u.rol = ANY($4::text[]))
    ORDER BY CASE WHEN u.departamento_id = $1 THEN 0 ELSE 1 END,
             CASE WHEN u.rol = $3 THEN 0 WHEN u.rol = 'gerente_it' THEN 1 ELSE 2 END, u.nombre, u.id LIMIT 1`, [departamentoId, adminRoles, targetRole, rolesDepartamento]);
  const assigned = result.rows[0]?.id || null;
  if (assigned) await client.query(`UPDATE tickets SET asignado_a_id=$1, asignacion_automatica=TRUE WHERE id=$2`, [assigned, ticketId]);
  return assigned;
}

exports.assignTicket = assignTicket;

exports.listarSla = async (_req, res) => {
  const { rows } = await db.query('SELECT * FROM sla_politicas WHERE activo=TRUE ORDER BY horas_resolucion');
  res.json({ success: true, data: rows });
};

exports.guardarSla = async (req, res) => {
  const { id, nombre, prioridad, categoria, horas_respuesta, horas_resolucion, activo = true } = req.body;
  if (!nombre || !prioridad || !Number(horas_resolucion)) return res.status(400).json({ success: false, message: 'Nombre, prioridad y horas de resolución son obligatorios.' });
  const { rows } = await db.query(`INSERT INTO sla_politicas (id,nombre,prioridad,categoria,horas_respuesta,horas_resolucion,activo)
    VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET nombre=EXCLUDED.nombre, prioridad=EXCLUDED.prioridad, categoria=EXCLUDED.categoria, horas_respuesta=EXCLUDED.horas_respuesta, horas_resolucion=EXCLUDED.horas_resolucion, activo=EXCLUDED.activo RETURNING *`, [id || null, nombre.trim(), prioridad, categoria || null, Number(horas_respuesta || 1), Number(horas_resolucion), activo]);
  await registrarEvento({ req, evento: 'sla.actualizado', entidad: 'sla_politica', entidadId: rows[0].id, detalle: req.body });
  res.json({ success: true, data: rows[0] });
};

exports.listarAuditoria = async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const { rows } = await db.query(`
    WITH eventos AS (
      SELECT a.*, ROW_NUMBER() OVER (
        PARTITION BY a.usuario_id, a.evento, a.entidad, a.entidad_id, a.detalle, DATE_TRUNC('second', a.created_at)
        ORDER BY a.id DESC
      ) AS repetido
      FROM auditoria_eventos a
    )
    SELECT e.*, u.nombre AS usuario_nombre, u.email
    FROM eventos e
    LEFT JOIN usuarios u ON u.id=e.usuario_id
    WHERE e.repetido=1
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT $1`, [limit]);
  res.json({ success: true, data: rows });
};

exports.listarActivos = async (_req, res) => {
  const { rows } = await db.query(`SELECT a.id, a.codigo, a.nombre, a.tipo, a.marca, a.modelo, a.serie, a.departamento_id, a.responsable_id, a.estado, a.motivo_baja, a.fecha_compra, a.fecha_asignacion, a.fecha_baja, a.vida_util_anios, a.orden_compra, a.garantia_hasta, a.garantia_nombre, a.fotografias, a.notas, a.created_at, a.updated_at, d.nombre AS departamento_nombre, u.nombre AS responsable_nombre FROM activos a LEFT JOIN departamentos d ON d.id=a.departamento_id LEFT JOIN usuarios u ON u.id=a.responsable_id ORDER BY a.updated_at DESC`);
  res.json({ success: true, data: rows });
};

exports.guardarActivo = async (req, res) => {
  const b = req.body;
  if (!b.codigo || !b.nombre || !b.tipo) return res.status(400).json({ success: false, message: 'Código, nombre y tipo son obligatorios.' });
  if ((b.estado || 'disponible') === 'asignado' && (!b.departamento_id || !b.responsable_id)) return res.status(400).json({ success: false, message: 'Un activo asignado debe tener departamento y responsable.' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const old = b.id ? await client.query('SELECT * FROM activos WHERE id=$1 FOR UPDATE', [b.id]) : { rows: [] };
    const { rows } = await client.query(`INSERT INTO activos (id,codigo,nombre,tipo,marca,modelo,serie,departamento_id,responsable_id,estado,motivo_baja,fecha_compra,fecha_asignacion,fecha_baja,vida_util_anios,orden_compra,garantia_hasta,notas)
      VALUES (COALESCE($1, (SELECT COALESCE(MAX(id), 0) + 1 FROM activos)),$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO UPDATE SET codigo=EXCLUDED.codigo,nombre=EXCLUDED.nombre,tipo=EXCLUDED.tipo,marca=EXCLUDED.marca,modelo=EXCLUDED.modelo,serie=EXCLUDED.serie,departamento_id=EXCLUDED.departamento_id,responsable_id=EXCLUDED.responsable_id,estado=EXCLUDED.estado,motivo_baja=EXCLUDED.motivo_baja,fecha_compra=EXCLUDED.fecha_compra,fecha_asignacion=EXCLUDED.fecha_asignacion,fecha_baja=EXCLUDED.fecha_baja,vida_util_anios=EXCLUDED.vida_util_anios,orden_compra=EXCLUDED.orden_compra,garantia_hasta=EXCLUDED.garantia_hasta,notas=EXCLUDED.notas,updated_at=CURRENT_TIMESTAMP RETURNING *`, [b.id || null,b.codigo.trim(),b.nombre.trim(),b.tipo,b.marca||null,b.modelo||null,b.serie||null,b.departamento_id||null,b.responsable_id||null,b.estado||'disponible',b.motivo_baja||null,b.fecha_compra||null,b.fecha_asignacion||null,b.fecha_baja||null,b.vida_util_anios||null,b.orden_compra||null,b.garantia_hasta||null,b.notas||null]);
    const current = rows[0];
    await client.query(`INSERT INTO activos_historial (activo_id,usuario_id,accion,departamento_anterior_id,departamento_nuevo_id,responsable_anterior_id,responsable_nuevo_id,nota) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [current.id,req.user.id,b.id ? 'actualización' : 'alta',old.rows[0]?.departamento_id||null,current.departamento_id,old.rows[0]?.responsable_id||null,current.responsable_id,b.nota||b.motivo_baja||null]);
    await client.query('COMMIT');
    await registrarEvento({ req, evento: b.id ? 'activo.actualizado' : 'activo.creado', entidad: 'activo', entidadId: current.id, detalle: { estado: current.estado } });
    res.json({ success: true, data: current });
  } catch (error) { await client.query('ROLLBACK'); res.status(400).json({ success: false, message: error.message }); } finally { client.release(); }
};

exports.historialActivo = async (req, res) => { const { rows } = await db.query(`SELECT h.*, u.nombre AS usuario_nombre FROM activos_historial h LEFT JOIN usuarios u ON u.id=h.usuario_id WHERE activo_id=$1 ORDER BY created_at DESC`, [req.params.id]); res.json({ success: true, data: rows }); };
exports.transferirActivo = async (req, res) => {
  const { departamento_id, responsable_id, nota } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const old = await client.query('SELECT * FROM activos WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!old.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Activo no encontrado.' }); }
    await client.query('UPDATE activos SET departamento_id=$1,responsable_id=$2,fecha_asignacion=CURRENT_DATE,estado=\'asignado\',updated_at=CURRENT_TIMESTAMP WHERE id=$3', [departamento_id || null, responsable_id || null, req.params.id]);
    await client.query(`INSERT INTO activos_historial (activo_id,usuario_id,accion,departamento_anterior_id,departamento_nuevo_id,responsable_anterior_id,responsable_nuevo_id,nota) VALUES($1,$2,'transferencia',$3,$4,$5,$6,$7)`, [req.params.id, req.user.id, old.rows[0].departamento_id, departamento_id || null, old.rows[0].responsable_id, responsable_id || null, nota || 'Transferencia de departamento/responsable']);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Transferencia registrada.' });
  } catch (error) { await client.query('ROLLBACK'); res.status(400).json({ success: false, message: error.message }); } finally { client.release(); }
};
exports.subirGarantia = async (req, res) => { if (!req.file) return res.status(400).json({ success: false, message: 'Adjunte el archivo de garantía.' }); const { rows } = await db.query('UPDATE activos SET garantia_archivo=$1, garantia_nombre=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING id, garantia_nombre', [req.file.buffer, req.file.originalname, req.params.id]); if (!rows.length) return res.status(404).json({ success: false, message: 'Activo no encontrado.' }); await db.query('INSERT INTO activos_historial (activo_id,usuario_id,accion,nota) VALUES ($1,$2,$3,$4)', [req.params.id, req.user.id, 'garantia_adjunta', req.file.originalname]); res.json({ success: true, data: rows[0] }); };
exports.descargarGarantia = async (req, res) => { const { rows } = await db.query('SELECT garantia_archivo, garantia_nombre FROM activos WHERE id=$1', [req.params.id]); if (!rows.length || !rows[0].garantia_archivo) return res.status(404).json({ success: false, message: 'El activo no tiene una garantía adjunta.' }); const nombre = String(rows[0].garantia_nombre || 'garantia').replace(/"/g, ''); const extension = nombre.split('.').pop().toLowerCase(); const tipos = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }; res.type(tipos[extension] || 'application/octet-stream').set('Content-Disposition', `${req.query.inline === 'true' ? 'inline' : 'attachment'}; filename="${nombre}"`).send(rows[0].garantia_archivo); };
exports.subirFotografia = async (req, res) => {
  if (!req.file || !String(req.file.mimetype || '').startsWith('image/')) return res.status(400).json({ success: false, message: 'Adjunte una imagen válida.' });
  if (req.file.size > 8 * 1024 * 1024) return res.status(400).json({ success: false, message: 'La fotografía no puede superar 8 MB.' });
  const { rows } = await db.query('SELECT fotografias FROM activos WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'Activo no encontrado.' });
  const fotografias = Array.isArray(rows[0].fotografias) ? rows[0].fotografias : [];
  if (fotografias.length >= 12) return res.status(400).json({ success: false, message: 'Un activo puede tener hasta 12 fotografías.' });
  const fotografia = { id: crypto.randomUUID(), nombre: req.file.originalname, mime_type: req.file.mimetype, contenido: req.file.buffer.toString('base64'), created_at: new Date().toISOString() };
  fotografias.push(fotografia);
  await db.query('UPDATE activos SET fotografias=$1::jsonb, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [JSON.stringify(fotografias), req.params.id]);
  await db.query('INSERT INTO activos_historial (activo_id,usuario_id,accion,nota) VALUES ($1,$2,$3,$4)', [req.params.id, req.user.id, 'fotografia_agregada', req.file.originalname]);
  res.status(201).json({ success: true, data: fotografia });
};
exports.eliminarFotografia = async (req, res) => {
  const { rows } = await db.query('SELECT fotografias FROM activos WHERE id=$1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ success: false, message: 'Activo no encontrado.' });
  const fotografias = Array.isArray(rows[0].fotografias) ? rows[0].fotografias : [];
  const restantes = fotografias.filter(fotografia => fotografia.id !== req.params.fotografiaId);
  if (restantes.length === fotografias.length) return res.status(404).json({ success: false, message: 'Fotografía no encontrada.' });
  await db.query('UPDATE activos SET fotografias=$1::jsonb, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [JSON.stringify(restantes), req.params.id]);
  await db.query('INSERT INTO activos_historial (activo_id,usuario_id,accion,nota) VALUES ($1,$2,$3,$4)', [req.params.id, req.user.id, 'fotografia_eliminada', req.params.fotografiaId]);
  res.json({ success: true });
};

exports.crearSolicitudMicrosoft = async (req, res) => { const b=req.body; if(!b.nombre) return res.status(400).json({success:false,message:'El nombre es obligatorio.'}); const {rows}=await db.query(`INSERT INTO solicitudes_microsoft (solicitado_por_id,tipo,nombre,correo_solicitado,departamento,detalle) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[req.user.id,b.tipo||'crear_usuario',b.nombre,b.correo_solicitado||null,b.departamento||null,b.detalle||null]); await registrarEvento({req,evento:'microsoft.solicitud_creada',entidad:'solicitud_microsoft',entidadId:rows[0].id}); const managers = await db.query("SELECT email FROM usuarios WHERE rol='gerente_it' AND activo=TRUE"); managers.rows.forEach(manager => microsoft.notifyTicket(rows[0], manager.email, 'Solicitud de creación de usuario Microsoft', `<p>Se solicitó crear la cuenta Microsoft de <strong>${String(b.nombre).replace(/[<>]/g, '')}</strong>.</p>`).catch(error => console.error('Aviso de solicitud Microsoft:', error.message))); res.status(201).json({success:true,data:rows[0]}); };
exports.listarSolicitudesMicrosoft = async (_req,res) => { const {rows}=await db.query(`SELECT s.*, u.nombre AS solicitante_nombre FROM solicitudes_microsoft s LEFT JOIN usuarios u ON u.id=s.solicitado_por_id ORDER BY s.created_at DESC`); res.json({success:true,data:rows}); };
exports.actualizarSolicitudMicrosoft = async (req, res) => {
  const estado = String(req.body.estado || '').toLowerCase();
  if (!['aprobada', 'rechazada'].includes(estado)) return res.status(400).json({ success: false, message: 'El estado debe ser aprobada o rechazada.' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const solicitud = await client.query('SELECT * FROM solicitudes_microsoft WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!solicitud.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' }); }
    const actual = solicitud.rows[0];
    if (estado === 'aprobada' && actual.correo_solicitado) {
      const correo = actual.correo_solicitado.trim().toLowerCase();
      await client.query(`INSERT INTO usuarios (nombre,email,password,rol,activo)
        VALUES ($1,$2,$3,'usuario_final',TRUE)
        ON CONFLICT (email) DO UPDATE SET activo=TRUE`, [actual.nombre, correo, `microsoft$${crypto.randomBytes(32).toString('hex')}`]);
    }
    const { rows } = await client.query(`UPDATE solicitudes_microsoft SET estado=$1, atendido_por_id=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING *`, [estado, req.user.id, req.params.id]);
    await client.query('COMMIT');
    await registrarEvento({ req, evento: `microsoft.solicitud_${estado}`, entidad: 'solicitud_microsoft', entidadId: Number(req.params.id), detalle: { correo: actual.correo_solicitado, estado } });
    res.json({ success: true, data: rows[0] });
  } catch (error) { await client.query('ROLLBACK'); res.status(400).json({ success: false, message: error.message }); } finally { client.release(); }
};
exports.listarSesiones = async (_req,res) => {
  const { rows } = await db.query(`
    WITH sesiones AS (SELECT
      s.id, s.usuario_id, s.ip, s.user_agent,
      s.created_at AS entrada_en,
      CASE WHEN s.conectado AND s.ultima_actividad >= CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN NULL ELSE s.ultima_actividad END AS salida_en,
      s.ultima_actividad,
      CASE WHEN s.conectado AND s.ultima_actividad >= CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN TRUE ELSE FALSE END AS conectado,
      EXTRACT(EPOCH FROM ((CASE WHEN s.conectado AND s.ultima_actividad >= CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN CURRENT_TIMESTAMP ELSE s.ultima_actividad END) - s.created_at))::bigint AS duracion_segundos,
      u.nombre, u.email,
      ROW_NUMBER() OVER (PARTITION BY s.usuario_id ORDER BY CASE WHEN s.conectado AND s.ultima_actividad >= CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN 0 ELSE 1 END, s.created_at DESC, s.id DESC) AS prioridad
    FROM sesiones_usuario s JOIN usuarios u ON u.id = s.usuario_id)
    SELECT id, usuario_id, ip, user_agent, entrada_en, salida_en, ultima_actividad, conectado, duracion_segundos, nombre, email
    FROM sesiones WHERE prioridad=1
    ORDER BY conectado DESC, ultima_actividad DESC
  `);
  res.json({ success: true, data: rows });
};
