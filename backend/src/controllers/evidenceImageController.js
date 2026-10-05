const db = require('../config/db');
const { sanitizeFileName } = require('../services/evidenceImageService');

const adminRoles = ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'];

const enviarImagen = (res, image) => {
  const filename = sanitizeFileName(image.nombre_archivo);
  res
    .type(image.mime_type)
    .set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`)
    .set('X-Content-Type-Options', 'nosniff')
    .set('Cache-Control', 'private, no-store')
    .send(image.contenido);
};

exports.listarImagenesTicket = async (req, res) => {
  const ticketId = Number(req.params.ticket_id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return res.status(400).json({ success: false, error: 'Ticket inválido.' });
  }
  try {
    const { rows: tickets } = await db.query('SELECT usuario_creador_id, asignado_a_id FROM tickets WHERE id = $1', [ticketId]);
    if (!tickets.length) return res.status(404).json({ success: false, error: 'Ticket no encontrado.' });
    const ticket = tickets[0];
    const isRequester = Number(ticket.usuario_creador_id) === Number(req.user.id);
    const isAssignee = Number(ticket.asignado_a_id) === Number(req.user.id);
    if (!isRequester && req.user.rol !== 'gerente_it' && (!adminRoles.includes(req.user.rol) || !isAssignee)) {
      return res.status(403).json({ success: false, error: 'No tiene acceso a las imágenes de este ticket.' });
    }
    const { rows } = await db.query(`
      SELECT id, nombre_archivo, mime_type, tamano_bytes
      FROM imagenes_evidencia
      WHERE ticket_id = $1 AND mensaje_ticket_id IS NULL
      ORDER BY id
    `, [ticketId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.leerImagen = async (req, res) => {
  const imageId = Number(req.params.image_id);
  if (!Number.isInteger(imageId) || imageId <= 0) {
    return res.status(400).json({ success: false, error: 'Imagen inválida.' });
  }
  try {
    const { rows } = await db.query(`
      SELECT i.*,
             t.usuario_creador_id, t.asignado_a_id,
             c.solicitante_id, c.admin_id
      FROM imagenes_evidencia i
      LEFT JOIN tickets t ON t.id = i.ticket_id
      LEFT JOIN mensajes_directos dm ON dm.id = i.mensaje_directo_id
      LEFT JOIN conversaciones_directas c ON c.id = dm.conversacion_id
      WHERE i.id = $1
    `, [imageId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Imagen no encontrada.' });
    const image = rows[0];
    if (image.ticket_id != null) {
      const isRequester = Number(image.usuario_creador_id) === Number(req.user.id);
      const isAssignee = Number(image.asignado_a_id) === Number(req.user.id);
      if (!isRequester && req.user.rol !== 'gerente_it' && (!adminRoles.includes(req.user.rol) || !isAssignee)) {
        return res.status(403).json({ success: false, error: 'No tiene acceso a esta imagen.' });
      }
    } else if (Number(image.solicitante_id) !== Number(req.user.id) && Number(image.admin_id) !== Number(req.user.id)) {
      return res.status(403).json({ success: false, error: 'No tiene acceso a esta imagen.' });
    }
    enviarImagen(res, image);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.leerImagenArchivada = async (req, res) => {
  const archiveId = Number(req.params.archivoId);
  const imageId = Number(req.params.imagenId);
  if (!Number.isInteger(archiveId) || archiveId <= 0 || !Number.isInteger(imageId) || imageId <= 0) {
    return res.status(400).json({ success: false, error: 'Archivo o imagen inválidos.' });
  }
  try {
    const { rows } = await db.query(`
      SELECT nombre_archivo, mime_type, contenido
      FROM usuarios_archivados_imagenes
      WHERE id = $1 AND usuario_archivado_id = $2
    `, [imageId, archiveId]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Imagen archivada no encontrada.' });
    enviarImagen(res, rows[0]);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
