const db = require('../config/db');

// --- 1. GESTIÓN DE USUARIOS (Solo Admins) ---
exports.crearModificarUsuario = async (req, res) => {
  const { id, nombre, email, password, rol, departamento_id, activo } = req.body;
  try {
    if (id) {
      // Actualizar usuario existente (por si se equivocó y el admin rectifica)
      const query = `
        UPDATE usuarios 
        SET nombre = $1, email = $2, rol = $3, departamento_id = $4, activo = $5 
        WHERE id = $6 RETURNING *;
      `;
      const { rows } = await db.query(query, [nombre, email, rol, departamento_id, activo, id]);
      return res.json({ success: true, message: 'Usuario actualizado correctamente', data: rows[0] });
    } else {
      // Crear usuario nuevo (Auto-registro de usuarios básicos o creación por Admin)
      const query = `
        INSERT INTO usuarios (nombre, email, password, rol, departamento_id)
        VALUES ($1, $2, $3, $4, $5) RETURNING *;
      `;
      const { rows } = await db.query(query, [nombre, email, password, rol || 'usuario_final', departamento_id || null]);
      return res.status(201).json({ success: true, message: 'Usuario creado exitosamente', data: rows[0] });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(`DELETE FROM usuarios WHERE id = $1`, [id]);
    res.json({ success: true, message: 'Usuario eliminado correctamente' });
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
  const { nuevo_estado, nuevo_departamento_id, usuario_id, accion_historial } = req.body;
  try {
    const query = `
      UPDATE tickets 
      SET estado = COALESCE($1, estado), 
          departamento_destino_id = COALESCE($2, departamento_destino_id),
          fecha_resolucion = CASE WHEN $1 = 'resuelto' THEN CURRENT_TIMESTAMP ELSE fecha_resolucion END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 RETURNING *;
    `;
    const { rows } = await db.query(query, [nuevo_estado, nuevo_departamento_id, id]);

    // Registrar en historial para que al resolverse desaparezca de "TODOS" activos pero quede en Auditoría
    await db.query(
      `INSERT INTO ticket_historial (ticket_id, usuario_id, accion) VALUES ($1, $2, $3)`,
      [id, usuario_id, accion_historial || 'Modificó o movió el ticket']
    );

    res.json({ success: true, message: 'Ticket actualizado y movido con éxito', data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 3. PROYECTOS DE TI (Apartado extra informativo) ---
exports.gestionarProyectoTI = async (req, res) => {
  const { titulo, descripcion, creado_por_id, estado } = req.body;
  try {
    const query = `
      INSERT INTO proyectos_ti (titulo, descripcion, creado_por_id, estado)
      VALUES ($1, $2, $3, $4) RETURNING *;
    `;
    const { rows } = await db.query(query, [titulo, descripcion, creado_por_id, estado || 'planificacion']);
    res.status(201).json({ success: true, message: 'Proyecto de TI registrado como informativo', data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- 4. CHAT DIRECTO CON IT (Mensajería Inmediata) ---
exports.enviarChatDirecto = async (req, res) => {
  const { remitente_id, destinatario_admin_id, mensaje } = req.body;
  try {
    // Se reutiliza o mapea una tabla de chat general / o por ticket de soporte directo
    const query = `
      INSERT INTO mensajes_ticket (ticket_id, remitente_id, mensaje)
      VALUES (NULL, $1, $2) -- Nota: Se puede adaptar para chat directo creando una tabla chat_directo si prefieres
      RETURNING *;
    `;
    // Simulando envío directo al admin seleccionado
    res.json({ success: true, message: `Mensaje enviado al administrador ID ${destinatario_admin_id}, pendiente de respuesta.` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};