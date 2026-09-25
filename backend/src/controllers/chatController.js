const pool = require('../config/db');

// Obtener los mensajes de un ticket
exports.obtenerMensajesTicket = async (req, res) => {
  try {
    const { ticket_id } = req.params;
    const query = `
      SELECT m.*, u.nombre as remitente_nombre, u.rol as remitente_rol
      FROM mensajes_ticket m
      JOIN usuarios u ON m.remitente_id = u.id
      WHERE m.ticket_id = $1
      ORDER BY m.created_at ASC;
    `;
    const result = await pool.query(query, [ticket_id]);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los mensajes del chat' });
  }
};

// Enviar un mensaje en el chat del ticket
exports.enviarMensaje = async (req, res) => {
  try {
    const { ticket_id } = req.params;
    const { remitente_id, mensaje } = req.body;

    const query = `
      INSERT INTO mensajes_ticket (ticket_id, remitente_id, mensaje)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await pool.query(query, [ticket_id, remitente_id, mensaje]);
    
    // Opcional: Podrías registrar una acción en el historial del ticket aquí
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar el mensaje' });
  }
};