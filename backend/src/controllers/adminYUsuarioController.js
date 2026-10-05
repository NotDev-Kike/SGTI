const db = require('../config/db');
const { hashPassword } = require('./authController');
const emailService = require('../services/emailService');
const rolesPermitidos = ['usuario_final', 'gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'];
const consultaEntregas = `
  SELECT e.id, e.departamento_id, e.departamento_nombre, e.destinatario,
         to_char(e.fecha_entrega, 'YYYY-MM-DD') AS fecha_entrega,
         e.observaciones, e.created_at, e.entregado_por_nombre,
         COALESCE(
           json_agg(json_build_object('id', a.id, 'articulo', a.articulo, 'cantidad', a.cantidad, 'detalles', a.detalles) ORDER BY a.id)
             FILTER (WHERE a.id IS NOT NULL),
           '[]'::json
         ) AS articulos
  FROM entregas_infraestructura e
  LEFT JOIN entregas_infraestructura_articulos a ON a.entrega_id = e.id
`;

exports.listarUsuarios = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id, u.nombre, u.email, u.rol, u.departamento_id, u.activo,
             d.nombre AS departamento_nombre
      FROM usuarios u
      LEFT JOIN departamentos d ON d.id = u.departamento_id
      ORDER BY u.nombre;
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 1. GESTIÓN DE USUARIOS (Solo Admins) ---
exports.crearModificarUsuario = async (req, res) => {
  const { id, nombre, email, password, rol, departamento_id, activo } = req.body;
  try {
    if (id) {
      if (rol && !rolesPermitidos.includes(rol)) {
        return res.status(400).json({ success: false, message: 'El rol seleccionado no es válido.' });
      }
      const query = `
        UPDATE usuarios 
        SET nombre = $1, email = $2, departamento_id = $3,
            activo = COALESCE($4, activo), rol = COALESCE($5, rol)
        WHERE id = $6
        RETURNING id, nombre, email, rol, departamento_id, activo;
      `;
      const { rows } = await db.query(query, [nombre, email, departamento_id || null, activo, rol || null, id]);
      if (!rows.length) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
      return res.json({ success: true, message: 'Usuario actualizado correctamente', data: rows[0] });
    } else {
      if (!nombre?.trim() || !email?.trim() || !password || password.length < 8) {
        return res.status(400).json({ success: false, message: 'Nombre, correo y contraseña de al menos 8 caracteres son obligatorios.' });
      }
      const rolNuevo = rol || 'usuario_final';
      if (!rolesPermitidos.includes(rolNuevo)) {
        return res.status(400).json({ success: false, message: 'El rol seleccionado no es válido.' });
      }
      const query = `
        INSERT INTO usuarios (nombre, email, password, rol, departamento_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, nombre, email, rol, departamento_id, activo;
      `;
      const { rows } = await db.query(query, [nombre.trim(), email.trim().toLowerCase(), await hashPassword(password), rolNuevo, departamento_id || null]);
      return res.status(201).json({ success: true, message: 'Usuario creado exitosamente', data: rows[0] });
    }
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'Ya existe una cuenta con ese correo.' });
    res.status(500).json({ success: false, message: error.message });
  }
};

const filasComoJson = async (client, query, params) => {
  const { rows } = await client.query(query, params);
  return rows.map(row => row.registro);
};

