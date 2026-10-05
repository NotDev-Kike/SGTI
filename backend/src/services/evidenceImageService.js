const path = require('path');

const sanitizeFileName = filename => {
  const base = path.basename(String(filename || 'evidencia'));
  return base.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 180) || 'evidencia';
};

const guardarImagenesEvidencia = async (client, { ticketId = null, mensajeTicketId = null, mensajeDirectoId = null, uploadedById, files = [] }) => {
  for (const file of files) {
    await client.query(`
      INSERT INTO imagenes_evidencia
        (ticket_id, mensaje_ticket_id, mensaje_directo_id, subido_por_id, nombre_archivo, mime_type, tamano_bytes, contenido)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      ticketId,
      mensajeTicketId,
      mensajeDirectoId,
      uploadedById,
      sanitizeFileName(file.originalname),
      file.mimetype,
      file.size,
      file.buffer
    ]);
  }
};

module.exports = { guardarImagenesEvidencia, sanitizeFileName };
