const db = require('../config/db');
const { hashPassword } = require('./authController');

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
      const query = `
        UPDATE usuarios 
        SET nombre = $1, email = $2, departamento_id = $3,
            activo = COALESCE($4, activo)
        WHERE id = $5
        RETURNING id, nombre, email, rol, departamento_id, activo;
      `;
      const { rows } = await db.query(query, [nombre, email, departamento_id || null, activo, id]);
      if (!rows.length) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
      return res.json({ success: true, message: 'Usuario actualizado correctamente', data: rows[0] });
    } else {
      if (!nombre?.trim() || !email?.trim() || !password || password.length < 8) {
        return res.status(400).json({ success: false, message: 'Nombre, correo y contraseña de al menos 8 caracteres son obligatorios.' });
      }
      const query = `
        INSERT INTO usuarios (nombre, email, password, rol, departamento_id)
        VALUES ($1, $2, $3, 'usuario_final', $4)
        RETURNING id, nombre, email, rol, departamento_id, activo;
      `;
      const { rows } = await db.query(query, [nombre.trim(), email.trim().toLowerCase(), await hashPassword(password), departamento_id || null]);
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
      SELECT t.*, u.nombre AS asignado_nombre, tk.titulo AS ticket_titulo
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
      SELECT id, titulo, fecha_limite AS fecha, 'ticket' AS tipo, estado
      FROM tickets WHERE estado <> 'resuelto'
      UNION ALL
      SELECT id, titulo, fecha_limite AS fecha, 'tarea' AS tipo, estado
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
      CASE 
        WHEN t.fecha_limite < NOW() AND t.estado != 'resuelto' THEN 'vencido'
        WHEN t.prioridad = 'critica' THEN 'critico'
        ELSE 'normal'
      END AS semaforo_alerta
      FROM tickets t
      JOIN usuarios u ON t.usuario_creador_id = u.id
      JOIN departamentos d ON t.departamento_destino_id = d.id
      WHERE t.estado != 'resuelto'
      ORDER BY t.created_at ASC;
    `;
    const { rows } = await db.query(query);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.moverOResolverTicket = async (req, res) => {
  const { id } = req.params;
  const { nuevo_estado, nuevo_departamento_id, titulo, descripcion, categoria, tipo_solicitud, prioridad, accion_historial } = req.body;
  try {
    const query = `
      UPDATE tickets 
      SET estado = COALESCE($1, estado), 
          departamento_destino_id = COALESCE($2, departamento_destino_id),
          titulo = COALESCE($3, titulo),
          descripcion = COALESCE($4, descripcion),
          categoria = COALESCE($5, categoria),
          tipo_solicitud = COALESCE($6, tipo_solicitud),
          prioridad = COALESCE($7, prioridad),
          fecha_resolucion = CASE WHEN $1 = 'resuelto' THEN CURRENT_TIMESTAMP ELSE fecha_resolucion END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 RETURNING *;
    `;
    const { rows } = await db.query(query, [nuevo_estado, nuevo_departamento_id, titulo, descripcion, categoria, tipo_solicitud, prioridad, id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Ticket no encontrado.' });

    // Registrar en historial para que al resolverse desaparezca de "TODOS" activos pero quede en Auditoría
    await db.query(
      `INSERT INTO ticket_historial (ticket_id, usuario_id, accion) VALUES ($1, $2, $3)`,
        [id, req.user.id, accion_historial || 'Modificó o movió el ticket']
    );

    res.json({ success: true, message: 'Ticket actualizado y movido con éxito', data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
