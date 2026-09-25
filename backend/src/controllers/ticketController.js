const pool = require('../config/db');

const crearTicket = async (req, res) => {
  const {
    nombre_solicitante, departamento, ubicacion,
    titulo, descripcion, categoria, tipo_solicitud,
    prioridad, urgencia, archivo_adjunto
  } = req.body;

  try {
    let agente_asignado = 'Auxiliar';
    if (prioridad === 'critica' || urgencia === 'critica' || prioridad === 'alta') {
      agente_asignado = 'Ingeniero';
    }

    let horasSla = 24;
    if (prioridad === 'critica') horasSla = 2;
    else if (prioridad === 'alta') horasSla = 4;
    else if (prioridad === 'media') horasSla = 12;

    const fechaLimiteSla = new Date(Date.now() + horasSla * 60 * 60 * 1000);

    const query = `
      INSERT INTO tickets (
        nombre_solicitante, departamento, ubicacion, titulo, descripcion,
        categoria, tipo_solicitud, prioridad, urgencia, archivo_adjunto,
        estado_actual, agente_asignado, fecha_limite_sla
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Abierto', $11, $12)
      RETURNING *;
    `;

    const values = [
      nombre_solicitante, departamento, ubicacion, titulo, descripcion,
      categoria, tipo_solicitud, prioridad, urgencia, archivo_adjunto,
      agente_asignado, fechaLimiteSla
    ];

    const nuevoTicket = await pool.query(query, values);

    res.status(201).json({
      success: true,
      message: 'Ticket registrado y clasificado exitosamente',
      data: nuevoTicket.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al registrar el ticket' });
  }
};

const obtenerTickets = async (req, res) => {
  try {
    const todos = await pool.query('SELECT * FROM tickets ORDER BY fecha_creacion DESC');
    res.status(200).json({ success: true, data: todos.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener los tickets' });
  }
};

const resolverTicket = async (req, res) => {
  const { id } = req.params;
  const { detalles_resolucion } = req.body;

  try {
    const ticketCheck = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
    if (ticketCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket no encontrado' });
    }

    const ticket = ticketCheck.rows[0];

    await pool.query(
      `UPDATE tickets SET estado_actual = 'Resuelto', fecha_resolucion = CURRENT_TIMESTAMP, detalles_resolucion = $1 WHERE id = $2`,
      [detalles_resolucion, id]
    );

    await pool.query(
      `INSERT INTO historial_tickets_log (
        ticket_id, nombre_solicitante, departamento, titulo, categoria,
        tipo_solicitud, prioridad, agente_asignado, detalles_resolucion
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        ticket.id, ticket.nombre_solicitante, ticket.departamento, ticket.titulo,
        ticket.categoria, ticket.tipo_solicitud, ticket.prioridad, ticket.agente_asignado,
        detalles_resolucion
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Ticket resuelto con éxito y registrado en el historial.'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al procesar la resolución' });
  }
};

const obtenerHistorialLogs = async (req, res) => {
  try {
    const logs = await pool.query('SELECT * FROM historial_tickets_log ORDER BY archivado_en DESC');
    res.status(200).json({ success: true, data: logs.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener el historial' });
  }
};

module.exports = {
  crearTicket,
  obtenerTickets,
  resolverTicket,
  obtenerHistorialLogs
};