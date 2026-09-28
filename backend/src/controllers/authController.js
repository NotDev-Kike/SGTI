const db = require('../config/db');
const crypto = require('crypto');
const { promisify } = require('util');
const { signToken } = require('../middleware/auth');

const scrypt = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

exports.hashPassword = hashPassword;

exports.listarDepartamentos = async (_req, res) => {
  try {
    const { rows } = await db.query('SELECT id, nombre FROM departamentos ORDER BY nombre');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudieron cargar las áreas.' });
  }
};

async function verifyPassword(password, storedPassword) {
  const [algorithm, salt, hash] = storedPassword.split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) {
    return { valid: password === storedPassword, needsUpgrade: true };
  }

  const derivedKey = await scrypt(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return {
    valid: expected.length === derivedKey.length && crypto.timingSafeEqual(expected, derivedKey),
    needsUpgrade: false
  };
}

function formatUser(user) {
  const rolesAdmin = ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'];
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    area: user.departamento_nombre || 'General',
    isAdmin: rolesAdmin.includes(user.rol),
    departamento_id: user.departamento_id
  };
}

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const query = `
      SELECT u.*, d.nombre as departamento_nombre 
      FROM usuarios u
      LEFT JOIN departamentos d ON u.departamento_id = d.id
      WHERE u.email = $1 AND u.activo = TRUE;
    `;
    const { rows } = await db.query(query, [email.trim().toLowerCase()]);

    if (rows.length === 0 || !password) {
      return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos, o cuenta inactiva.' });
    }

    const user = rows[0];
    const verification = await verifyPassword(password, user.password);
    if (!verification.valid) {
      return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos, o cuenta inactiva.' });
    }

    if (verification.needsUpgrade) {
      await db.query('UPDATE usuarios SET password = $1 WHERE id = $2', [await hashPassword(password), user.id]);
    }

    res.json({ success: true, user: formatUser(user), token: signToken(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error en el servidor al intentar iniciar sesión', error: error.message });
  }
};

exports.registrar = async (req, res) => {
  const { nombre, email, password, departamento_id } = req.body;
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const departmentId = Number(departamento_id);

  if (!nombre?.trim() || !normalizedEmail || !password || password.length < 8) {
    return res.status(400).json({ success: false, message: 'Ingrese nombre, correo y una contraseña de al menos 8 caracteres.' });
  }
  if (!Number.isInteger(departmentId) || departmentId <= 0) {
    return res.status(400).json({ success: false, message: 'Seleccione un área válida.' });
  }

  try {
    const departmentResult = await db.query('SELECT id, nombre FROM departamentos WHERE id = $1', [departmentId]);
    if (!departmentResult.rowCount) {
      return res.status(400).json({ success: false, message: 'El área seleccionada no existe.' });
    }
    const query = `
      INSERT INTO usuarios (nombre, email, password, rol, departamento_id)
      VALUES ($1, $2, $3, 'usuario_final', $4)
      RETURNING id, nombre, email, rol, departamento_id;
    `;
    const { rows } = await db.query(query, [nombre.trim(), normalizedEmail, await hashPassword(password), departmentId]);
    const user = { ...rows[0], departamento_nombre: departmentResult.rows[0].nombre };
    res.status(201).json({ success: true, user: formatUser(user), token: signToken(user) });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Ya existe una cuenta con ese correo.' });
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'No se pudo crear la cuenta.' });
  }
};