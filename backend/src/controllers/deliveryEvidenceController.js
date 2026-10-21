const db = require('../config/db');

const validImage = file => file && String(file.mimetype || '').startsWith('image/') && file.size <= 8 * 1024 * 1024;

exports.agregar = async (req, res) => {
  if (!validImage(req.file)) return res.status(400).json({ success: false, message: 'Adjunte una imagen de evidencia de máximo 8 MB.' });
  const delivery = await db.query('SELECT id FROM entregas_infraestructura WHERE id = $1', [req.params.id]);
  if (!delivery.rows.length) return res.status(404).json({ success: false, message: 'Entrega no encontrada.' });
  const { rows } = await db.query(`INSERT INTO entregas_infraestructura_evidencias (entrega_id, nombre_archivo, mime_type, contenido) VALUES ($1,$2,$3,$4) RETURNING id, nombre_archivo, mime_type, created_at`, [req.params.id, req.file.originalname, req.file.mimetype, req.file.buffer]);
  res.status(201).json({ success: true, data: rows[0] });
};

exports.listar = async (req, res) => {
  const { rows } = await db.query('SELECT id, nombre_archivo, mime_type, encode(contenido, \'base64\') AS contenido, created_at FROM entregas_infraestructura_evidencias WHERE entrega_id = $1 ORDER BY id', [req.params.id]);
  res.json({ success: true, data: rows });
};