const crearArchivoUsuario = async (client, usuario, managerId) => {
  const profile = {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    departamento_id: usuario.departamento_id,
    departamento_nombre: usuario.departamento_nombre,
    activo: usuario.activo,
    created_at: usuario.created_at
  };
  const ticketsSolicitados = await filasComoJson(client, `
    SELECT to_jsonb(t) || jsonb_build_object(
      'creador_nombre', creator.nombre,
      'departamento_destino_nombre', d.nombre
    ) AS registro
    FROM tickets t
    LEFT JOIN usuarios creator ON creator.id = t.usuario_creador_id
    LEFT JOIN departamentos d ON d.id = t.departamento_destino_id
    WHERE t.usuario_creador_id = $1
    ORDER BY t.created_at, t.id
  `, [usuario.id]);
  const ticketsAsignados = await filasComoJson(client, `
    SELECT to_jsonb(t) || jsonb_build_object(
      'creador_nombre', creator.nombre,
      'departamento_destino_nombre', d.nombre,
      'asignado_nombre', $1::text
    ) AS registro
    FROM tickets t
    LEFT JOIN usuarios creator ON creator.id = t.usuario_creador_id
    LEFT JOIN departamentos d ON d.id = t.departamento_destino_id
    WHERE t.asignado_a_id = $2 AND t.usuario_creador_id <> $2
    ORDER BY t.created_at, t.id
  `, [usuario.nombre, usuario.id]);
  const ticketIds = ticketsSolicitados.map(ticket => ticket.id);
  const historialTickets = await filasComoJson(client, `
    SELECT to_jsonb(h) || jsonb_build_object('actor_nombre', COALESCE(u.nombre, $1::text)) AS registro
    FROM ticket_historial h
    LEFT JOIN usuarios u ON u.id = h.usuario_id
    WHERE h.usuario_id = $2 OR h.ticket_id = ANY($3::int[])
    ORDER BY h.created_at, h.id
  `, [usuario.nombre, usuario.id, ticketIds]);
  const mensajesTickets = await filasComoJson(client, `
    SELECT to_jsonb(m) || jsonb_build_object('remitente_nombre', COALESCE(u.nombre, $1::text)) AS registro
    FROM mensajes_ticket m
    LEFT JOIN usuarios u ON u.id = m.remitente_id
    WHERE m.remitente_id = $2 OR m.ticket_id = ANY($3::int[])
    ORDER BY m.created_at, m.id
  `, [usuario.nombre, usuario.id, ticketIds]);
  const adjuntos = await filasComoJson(client, `
    SELECT to_jsonb(a) || jsonb_build_object('subido_por_nombre', COALESCE(u.nombre, $1::text)) AS registro
    FROM adjuntos a
    LEFT JOIN usuarios u ON u.id = a.subido_por_id
    WHERE a.subido_por_id = $2 OR a.ticket_id = ANY($3::int[])
    ORDER BY a.created_at, a.id
  `, [usuario.nombre, usuario.id, ticketIds]);
  const encuestas = await filasComoJson(client, `
    SELECT to_jsonb(e) || jsonb_build_object('ticket_titulo', t.titulo) AS registro
    FROM encuestas_satisfaccion e
    JOIN tickets t ON t.id = e.ticket_id
    WHERE e.ticket_id = ANY($1::int[])
    ORDER BY e.created_at, e.id
  `, [ticketIds]);
  const tareas = await filasComoJson(client, `
    SELECT to_jsonb(t) || jsonb_build_object(
      'asignado_nombre', COALESCE(u.nombre, $1::text),
      'ticket_titulo', tk.titulo
    ) AS registro
    FROM tareas_it t
    LEFT JOIN usuarios u ON u.id = t.asignado_a_id
    LEFT JOIN tickets tk ON tk.id = t.ticket_id
    WHERE t.asignado_a_id = $2 OR t.ticket_id = ANY($3::int[])
    ORDER BY t.fecha_limite, t.id
  `, [usuario.nombre, usuario.id, ticketIds]);
  const proyectos = await filasComoJson(client, `
    SELECT to_jsonb(p) AS registro FROM proyectos_ti p
    WHERE p.creado_por_id = $1
    ORDER BY p.created_at, p.id
  `, [usuario.id]);
  const conversacionesDirectas = await filasComoJson(client, `
    SELECT jsonb_build_object(
      'conversacion', to_jsonb(c),
      'solicitante_nombre', solicitante.nombre,
      'administrador_nombre', admin.nombre,
      'mensajes', COALESCE((
        SELECT jsonb_agg(
          to_jsonb(m) || jsonb_build_object('remitente_nombre', COALESCE(u.nombre, $1::text))
          ORDER BY m.created_at, m.id
        )
        FROM mensajes_directos m
        LEFT JOIN usuarios u ON u.id = m.remitente_id
        WHERE m.conversacion_id = c.id
      ), '[]'::jsonb)
    ) AS registro
    FROM conversaciones_directas c
    LEFT JOIN usuarios solicitante ON solicitante.id = c.solicitante_id
    LEFT JOIN usuarios admin ON admin.id = c.admin_id
    WHERE c.solicitante_id = $2 OR c.admin_id = $2
    ORDER BY c.created_at, c.id
  `, [usuario.nombre, usuario.id]);
  const entregas = await filasComoJson(client, `
    SELECT to_jsonb(e) || jsonb_build_object(
      'articulos', COALESCE((
        SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id)
        FROM entregas_infraestructura_articulos a
        WHERE a.entrega_id = e.id
      ), '[]'::jsonb)
    ) AS registro
    FROM entregas_infraestructura e
    WHERE e.entregado_por_id = $1
    ORDER BY e.fecha_entrega, e.id
  `, [usuario.id]);
  const inventarioActualizado = await filasComoJson(client, `
    SELECT to_jsonb(i) || jsonb_build_object('actualizado_por_nombre', $1::text) AS registro
    FROM inventario_departamentos i
    WHERE i.actualizado_por_id = $2
    ORDER BY i.updated_at, i.id
  `, [usuario.nombre, usuario.id]);

  const imagenesEvidencia = await filasComoJson(client, `
    SELECT jsonb_build_object(
      'id', i.id,
      'ticket_id', i.ticket_id,
      'mensaje_ticket_id', i.mensaje_ticket_id,
      'mensaje_directo_id', i.mensaje_directo_id,
      'nombre_archivo', i.nombre_archivo,
      'mime_type', i.mime_type,
      'tamano_bytes', i.tamano_bytes,
      'created_at', i.created_at
    ) AS registro
    FROM imagenes_evidencia i
    WHERE i.subido_por_id = $1
      OR i.ticket_id = ANY($2::int[])
      OR i.mensaje_directo_id IN (
        SELECT m.id
        FROM mensajes_directos m
        JOIN conversaciones_directas c ON c.id = m.conversacion_id
        WHERE c.solicitante_id = $1 OR c.admin_id = $1
      )
    ORDER BY i.created_at, i.id
  `, [usuario.id, ticketIds]);
  const activity = {
    usuario: profile,
    tickets_solicitados: ticketsSolicitados,
    tickets_asignados: ticketsAsignados,
    historial_tickets: historialTickets,
    mensajes_tickets: mensajesTickets,
    adjuntos,
    encuestas,
    tareas,
    proyectos,
    conversaciones_directas: conversacionesDirectas,
    entregas,
    inventario_actualizado: inventarioActualizado,
    imagenes_evidencia: imagenesEvidencia
  };
  const managerResult = await client.query('SELECT nombre FROM usuarios WHERE id = $1', [managerId]);
  return { profile, activity, managerName: managerResult.rows[0]?.nombre || null };
};

