function isPrivateIp(ip = '') {
  const normalized = String(ip).replace(/^::ffff:/, '');
  return normalized === '127.0.0.1' || normalized === '::1' || normalized.startsWith('10.') ||
    normalized.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized);
}

function requireInternalNetwork(req, res, next) {
  if (String(process.env.INTERNAL_NETWORK_ONLY || 'false').toLowerCase() !== 'true') return next();
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? String(forwarded).split(',')[0].trim() : req.ip;
  if (!isPrivateIp(ip)) return res.status(403).json({ success: false, message: 'Acceso permitido únicamente desde la red interna.' });
  next();
}

module.exports = { requireInternalNetwork, isPrivateIp };
