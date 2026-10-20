const crypto = require('crypto');
const db = require('../config/db');

async function registrarEvento({ req, usuarioId, evento, entidad, entidadId, detalle = {} }) {
  try {
    await db.query(`INSERT INTO auditoria_eventos (usuario_id, evento, entidad, entidad_id, ip, user_agent, detalle)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
      usuarioId || req?.user?.id || null, evento, entidad || null, entidadId || null,
      req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null,
      req?.headers?.['user-agent'] || null, JSON.stringify(detalle)
    ]);
  } catch (error) {
    // La auditoría nunca debe impedir una operación válida durante una actualización.
    if (process.env.NODE_ENV !== 'test') console.error('Auditoría:', error.message);
  }
}

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { registrarEvento, hashToken };
