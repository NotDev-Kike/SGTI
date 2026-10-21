const crypto = require('crypto');
const db = require('../config/db');
const { registrarEvento, hashToken } = require('../services/auditService');

const secret = process.env.AUTH_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
const adminRoles = new Set(['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo']);

function signToken(user) {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    email: user.email,
    rol: user.rol,
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

async function authenticate(req, res, next) {
  const authorization = req.headers.authorization || (req.query.token ? `Bearer ${req.query.token}` : '');
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'Autenticación requerida.' });
  }

  const [payload, signature] = token.split('.');
  if (!payload || !signature) {
    return res.status(401).json({ success: false, message: 'Sesión inválida.' });
  }

  const expected = crypto.createHmac('sha256', secret).update(payload).digest();
  const received = Buffer.from(signature, 'base64url');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return res.status(401).json({ success: false, message: 'Sesión inválida.' });
  }

  let tokenUser;
  try {
    tokenUser = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!tokenUser.id || !tokenUser.exp || tokenUser.exp <= Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ success: false, message: 'La sesión expiró.' });
    }
  } catch {
    return res.status(401).json({ success: false, message: 'Sesión inválida.' });
  }

  try {
    const { rows } = await db.query('SELECT id, email, rol FROM usuarios WHERE id = $1 AND activo = TRUE', [tokenUser.id]);
    if (!rows.length) return res.status(401).json({ success: false, message: 'La cuenta está inactiva.' });
    req.user = rows[0];
    registrarEvento({ req, usuarioId: req.user.id, evento: 'sesion.actividad', entidad: 'usuario', entidadId: req.user.id });
    db.query(`UPDATE sesiones_usuario
      SET token_hash=$2, ultima_actividad=CURRENT_TIMESTAMP, conectado=TRUE, ip=$3, user_agent=$4
      WHERE usuario_id=$1`, [req.user.id, hashToken(token), req.ip, req.headers['user-agent']])
      .then(result => result.rowCount ? null : db.query(
        `INSERT INTO sesiones_usuario (usuario_id, token_hash, ip, user_agent) VALUES ($1,$2,$3,$4)`,
        [req.user.id, hashToken(token), req.ip, req.headers['user-agent']]
      ))
      .catch(() => {});
    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'No se pudo validar la sesión.' });
  }
}

function requireAdmin(req, res, next) {
  if (!adminRoles.has(req.user?.rol)) {
    return res.status(403).json({ success: false, message: 'Se requieren permisos de administrador.' });
  }
  next();
}

function requireManager(req, res, next) {
  if (req.user?.rol !== 'gerente_it') {
    return res.status(403).json({ success: false, message: 'Esta acción está reservada al gerente de IT.' });
  }
  next();
}

function requireInfrastructure(req, res, next) {
  if (req.user?.rol !== 'admin_infra') {
    return res.status(403).json({ success: false, message: 'Esta acción está reservada al equipo de infraestructura.' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, requireManager, requireInfrastructure, signToken };
