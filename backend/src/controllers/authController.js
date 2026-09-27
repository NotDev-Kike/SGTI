const db = require('../config/db');

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const query = `
      SELECT u.*, d.nombre as departamento_nombre 
      FROM usuarios u
      LEFT JOIN departamentos d ON u.departamento_id = d.id
      WHERE u.email = $1 AND u.password = $2 AND u.activo = TRUE;
    `;
    const { rows } = await db.query(query, [email.trim().toLowerCase(), password]);

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos, o cuenta inactiva.' });
    }

    const user = rows[0];
    
    // Mapeo inteligente para saber si es Admin o Usuario Final basado en tu BD
    const rolesAdmin = ['gerente_it', 'admin_infra', 'admin_gps', 'admin_desarrollo'];
    const isAdmin = rolesAdmin.includes(user.rol);

    res.json({
      success: true,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        area: user.departamento_nombre || 'General',
        isAdmin: isAdmin,
        departamento_id: user.departamento_id
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error en el servidor al intentar iniciar sesión', error: error.message });
  }
};