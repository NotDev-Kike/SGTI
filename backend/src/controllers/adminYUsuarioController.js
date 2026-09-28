const db = require('../config/db');
const { hashPassword } = require('./authController');
const rolesPermitidos = ['usuario_final', 'gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'];

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

exports.eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  if (Number(id) === Number(req.user.id)) {
    return res.status(400).json({ success: false, message: 'No puede eliminar su propia cuenta.' });
  }
  try {
    const { rowCount } = await db.query('UPDATE usuarios SET activo = FALSE WHERE id = $1 AND activo = TRUE', [id]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    res.json({ success: true, message: 'Usuario eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.listarTareas = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT t.id, t.ticket_id, t.asignado_a_id, t.titulo, t.descripcion, t.estado,
             to_char(t.fecha_limite, 'YYYY-MM-DD') AS fecha_limite,
             u.nombre AS asignado_nombre, tk.titulo AS ticket_titulo
      FROM tareas_it t
      JOIN usuarios u ON u.id = t.asignado_a_id
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
    const { rows } = await db.query(`SELECT p.*, u.nombre AS creador_nombre FROM proyectos_ti p JOIN usuarios u ON u.id = p.creado_por_id ORDER BY p.created_at DESC`);
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

exports.listarCalendario = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, titulo, to_char(fecha_limite, 'YYYY-MM-DD') AS fecha, 'ticket' AS tipo, estado
      FROM tickets WHERE estado <> 'resuelto'
      UNION ALL
      SELECT id, titulo, to_char(fecha_limite, 'YYYY-MM-DD') AS fecha, 'tarea' AS tipo, estado
      FROM tareas_it
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
      SELECT t.*, u.nombre as creador_nombre, d.nombre as departamento_nombre,
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
  const estadosPermitidos = ['nuevo', 'abierto', 'en_proceso', 'resuelto', 'vencido'];
  if (nuevo_estado && !estadosPermitidos.includes(nuevo_estado)) {
    return res.status(400).json({ success: false, message: `Estado inválido. Use: ${estadosPermitidos.join(', ')}.` });
  }

  try {
    let asignadoId = null;
    if (auto_asignar) {
      const rolPorDepartamento = { 1: 'admin_infra', 2: 'admin_desarrollo', 3: 'admin_gps', 4: 'gerente_it' };
      const departamentoId = Number(nuevo_departamento_id);
      const rol = rolPorDepartamento[departamentoId];
      if (!rol) return res.status(400).json({ success: false, message: 'El área seleccionada no es válida.' });
      const { rows: admins } = await db.query(`
        SELECT id FROM usuarios
        WHERE activo = TRUE AND departamento_id = $1 AND rol = ANY($2::text[])
        ORDER BY CASE WHEN rol = $3 THEN 0 ELSE 1 END, id
        LIMIT 1;
      `, [departamentoId, ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'], rol]);
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
          fecha_estimada_resolucion = CASE WHEN $1 THEN NULL ELSE $2 END,
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
