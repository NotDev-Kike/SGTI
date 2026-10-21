const crypto = require('crypto');
const db = require('../config/db');

async function registrarEvento({ req, usuarioId, evento, entidad, entidadId, detalle = {} }) {
  try {
    const actorId = usuarioId || req?.user?.id || null;
    const ip = req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null;
    const userAgent = req?.headers?.['user-agent'] || null;
    const updated = await db.query(`UPDATE auditoria_eventos
      SET created_at=CURRENT_TIMESTAMP, ip=$1, user_agent=$2, detalle=$3
      WHERE usuario_id IS NOT DISTINCT FROM $4
        AND evento=$5
        AND entidad IS NOT DISTINCT FROM $6
        AND entidad_id IS NOT DISTINCT FROM $7`, [
      ip, userAgent, JSON.stringify(detalle), actorId, evento, entidad || null, entidadId || null
    ]);
    if (updated.rowCount) return;
    await db.query(`INSERT INTO auditoria_eventos (usuario_id, evento, entidad, entidad_id, ip, user_agent, detalle)
      VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
      actorId, evento, entidad || null, entidadId || null, ip, userAgent, JSON.stringify(detalle)
    ]);
  } catch (error) {
    // La auditoría nunca debe impedir una operación válida durante una actualización.
    if (process.env.NODE_ENV !== 'test') console.error('Auditoría:', error.message);
  }
}

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

module.exports = { registrarEvento, hashToken };
