const db = require('../config/db');
const microsoft = require('../services/microsoftService');
const { registrarEvento } = require('../services/auditService');

exports.estadoMicrosoft = (_req, res) => res.json({ success: true, data: { configurado: microsoft.configured(), modo: microsoft.configured() ? 'Microsoft Graph' : 'SMTP/configuración pendiente' } });
exports.crearEventoMicrosoft = async (req, res) => {
  try {
    const b = req.body;
    if (!b.titulo || !b.inicio || !b.fin) return res.status(400).json({ success: false, message: 'Título, inicio y fin son obligatorios.' });
    const owner = b.usuario_id || req.user.email;
    const event = await microsoft.createEvent(owner, b);
    await db.query(`INSERT INTO eventos_microsoft (usuario_id,microsoft_id,titulo,descripcion,inicio,fin,sincronizado) VALUES($1,$2,$3,$4,$5,$6,TRUE)`, [b.usuario_id || req.user.id, event.id, b.titulo, b.descripcion || null, b.inicio, b.fin]);
    await registrarEvento({ req, evento: 'microsoft.evento_creado', entidad: 'evento_microsoft', detalle: { titulo: b.titulo } });
    res.status(201).json({ success: true, data: event });
  } catch (error) { res.status(503).json({ success: false, message: error.message }); }
};
exports.enviarCorreoMicrosoft = async (req, res) => { try { await microsoft.sendMail(req.body.usuario_id || req.user.email, req.body.message); await registrarEvento({ req, evento: 'microsoft.correo_enviado' }); res.json({ success: true }); } catch (error) { res.status(503).json({ success: false, message: error.message }); } };
exports.listarEventosMicrosoft = async (req, res) => { try { const data = await microsoft.listEvents(req.user.email, req.query.desde, req.query.hasta); res.json({ success: true, data: data.value || [] }); } catch (error) { res.status(503).json({ success: false, message: error.message }); } };
