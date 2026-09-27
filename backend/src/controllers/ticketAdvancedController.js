const db = require('../config/db');

// 1. Listar todos los tickets con información relacional (Nombres de creador y departamento)
exports.listarTickets = async (req, res) => {
  try {
    const query = `
      SELECT 
        t.*, 
        u.nombre AS creador_nombre, 
        u.email AS creador_email,
        d.nombre AS departamento_destino_nombre,
        u_asig.nombre AS asignado_nombre
      FROM tickets t
      JOIN usuarios u ON t.usuario_creador_id = u.id
      JOIN departamentos d ON t.departamento_destino_id = d.id
      LEFT JOIN usuarios u_asig ON t.asignado_a_id = u_asig.id
      ORDER BY t.created_at DESC;
    `;
    const { rows } = await db.query(query);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al listar los tickets', error: error.message });
  }
};

// 2. Crear un Ticket y registrar el evento en el historial
exports.crearTicket = async (req, res) => {
  const { titulo, descripcion, usuario_creador_id, departamento_destino_id, categoria, prioridad, fecha_limite } = req.body;
  
  try {
    // Insertar el ticket
    const insertTicketQuery = `
      INSERT INTO tickets (titulo, descripcion, usuario_creador_id, departamento_destino_id, categoria, prioridad, estado, fecha_limite)
      VALUES ($1, $2, $3, $4, $5, $6, 'nuevo', $7)
      RETURNING *;
    `;
    const ticketValues = [titulo, descripcion, usuario_creador_id, departamento_destino_id, categoria, prioridad || 'media', fecha_limite];
    const newTicketResult = await db.query(insertTicketQuery, ticketValues);
    const ticketCreado = newTicketResult.rows[0];

    // Registrar en la tabla de historial (auditoría)
    const insertHistorialQuery = `
      INSERT INTO ticket_historial (ticket_id, usuario_id, accion)
      VALUES ($1, $2, $3);
    `;
    await db.query(insertHistorialQuery, [ticketCreado.id, usuario_creador_id, 'Creación del ticket']);

    res.status(201).json({ 
      success: true, 
      message: 'Ticket creado exitosamente', 
      data: ticketCreado 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al crear el ticket', error: error.message });
  }
};

// 3. Asignar Ticket a un Técnico (por Gerente IT o Admin)
exports.asignarTicket = async (req, res) => {
  const { id } = req.params; // ID del ticket
  const { asignado_a_id, usuario_operador_id } = req.body; // Quién recibe y quién realiza la acción

  try {
    const updateQuery = `
      UPDATE tickets 
      SET asignado_a_id = $1, estado = 'en_proceso', updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 
      RETURNING *;
    `;
    const { rows } = await db.query(updateQuery, [asignado_a_id, id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket no encontrado' });
    }

    // Registrar en el historial
    await db.query(
      `INSERT INTO ticket_historial (ticket_id, usuario_id, accion) VALUES ($1, $2, $3)`,
      [id, usuario_operador_id, `Asignó el ticket al técnico ID: ${asignado_a_id}`]
    );

    res.status(200).json({ success: true, message: 'Ticket asignado correctamente', data: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al asignar el ticket', error: error.message });
  }
};

// 4. Resolver Ticket
exports.resolverTicket = async (req, res) => {
  const { id } = req.params;
  const { usuario_id } = req.body;

  try {
    const updateQuery = `
      UPDATE tickets 
      SET estado = 'resuelto', fecha_resolucion = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1 
      RETURNING *;
    `;
    const { rows } = await db.query(updateQuery, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket no encontrado' });
    }

    // Registrar en historial
    await db.query(
      `INSERT INTO ticket_historial (ticket_id, usuario_id, accion) VALUES ($1, $2, $3)`,
      [id, usuario_id, 'Marcó el ticket como resuelto']
    );

    res.status(200).json({ success: true, message: 'Ticket resuelto correctamente', data: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al resolver el ticket', error: error.message });
  }
};

// 5. Enviar mensaje de chat interno en el ticket
exports.enviarMensaje = async (req, res) => {
  const { id } = req.params; // ticket_id
  const { remitente_id, mensaje } = req.body;

  try {
    const query = `
      INSERT INTO mensajes_ticket (ticket_id, remitente_id, mensaje)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const { rows } = await db.query(query, [id, remitente_id, mensaje]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al enviar mensaje', error: error.message });
  }
};