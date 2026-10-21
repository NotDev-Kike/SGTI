const crypto = require('crypto');
const db = require('../config/db');

async function registrarEvento({ req, usuarioId, evento, entidad, entidadId, detalle = {} }) {
  try {
    const actorId = usuarioId || req?.user?.id || null;
    const ip = req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null;
    const userAgent = req?.headers?.['user-agent'] || null;
    await db.query(`INSERT INTO auditoria_eventos (usuario_id, evento, entidad, entidad_id, ip, user_agent, detalle)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
      actorId, evento, entidad || null, entidadId || null, ip, userAgent, JSON.stringify(sanitizarDetalleSolicitud(detalle))
    ]);
  } catch (error) {
    // La auditoría nunca debe impedir una operación válida durante una actualización.
    if (process.env.NODE_ENV !== 'test') console.error('Auditoría:', error.message);
  }
}

const sanitizarDetalleSolicitud = body => {
  if (!body || typeof body !== 'object') return {};
  return Object.fromEntries(Object.entries(body).map(([clave, valor]) => {
    if (/password|token|secret/i.test(clave)) return [clave, '[oculto]'];
    if (Array.isArray(valor)) return [clave, valor.length > 20 ? `[${valor.length} elementos]` : valor];
    return [clave, typeof valor === 'string' && valor.length > 1000 ? `${valor.slice(0, 1000)}…` : valor];
  }));
};

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { registrarEvento, sanitizarDetalleSolicitud, hashToken };
