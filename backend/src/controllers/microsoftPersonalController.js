const microsoft = require('../services/microsoftService');
const { registrarEvento } = require('../services/auditService');
const { signToken } = require('../middleware/auth');
const crypto = require('crypto');

const frontendUrl = req => {
  if (process.env.FRONTEND_URL && !/localhost|127\.0\.0\.1/.test(process.env.FRONTEND_URL)) return process.env.FRONTEND_URL.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  if (host.includes('-5000.')) return `${protocol}://${host.replace('-5000.', '-3000.')}`;
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
};

const formatUser = user => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  rol: user.rol,
  area: user.departamento_nombre || 'General',
  isAdmin: ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'].includes(user.rol),
  departamento_id: user.departamento_id
});

const microsoftEmails = profile => [...new Set([
  profile.mail,
  profile.userPrincipalName,
  profile.preferred_username
].filter(value => typeof value === 'string' && value.trim()).map(value => value.trim().toLowerCase()))];

const microsoftDisplayName = profile => profile.displayName || [profile.givenName, profile.surname].filter(Boolean).join(' ') || profile.userPrincipalName;

exports.login = async (_req, res) => {
  try { res.json({ success: true, url: await microsoft.createLoginAuthorizationUrl() }); }
  catch (error) { res.status(503).json({ success: false, message: error.message }); }
};

exports.loginCallback = async (req, res) => {
  try {
    const authResult = await microsoft.completeLogin(req.query.code, req.query.state);
    const emails = microsoftEmails(authResult.profile);
    const email = emails[0];
    if (!email) throw new Error('Microsoft no devolvió un correo electrónico válido.');
    const db = require('../config/db');
    let { rows } = await db.query(`SELECT u.*, d.nombre AS departamento_nombre FROM usuarios u LEFT JOIN departamentos d ON d.id=u.departamento_id WHERE LOWER(u.email) = ANY($1::text[]) AND u.activo=TRUE`, [emails]);
    let user = rows[0];

    if (!user) throw new Error('Este correo aún no tiene acceso autorizado. Solicite al gerente de IT que valide su correo.');
    if (authResult.profile.displayName && user.nombre !== authResult.profile.displayName) {
      await db.query('UPDATE usuarios SET nombre=$1 WHERE id=$2', [authResult.profile.displayName, user.id]);
      user.nombre = authResult.profile.displayName;
    }

    await microsoft.savePersonalConnection(user.id, authResult);
    const code = require('crypto').randomBytes(32).toString('hex');
    await db.query('INSERT INTO microsoft_login_codes (code, usuario_id, expires_at) VALUES ($1,$2,NOW()+INTERVAL \'2 minutes\')', [code, user.id]);
    await registrarEvento({ req, usuarioId: user.id, evento: 'sesion.inicio_microsoft', entidad: 'usuario', entidadId: user.id });
    res.redirect(`${frontendUrl(req)}?microsoft_code=${encodeURIComponent(code)}`);
  } catch (error) {
    res.redirect(`${frontendUrl(req)}?microsoft_error=${encodeURIComponent(error.message)}`);
  }
};

exports.exchangeLoginCode = async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const db = require('../config/db');
    const result = await db.query('SELECT usuario_id FROM microsoft_login_codes WHERE code=$1 AND expires_at>NOW()', [code]);
    if (!result.rows.length) return res.status(401).json({ success: false, message: 'El acceso Microsoft expiró. Intente nuevamente.' });
    await db.query('DELETE FROM microsoft_login_codes WHERE code=$1', [code]);
    const { rows } = await db.query('SELECT u.*, d.nombre AS departamento_nombre FROM usuarios u LEFT JOIN departamentos d ON d.id=u.departamento_id WHERE u.id=$1 AND u.activo=TRUE', [result.rows[0].usuario_id]);
    if (!rows.length) return res.status(401).json({ success: false, message: 'La cuenta SGTI está inactiva.' });
    res.json({ success: true, user: formatUser(rows[0]), token: signToken(rows[0]) });
  } catch (error) { res.status(500).json({ success: false, message: 'No se pudo completar el acceso Microsoft.' }); }
};

exports.connect = async (req, res) => {
  try { res.json({ success: true, url: await microsoft.createAuthorizationUrl(req.user.id) }); }
  catch (error) { res.status(503).json({ success: false, message: error.message }); }
};

exports.callback = async (req, res) => {
  try {
    const userId = await microsoft.connectCallback(req.query.code, req.query.state);
    await registrarEvento({ req, usuarioId: userId, evento: 'microsoft.cuenta_conectada' });
    res.redirect(`${frontendUrl(req)}?microsoft=connected`);
  } catch (error) { res.redirect(`${frontendUrl(req)}?microsoft=error&message=${encodeURIComponent(error.message)}`); }
};

exports.status = async (req, res) => {
  const db = require('../config/db');
  const { rows } = await db.query('SELECT microsoft_email,updated_at FROM microsoft_conexiones WHERE usuario_id=$1', [req.user.id]);
  res.json({ success: true, data: { conectado: Boolean(rows.length), email: rows[0]?.microsoft_email || null, actualizado: rows[0]?.updated_at || null } });
};

exports.events = async (req, res) => { try { const data = await microsoft.personalEvents(req.user.id, req.query.desde, req.query.hasta); res.json({ success: true, data: data.value || [] }); } catch (error) { res.status(503).json({ success: false, message: error.message }); } };
exports.messages = async (req, res) => { try { const data = await microsoft.personalMessages(req.user.id); res.json({ success: true, data: data.value || [] }); } catch (error) { res.status(503).json({ success: false, message: error.message }); } };
exports.createEvent = async (req, res) => { try { const data = await microsoft.personalCreateEvent(req.user.id, req.body); res.status(201).json({ success: true, data }); } catch (error) { res.status(503).json({ success: false, message: error.message }); } };
