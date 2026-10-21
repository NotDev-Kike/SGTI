const pool = require('../config/db');
const { guardarImagenesEvidencia } = require('../services/evidenceImageService');
const { puedeAccederTicket } = require('../services/ticketAccessService');

// Obtener los mensajes de un ticket
exports.obtenerMensajesTicket = async (req, res) => {
  try {
    const { ticket_id } = req.params;
    const ticket = await pool.query('SELECT usuario_creador_id, asignado_a_id, categoria FROM tickets WHERE id = $1', [ticket_id]);
    if (!ticket.rowCount) return res.status(404).json({ error: 'Ticket no encontrado.' });
    if (!puedeAccederTicket(req.user, ticket.rows[0])) {
      return res.status(403).json({ error: 'No tiene acceso a esta conversación.' });
    }
    const query = `
            SELECT m.*,
              to_char(m.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at_iso,
              u.nombre as remitente_nombre, u.rol as remitente_rol,
              COALESCE((
                SELECT json_agg(json_build_object('id', i.id, 'nombre_archivo', i.nombre_archivo, 'mime_type', i.mime_type, 'tamano_bytes', i.tamano_bytes) ORDER BY i.id)
                FROM imagenes_evidencia i WHERE i.mensaje_ticket_id = m.id
              ), '[]'::json) AS imagenes
      FROM mensajes_ticket m
      LEFT JOIN usuarios u ON m.remitente_id = u.id
      WHERE m.ticket_id = $1
      ORDER BY m.created_at ASC;
    `;
    const result = await pool.query(query, [ticket_id]);
    result.rows.forEach(message => {
      if (!message.remitente_nombre) message.remitente_nombre = 'Usuario archivado';
    });
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
    const { mensaje } = req.body;
    const ticket = await pool.query('SELECT usuario_creador_id, asignado_a_id, categoria FROM tickets WHERE id = $1', [ticket_id]);
    if (!ticket.rowCount) return res.status(404).json({ error: 'Ticket no encontrado.' });
    if (!puedeAccederTicket(req.user, ticket.rows[0])) {
      return res.status(403).json({ error: 'No tiene acceso a esta conversación.' });
    }
    const messageText = typeof mensaje === 'string' ? mensaje.trim() : '';
    if (!messageText && !(req.files || []).length) return res.status(400).json({ error: 'Escriba un mensaje o adjunte una imagen.' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const query = `
        INSERT INTO mensajes_ticket (ticket_id, remitente_id, mensaje)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;
      const result = await client.query(query, [ticket_id, req.user.id, messageText || 'Adjuntó una imagen como evidencia.']);
      await guardarImagenesEvidencia(client, {
        ticketId: ticket_id,
        mensajeTicketId: result.rows[0].id,
        uploadedById: req.user.id,
        files: req.files || []
      });
      await client.query('COMMIT');
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al enviar el mensaje' });
  }
};

exports.leerImagenTicket = async (req, res) => {
  const ticketId = Number(req.params.ticket_id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) return res.status(400).json({ error: 'Ticket inválido.' });
  try {
    const ticket = await pool.query('SELECT usuario_creador_id, asignado_a_id, categoria FROM tickets WHERE id = $1', [ticketId]);
    if (!ticket.rowCount) return res.status(404).json({ error: 'Ticket no encontrado.' });
    if (!puedeAccederTicket(req.user, ticket.rows[0])) {
      return res.status(403).json({ error: 'No tiene acceso a las imágenes de este ticket.' });
    }
    const { rows } = await pool.query(`
      SELECT id, nombre_archivo, mime_type, tamano_bytes
      FROM imagenes_evidencia
      WHERE ticket_id = $1 AND mensaje_ticket_id IS NULL
      ORDER BY id
    `, [ticketId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'No se pudieron cargar las imágenes del ticket.' });
  }
};
