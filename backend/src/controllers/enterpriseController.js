const db = require('../config/db');
const { registrarEvento } = require('../services/auditService');
const microsoft = require('../services/microsoftService');

const adminRoles = ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'];
const routeByCategory = {
  hardware: 'admin_infra', infraestructura: 'admin_infra', software: 'admin_desarrollo', desarrollo: 'admin_desarrollo',
  redes: 'admin_infra', gps: 'admin_gps', 'gps / rutas': 'admin_gps'
};

async function assignTicket(client, ticketId, categoria, departamentoId) {
  const role = routeByCategory[String(categoria || '').toLowerCase()];
  // Si la categoría no es reconocible, el gerente recibe el caso para clasificarlo.
  const targetRole = role || 'gerente_it';
  const result = await client.query(`SELECT u.id FROM usuarios u LEFT JOIN departamentos d ON d.id = u.departamento_id
    WHERE u.activo = TRUE AND u.rol = ANY($1::text[]) AND (u.rol = $2 OR (u.rol = 'gerente_it' AND $2 <> 'gerente_it'))
    ORDER BY CASE WHEN u.rol = $2 THEN 0 ELSE 1 END, u.id LIMIT 1`, [adminRoles, targetRole]);
  const assigned = result.rows[0]?.id || null;
  if (assigned) await client.query(`UPDATE tickets SET asignado_a_id=$1, asignacion_automatica=TRUE, estado=CASE WHEN estado='nuevo' THEN 'en_proceso' ELSE estado END WHERE id=$2`, [assigned, ticketId]);
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
  const { rows } = await db.query(`SELECT a.*, u.nombre AS usuario_nombre, u.email FROM auditoria_eventos a LEFT JOIN usuarios u ON u.id=a.usuario_id ORDER BY a.created_at DESC LIMIT $1`, [limit]);
  res.json({ success: true, data: rows });
};

exports.listarActivos = async (_req, res) => {
  const { rows } = await db.query(`SELECT a.*, d.nombre AS departamento_nombre, u.nombre AS responsable_nombre FROM activos a LEFT JOIN departamentos d ON d.id=a.departamento_id LEFT JOIN usuarios u ON u.id=a.responsable_id ORDER BY a.updated_at DESC`);
  res.json({ success: true, data: rows });
};

exports.guardarActivo = async (req, res) => {
  const b = req.body;
  if (!b.codigo || !b.nombre || !b.tipo) return res.status(400).json({ success: false, message: 'Código, nombre y tipo son obligatorios.' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const old = b.id ? await client.query('SELECT * FROM activos WHERE id=$1 FOR UPDATE', [b.id]) : { rows: [] };
    const { rows } = await client.query(`INSERT INTO activos (id,codigo,nombre,tipo,marca,modelo,serie,departamento_id,responsable_id,estado,motivo_baja,fecha_compra,fecha_asignacion,fecha_baja,vida_util_anios,orden_compra,garantia_hasta,notas)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
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
exports.subirGarantia = async (req, res) => { if (!req.file) return res.status(400).json({ success: false, message: 'Adjunte el archivo de garantía.' }); const { rows } = await db.query('UPDATE activos SET garantia_archivo=$1, garantia_nombre=$2, updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING id, garantia_nombre', [req.file.buffer, req.file.originalname, req.params.id]); if (!rows.length) return res.status(404).json({ success: false, message: 'Activo no encontrado.' }); res.json({ success: true, data: rows[0] }); };
exports.descargarGarantia = async (req, res) => { const { rows } = await db.query('SELECT garantia_archivo, garantia_nombre FROM activos WHERE id=$1', [req.params.id]); if (!rows.length || !rows[0].garantia_archivo) return res.status(404).end(); res.set('Content-Disposition', `attachment; filename="${String(rows[0].garantia_nombre || 'garantia').replace(/"/g, '')}"`).send(rows[0].garantia_archivo); };

exports.crearSolicitudMicrosoft = async (req, res) => { const b=req.body; if(!b.nombre) return res.status(400).json({success:false,message:'El nombre es obligatorio.'}); const {rows}=await db.query(`INSERT INTO solicitudes_microsoft (solicitado_por_id,tipo,nombre,correo_solicitado,departamento,detalle) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,[req.user.id,b.tipo||'crear_usuario',b.nombre,b.correo_solicitado||null,b.departamento||null,b.detalle||null]); await registrarEvento({req,evento:'microsoft.solicitud_creada',entidad:'solicitud_microsoft',entidadId:rows[0].id}); const managers = await db.query("SELECT email FROM usuarios WHERE rol='gerente_it' AND activo=TRUE"); managers.rows.forEach(manager => microsoft.notifyTicket(rows[0], manager.email, 'Solicitud de creación de usuario Microsoft', `<p>Se solicitó crear la cuenta Microsoft de <strong>${String(b.nombre).replace(/[<>]/g, '')}</strong>.</p>`).catch(error => console.error('Aviso de solicitud Microsoft:', error.message))); res.status(201).json({success:true,data:rows[0]}); };
exports.listarSolicitudesMicrosoft = async (_req,res) => { const {rows}=await db.query(`SELECT s.*, u.nombre AS solicitante_nombre FROM solicitudes_microsoft s LEFT JOIN usuarios u ON u.id=s.solicitado_por_id ORDER BY s.created_at DESC`); res.json({success:true,data:rows}); };
exports.listarSesiones = async (_req,res) => { const {rows}=await db.query(`SELECT s.*,u.nombre,u.email FROM sesiones_usuario s JOIN usuarios u ON u.id=s.usuario_id WHERE s.conectado=TRUE ORDER BY s.ultima_actividad DESC`); res.json({success:true,data:rows}); };
