const pool = require('../config/db');

// Registro de Usuario Final
exports.registrar = async (req, res) => {
  try {
    const { nombre, email, password, departamento_id } = req.body;
    
    // Verificar si el correo ya existe
    const userExist = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
    if (userExist.rows.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
    }

    // Por defecto, los registros externos son 'usuario_final'
    const query = `
      INSERT INTO usuarios (nombre, email, password, rol, departamento_id)
      VALUES ($1, $2, $3, 'usuario_final', $4)
      RETURNING id, nombre, email, rol;
    `;
    const newUser = await pool.query(query, [nombre, email, password, departamento_id || null]);

    res.status(201).json({ message: 'Usuario registrado con éxito', usuario: newUser.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor al registrar' });
  }
};

// Login (Inicio de Sesión)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const query = 'SELECT * FROM usuarios WHERE email = $1 AND password = $2 AND activo = TRUE';
    const result = await pool.query(query, [email, password]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas o cuenta inactiva' });
    }

    const usuario = result.rows[0];
    // Retornamos los datos del usuario (en un entorno real aquí se enviaría un token JWT)
    res.json({ message: 'Login exitoso', usuario });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en el servidor al iniciar sesión' });
  }
};