exports.listarUsuariosArchivados = async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, usuario_id_original, nombre, email, rol, departamento_nombre,
             eliminado_por_nombre, eliminado_en,
             jsonb_build_object(
               'tickets_solicitados', jsonb_array_length(COALESCE(actividad->'tickets_solicitados', '[]'::jsonb)),
               'tickets_asignados', jsonb_array_length(COALESCE(actividad->'tickets_asignados', '[]'::jsonb)),
               'mensajes_tickets', jsonb_array_length(COALESCE(actividad->'mensajes_tickets', '[]'::jsonb)),
               'tareas', jsonb_array_length(COALESCE(actividad->'tareas', '[]'::jsonb)),
               'proyectos', jsonb_array_length(COALESCE(actividad->'proyectos', '[]'::jsonb)),
               'conversaciones_directas', jsonb_array_length(COALESCE(actividad->'conversaciones_directas', '[]'::jsonb)),
               'imagenes_evidencia', jsonb_array_length(COALESCE(actividad->'imagenes_evidencia', '[]'::jsonb))
             ) AS resumen
      FROM usuarios_archivados
      ORDER BY eliminado_en DESC, id DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(503).json({ success: false, message: 'Aplique las migraciones 005_archived_users.sql y 006_evidence_images.sql para habilitar el archivo de evidencias.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.leerUsuarioArchivado = async (req, res) => {
  const archiveId = Number(req.params.archivoId);
  if (!Number.isInteger(archiveId) || archiveId <= 0) {
    return res.status(400).json({ success: false, message: 'El archivo seleccionado no es válido.' });
  }
  try {
    const { rows } = await db.query(`
      SELECT id, usuario_id_original, nombre, email, rol, departamento_nombre,
             eliminado_por_nombre, eliminado_en, actividad,
             COALESCE((
               SELECT json_agg(json_build_object(
                 'id', i.id,
                 'nombre_archivo', i.nombre_archivo,
                 'mime_type', i.mime_type,
                 'tamano_bytes', i.tamano_bytes,
                 'ticket_id_original', i.ticket_id_original,
                 'created_at', i.created_at
               ) ORDER BY i.id)
               FROM usuarios_archivados_imagenes i
               WHERE i.usuario_archivado_id = usuarios_archivados.id
             ), '[]'::json) AS imagenes_archivadas
      FROM usuarios_archivados
      WHERE id = $1
    `, [archiveId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Archivo de usuario no encontrado.' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    if (error.code === '42P01') {
      return res.status(503).json({ success: false, message: 'Aplique las migraciones 005_archived_users.sql y 006_evidence_images.sql para habilitar el archivo de evidencias.' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.eliminarUsuario = async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ success: false, message: 'El usuario seleccionado no es válido.' });
  }
  if (userId === Number(req.user.id)) {
    return res.status(400).json({ success: false, message: 'No puede eliminar su propia cuenta.' });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await db.connect();
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    transactionStarted = true;
    const { rows } = await client.query(`
      SELECT u.id, u.nombre, u.email, u.rol, u.departamento_id, u.activo, u.created_at,
             d.nombre AS departamento_nombre
      FROM usuarios u
      LEFT JOIN departamentos d ON d.id = u.departamento_id
      WHERE u.id = $1
      FOR UPDATE OF u
    `, [userId]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }
    const usuario = rows[0];
    const { profile, activity, managerName } = await crearArchivoUsuario(client, usuario, req.user.id);
    const archiveResult = await client.query(`
      INSERT INTO usuarios_archivados
        (usuario_id_original, nombre, email, rol, departamento_nombre, eliminado_por_id, eliminado_por_nombre, actividad)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      RETURNING id
    `, [
      userId,
      usuario.nombre,
      usuario.email,
      usuario.rol,
      usuario.departamento_nombre,
      req.user.id,
      managerName,
      JSON.stringify({ usuario: profile, ...activity })
    ]);
    await client.query(`
      INSERT INTO usuarios_archivados_imagenes
        (usuario_archivado_id, imagen_original_id, ticket_id_original, nombre_archivo, mime_type, tamano_bytes, contenido, created_at)
      SELECT $1, i.id, i.ticket_id, i.nombre_archivo, i.mime_type, i.tamano_bytes, i.contenido, i.created_at
      FROM imagenes_evidencia i
      WHERE i.subido_por_id = $2
        OR i.ticket_id = ANY($3::int[])
        OR i.mensaje_directo_id IN (
          SELECT m.id
          FROM mensajes_directos m
          JOIN conversaciones_directas c ON c.id = m.conversacion_id
          WHERE c.solicitante_id = $2 OR c.admin_id = $2
        )
    `, [archiveResult.rows[0].id, userId, activity.tickets_solicitados.map(ticket => ticket.id)]);
    await client.query('DELETE FROM tickets WHERE usuario_creador_id = $1', [userId]);
    const deletion = await client.query('DELETE FROM usuarios WHERE id = $1', [userId]);
    if (deletion.rowCount !== 1) throw new Error('La cuenta no se pudo eliminar después de archivar su información.');
    await client.query('COMMIT');
    transactionStarted = false;
    res.json({ success: true, message: 'Usuario eliminado; su perfil e historial quedaron en el archivo de usuarios.' });
  } catch (error) {
    if (transactionStarted && client) await client.query('ROLLBACK');
    if (error.code === '42P01') {
      return res.status(503).json({ success: false, message: 'Aplique las migraciones 005_archived_users.sql y 006_evidence_images.sql antes de eliminar usuarios.' });
    }
    if (error.code === '23503') {
      return res.status(409).json({
        success: false,
        message: 'No se completó el archivo ni la eliminación. Revise que la migración 005_archived_users.sql esté aplicada y vuelva a intentarlo.'
      });
    }
    if (error.code === '40001') {
      return res.status(409).json({ success: false, message: 'La actividad del usuario cambió durante el archivo. Vuelva a intentar eliminarlo.' });
    }
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
};

exports.desactivarUsuario = async (req, res) => {
  const { id } = req.params;
  if (Number(id) === Number(req.user.id)) {
    return res.status(400).json({ success: false, message: 'No puede desactivar su propia cuenta.' });
  }
  try {
    const { rowCount } = await db.query('UPDATE usuarios SET activo = FALSE WHERE id = $1 AND activo = TRUE', [id]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'Usuario no encontrado o ya está inactivo.' });
    res.json({ success: true, message: 'Usuario desactivado correctamente.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.crearCategoria = async (req, res) => {
  const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  if (!nombre) return res.status(400).json({ success: false, message: 'El nombre de la categoría es obligatorio.' });
  try {
    const { rows } = await db.query(
      'INSERT INTO categorias_ticket (nombre) VALUES ($1) RETURNING id, nombre', [nombre]
    );
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'Ya existe una categoría con ese nombre.' });
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.modificarCategoria = async (req, res) => {
  const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
  if (!nombre) return res.status(400).json({ success: false, message: 'El nombre de la categoría es obligatorio.' });
  try {
    const { rows } = await db.query(
      'UPDATE categorias_ticket SET nombre = $1 WHERE id = $2 AND activo = TRUE RETURNING id, nombre', [nombre, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Categoría no encontrada.' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'Ya existe una categoría con ese nombre.' });
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.eliminarCategoria = async (req, res) => {
  try {
    const { rowCount } = await db.query('UPDATE categorias_ticket SET activo = FALSE WHERE id = $1 AND activo = TRUE', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'Categoría no encontrada.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listarInventario = async (_req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT i.id, i.departamento_id, d.nombre AS departamento_nombre, i.nombre, i.tipo,
             i.cantidad, i.ubicacion, i.notas, i.updated_at
      FROM inventario_departamentos i
      JOIN departamentos d ON d.id = i.departamento_id
      ORDER BY d.nombre, i.tipo, i.nombre;
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.guardarActivo = async (req, res) => {
  const { id } = req.params;
  const { departamento_id, nombre, tipo, cantidad, ubicacion, notas } = req.body;
  const departmentId = Number(departamento_id);
  const quantity = Number(cantidad);
  if (!Number.isInteger(departmentId) || departmentId < 1 || !nombre?.trim() || !tipo?.trim() || !Number.isInteger(quantity) || quantity < 0) {
    return res.status(400).json({ success: false, message: 'Área, nombre, tipo y cantidad válida son obligatorios.' });
  }
  try {
    const result = id
      ? await db.query(`UPDATE inventario_departamentos SET departamento_id = $1, nombre = $2, tipo = $3, cantidad = $4, ubicacion = $5, notas = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *`, [departmentId, nombre.trim(), tipo.trim(), quantity, ubicacion?.trim() || null, notas?.trim() || null, id])
      : await db.query(`INSERT INTO inventario_departamentos (departamento_id, nombre, tipo, cantidad, ubicacion, notas, actualizado_por_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [departmentId, nombre.trim(), tipo.trim(), quantity, ubicacion?.trim() || null, notas?.trim() || null, req.user.id]);
    if (id && !result.rowCount) return res.status(404).json({ success: false, message: 'Activo no encontrado.' });
    res.status(id ? 200 : 201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.eliminarActivo = async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM inventario_departamentos WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'Activo no encontrado.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listarEntregas = async (_req, res) => {
  try {
    const { rows } = await db.query(`${consultaEntregas} GROUP BY e.id ORDER BY e.fecha_entrega DESC, e.id DESC`);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.guardarEntrega = async (req, res) => {
  const { departamento_id, destinatario, fecha_entrega, observaciones, articulos } = req.body;
  const departmentId = Number(departamento_id);
  const recipient = typeof destinatario === 'string' ? destinatario.trim() : '';
  const notes = typeof observaciones === 'string' ? observaciones.trim() : '';
  const deliveryDate = typeof fecha_entrega === 'string' ? fecha_entrega : '';
  const fecha = new Date(`${deliveryDate}T00:00:00.000Z`);
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)
    && !Number.isNaN(fecha.getTime())
    && fecha.toISOString().slice(0, 10) === deliveryDate;
  const articulosValidos = Array.isArray(articulos) && articulos.length > 0 && articulos.length <= 100
    && articulos.every(item => item && typeof item.articulo === 'string' && item.articulo.trim() && item.articulo.trim().length <= 160
      && Number.isInteger(Number(item.cantidad)) && Number(item.cantidad) > 0
      && (item.detalles == null || (typeof item.detalles === 'string' && item.detalles.length <= 1000)));

  if (!Number.isInteger(departmentId) || departmentId < 1 || !recipient || recipient.length > 160
    || !fechaValida || (typeof observaciones !== 'string' && observaciones != null) || notes.length > 3000 || !articulosValidos) {
    return res.status(400).json({ success: false, message: 'Revise departamento, destinatario, fecha y artículos de la entrega.' });
  }

  let client;
  let transactionStarted = false;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    transactionStarted = true;
    const { rows: departamentosEntrega } = await client.query('SELECT nombre FROM departamentos WHERE id = $1', [departmentId]);
    if (!departamentosEntrega.length) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(400).json({ success: false, message: 'El departamento seleccionado no existe.' });
    }
    const { rows: usuariosEntrega } = await client.query('SELECT nombre FROM usuarios WHERE id = $1', [req.user.id]);
    const { rows: entregasCreadas } = await client.query(
      `INSERT INTO entregas_infraestructura
        (departamento_id, departamento_nombre, destinatario, fecha_entrega, observaciones, entregado_por_id, entregado_por_nombre)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [departmentId, departamentosEntrega[0].nombre, recipient, deliveryDate, notes || null, req.user.id, usuariosEntrega[0]?.nombre || req.user.email]
    );
    const entregaId = entregasCreadas[0].id;
    for (const articulo of articulos) {
      await client.query(
        `INSERT INTO entregas_infraestructura_articulos (entrega_id, articulo, cantidad, detalles)
         VALUES ($1, $2, $3, $4)`,
        [entregaId, articulo.articulo.trim(), Number(articulo.cantidad), typeof articulo.detalles === 'string' ? articulo.detalles.trim() || null : null]
      );
    }
    await client.query('COMMIT');
    transactionStarted = false;
    const { rows } = await db.query(`${consultaEntregas} WHERE e.id = $1 GROUP BY e.id`, [entregaId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    if (transactionStarted && client) await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
};

exports.listarTareas = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT t.id, t.ticket_id, t.asignado_a_id, t.titulo, t.descripcion, t.estado,
             to_char(t.fecha_limite, 'YYYY-MM-DD') AS fecha_limite,
             COALESCE(u.nombre, 'Sin responsable (cuenta archivada)') AS asignado_nombre, tk.titulo AS ticket_titulo
      FROM tareas_it t
      LEFT JOIN usuarios u ON u.id = t.asignado_a_id
      LEFT JOIN tickets tk ON tk.id = t.ticket_id
      ORDER BY t.fecha_limite ASC;
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.guardarTarea = async (req, res) => {
  const { id, titulo, descripcion, asignado_a_id, ticket_id, fecha_limite, estado } = req.body;
  if (!titulo?.trim() || !fecha_limite) {
    return res.status(400).json({ success: false, message: 'El título y la fecha límite son obligatorios.' });
  }
  try {
    const result = id
      ? await db.query(`UPDATE tareas_it SET titulo = $1, descripcion = $2, asignado_a_id = $3, ticket_id = $4, fecha_limite = $5, estado = $6 WHERE id = $7 RETURNING *`, [titulo.trim(), descripcion || null, asignado_a_id || req.user.id, ticket_id || null, fecha_limite, estado || 'pendiente', id])
      : await db.query(`INSERT INTO tareas_it (titulo, descripcion, asignado_a_id, ticket_id, fecha_limite, estado) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [titulo.trim(), descripcion || null, asignado_a_id || req.user.id, ticket_id || null, fecha_limite, estado || 'pendiente']);
    if (id && !result.rowCount) return res.status(404).json({ success: false, message: 'Tarea no encontrada.' });
    res.status(id ? 200 : 201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.eliminarTarea = async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM tareas_it WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'Tarea no encontrada.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listarProyectos = async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT p.*, COALESCE(u.nombre, 'Usuario archivado') AS creador_nombre FROM proyectos_ti p LEFT JOIN usuarios u ON u.id = p.creado_por_id ORDER BY p.created_at DESC`);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.gestionarProyectoTI = async (req, res) => {
  const { id, titulo, descripcion, estado } = req.body;
  try {
    const result = id
      ? await db.query('UPDATE proyectos_ti SET titulo = $1, descripcion = $2, estado = $3 WHERE id = $4 RETURNING *', [titulo, descripcion || null, estado || 'planificacion', id])
      : await db.query('INSERT INTO proyectos_ti (titulo, descripcion, creado_por_id, estado) VALUES ($1, $2, $3, $4) RETURNING *', [titulo, descripcion || null, req.user.id, estado || 'planificacion']);
    if (id && !result.rowCount) return res.status(404).json({ success: false, message: 'Proyecto no encontrado.' });
    res.status(id ? 200 : 201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.eliminarProyectoTI = async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM proyectos_ti WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'Proyecto no encontrado.' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.leerConfiguracion = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT clave, valor FROM configuraciones ORDER BY clave');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.guardarConfiguracion = async (req, res) => {
  const settings = req.body;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return res.status(400).json({ success: false, message: 'Configuración inválida.' });
  }
  if (Object.prototype.hasOwnProperty.call(settings, 'alertas_destinatarios')) {
    const inputRecipients = String(settings.alertas_destinatarios || '').split(/[\s,;]+/).filter(Boolean);
    const recipients = emailService.parseRecipients(settings.alertas_destinatarios);
    if (inputRecipients.some(email => !emailService.EMAIL_PATTERN.test(email)) || recipients.length > 25) {
      return res.status(400).json({ success: false, message: 'Revise los correos; se permiten hasta 25 direcciones válidas.' });
    }
    settings.alertas_destinatarios = recipients.join(',');
  }
  let client;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(settings)) {
      await client.query(`
        INSERT INTO configuraciones (clave, valor) VALUES ($1, $2)
        ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = CURRENT_TIMESTAMP;
      `, [key, String(value)]);
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
};

exports.estadoCorreo = async (_req, res) => {
  try {
    res.json({ success: true, data: await emailService.getEmailStatus() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.enviarCorreoPrueba = async (_req, res) => {
  try {
    const destinatarios = await emailService.enviarCorreoPrueba();
    res.json({ success: true, message: `Correo de prueba enviado a ${destinatarios} destinatario(s).` });
  } catch (error) {
    res.status(502).json({ success: false, message: error.message });
  }
};

exports.listarCalendario = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, titulo, to_char(fecha_limite, 'YYYY-MM-DD') AS fecha, 'ticket' AS tipo, estado
      FROM tickets WHERE estado <> 'resuelto'
      UNION ALL
      SELECT id, titulo, to_char(fecha_limite, 'YYYY-MM-DD') AS fecha, 'tarea' AS tipo, estado
      FROM tareas_it t
      WHERE t.ticket_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM tickets tk WHERE tk.id = t.ticket_id AND tk.estado = 'resuelto'
      )
      ORDER BY fecha ASC;
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 2. TICKETS Y SEMÁFORO CRÍTICO ---
exports.listarTicketsAdmin = async (req, res) => {
  try {
    // Lista tickets activos (no resueltos) ordenados por fecha de creación y semáforo crítico
    const query = `
      SELECT t.*,
      to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at_local,
      u.nombre as creador_nombre, d.nombre as departamento_nombre,
      u_asig.nombre AS asignado_nombre,
      CASE
        WHEN t.fecha_limite IS NULL THEN 'sin_fecha'
        WHEN t.fecha_limite <= NOW() THEN 'vencido'
        WHEN t.fecha_limite <= NOW() + INTERVAL '24 hours' THEN 'por_vencer'
        ELSE 'en_plazo'
      END AS semaforo_alerta
      FROM tickets t
      JOIN usuarios u ON t.usuario_creador_id = u.id
      JOIN departamentos d ON t.departamento_destino_id = d.id
      LEFT JOIN usuarios u_asig ON u_asig.id = t.asignado_a_id
      WHERE t.estado != 'resuelto'
      ORDER BY t.fecha_limite ASC NULLS LAST, t.created_at ASC;
    `;
    const { rows } = await db.query(query);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listarEficienciaAdmins = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT u.id, u.nombre, d.nombre AS departamento_nombre,
             COUNT(t.id)::int AS total_asignados,
             COUNT(t.id) FILTER (WHERE t.estado = 'resuelto')::int AS resueltos,
             COUNT(t.id) FILTER (WHERE t.estado <> 'resuelto')::int AS pendientes,
             COUNT(t.id) FILTER (WHERE t.estado <> 'resuelto' AND t.fecha_limite < NOW())::int AS vencidos,
             CASE WHEN COUNT(t.id) = 0 THEN 0
                  ELSE ROUND(100.0 * COUNT(t.id) FILTER (WHERE t.estado = 'resuelto') / COUNT(t.id), 1)
             END AS tasa_resolucion
      FROM usuarios u
      LEFT JOIN departamentos d ON d.id = u.departamento_id
      LEFT JOIN tickets t ON t.asignado_a_id = u.id
      WHERE u.activo = TRUE
        AND u.rol = ANY($1::text[])
      GROUP BY u.id, u.nombre, d.nombre
      ORDER BY d.nombre, u.nombre;
    `, [['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo']]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.moverOResolverTicket = async (req, res) => {
  const { id } = req.params;
  const { nuevo_estado, nuevo_departamento_id, titulo, descripcion, categoria, tipo_solicitud, prioridad, asignado_a_id, auto_asignar, accion_historial } = req.body;
  if (req.user.rol !== 'gerente_it' && (nuevo_departamento_id !== undefined && nuevo_departamento_id !== null || asignado_a_id !== undefined || auto_asignar)) {
    return res.status(403).json({ success: false, message: 'Solo el gerente de IT puede reasignar tickets.' });
  }
  const estadosPermitidos = ['nuevo', 'abierto', 'en_proceso', 'resuelto', 'vencido'];
  if (nuevo_estado && !estadosPermitidos.includes(nuevo_estado)) {
    return res.status(400).json({ success: false, message: `Estado inválido. Use: ${estadosPermitidos.join(', ')}.` });
  }

  try {
    let asignadoId = null;
    if (auto_asignar) {
      const departamentoId = Number(nuevo_departamento_id);
      if (!Number.isInteger(departamentoId) || departamentoId <= 0) {
        return res.status(400).json({ success: false, message: 'El área seleccionada no es válida.' });
      }
      const adminRoles = ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'];
      const { rows: admins } = await db.query(`
        SELECT id FROM usuarios
        WHERE activo = TRUE AND departamento_id = $1 AND rol = ANY($2::text[])
        ORDER BY CASE WHEN rol = 'gerente_it' THEN 0 ELSE 1 END, id
        LIMIT 1;
      `, [departamentoId, adminRoles]);
      if (!admins.length) {
        return res.status(400).json({ success: false, message: 'No hay un administrador activo asignado a esa área.' });
      }
      asignadoId = admins[0].id;
    } else if (asignado_a_id !== undefined && asignado_a_id !== null && asignado_a_id !== '') {
      asignadoId = Number(asignado_a_id);
      if (!Number.isInteger(asignadoId) || asignadoId <= 0) {
        return res.status(400).json({ success: false, message: 'El administrador asignado no es válido.' });
      }
      const adminRoles = ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'];
      const admin = await db.query(
        'SELECT id, departamento_id FROM usuarios WHERE id = $1 AND activo = TRUE AND rol = ANY($2::text[])',
        [asignadoId, adminRoles]
      );
      if (!admin.rowCount) {
        return res.status(400).json({ success: false, message: 'Seleccione un administrador activo de IT.' });
      }
      if (nuevo_departamento_id !== undefined && Number(admin.rows[0].departamento_id) !== Number(nuevo_departamento_id)) {
        return res.status(400).json({ success: false, message: 'El administrador debe pertenecer al área seleccionada.' });
      }
    }

    const query = `
      UPDATE tickets 
      SET estado = COALESCE($1, estado), 
          departamento_destino_id = COALESCE($2, departamento_destino_id),
          titulo = COALESCE($3, titulo),
          descripcion = COALESCE($4, descripcion),
          categoria = COALESCE($5, categoria),
          tipo_solicitud = COALESCE($6, tipo_solicitud),
            prioridad = COALESCE($7, prioridad),
            asignado_a_id = COALESCE($9, asignado_a_id),
          fecha_resolucion = CASE WHEN $1 = 'resuelto' THEN CURRENT_TIMESTAMP ELSE fecha_resolucion END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 RETURNING *;
    `;
        const { rows } = await db.query(query, [nuevo_estado, nuevo_departamento_id, titulo, descripcion, categoria, tipo_solicitud, prioridad, id, asignadoId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Ticket no encontrado.' });

    // Registrar en historial para que al resolverse desaparezca de "TODOS" activos pero quede en Auditoría
    await db.query(
      `INSERT INTO ticket_historial (ticket_id, usuario_id, accion) VALUES ($1, $2, $3)`,
        [id, req.user.id, accion_historial || (asignadoId ? `Asignó el ticket al administrador ID: ${asignadoId}` : 'Modificó o movió el ticket')]
    );

    res.json({ success: true, message: 'Ticket actualizado y movido con éxito', data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.actualizarSeguimientoTicket = async (req, res) => {
  const ticketId = Number(req.params.id);
  const resuelto = req.body.resuelto === true;
  const causaExterna = req.body.causa_externa === true;
  const mensaje = typeof req.body.mensaje === 'string' ? req.body.mensaje.trim() : '';
  const fechaEstimada = req.body.fecha_estimada_resolucion || null;

  if (!mensaje) {
    return res.status(400).json({ success: false, message: 'Escriba una actualización para el solicitante.' });
  }
  if (fechaEstimada && Number.isNaN(Date.parse(fechaEstimada))) {
    return res.status(400).json({ success: false, message: 'La fecha estimada no es válida.' });
  }

  let client;
  try {
    client = await db.connect();
    await client.query('BEGIN');
    const ticketResult = await client.query('SELECT id, asignado_a_id FROM tickets WHERE id = $1 FOR UPDATE', [ticketId]);
    if (!ticketResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Ticket no encontrado.' });
    }
    const esGerente = req.user.rol === 'gerente_it';
    if (!esGerente && Number(ticketResult.rows[0].asignado_a_id) !== Number(req.user.id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, message: 'Solo el responsable asignado puede actualizar este ticket.' });
    }

    const { rows } = await client.query(`
      UPDATE tickets
      SET estado = CASE WHEN $1 THEN 'resuelto' ELSE 'en_proceso' END,
          fecha_resolucion = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE NULL END,
          fecha_estimada_resolucion = CASE WHEN $1 THEN NULL ELSE $2::timestamp END,
          causa_externa = CASE WHEN $1 THEN FALSE ELSE $3 END,
          actualizacion_publica = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *;
    `, [resuelto, fechaEstimada, causaExterna, mensaje, ticketId]);

    const tipoAccion = resuelto ? 'Resolución' : causaExterna ? 'Bloqueo externo' : 'Seguimiento';
    const accion = `${tipoAccion}: ${mensaje}${!resuelto && fechaEstimada ? ` (fecha estimada: ${fechaEstimada})` : ''}`;
    await client.query(
      'INSERT INTO ticket_historial (ticket_id, usuario_id, accion) VALUES ($1, $2, $3)',
      [ticketId, req.user.id, accion]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: resuelto ? 'Ticket resuelto y actualizado.' : 'Seguimiento enviado al solicitante.', data: rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK');
    res.status(500).json({ success: false, message: error.message });
  } finally {
    if (client) client.release();
  }
};
