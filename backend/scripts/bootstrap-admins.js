require('dotenv').config();

const db = require('../src/config/db');
const { hashPassword } = require('../src/controllers/authController');

const accounts = [
  { key: 'GERENCIA', role: 'gerente_it', department: 'Gerencia de IT' },
  { key: 'INFRA', role: 'admin_infra', department: 'Infraestructura' },
  { key: 'GPS', role: 'admin_gps', department: 'GPS/rutas' },
  { key: 'DESARROLLO', role: 'admin_desarrollo', department: 'Desarrollo' }
];

async function bootstrapAdmins() {
  const configured = accounts.map(account => ({
    ...account,
    email: process.env[`ADMIN_${account.key}_EMAIL`]?.trim().toLowerCase(),
    password: process.env[`ADMIN_${account.key}_PASSWORD`],
    name: process.env[`ADMIN_${account.key}_NAME`] || account.department
  }));
  const missing = configured.filter(account => !account.email || !account.password || account.password.length < 8);
  if (missing.length) {
    throw new Error(`Configure email y contraseña de al menos 8 caracteres para: ${missing.map(account => account.key).join(', ')}`);
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const account of configured) {
      const department = await client.query('SELECT id FROM departamentos WHERE nombre = $1', [account.department]);
      if (!department.rowCount) throw new Error(`No existe el área ${account.department}`);
      await client.query(`
        INSERT INTO usuarios (nombre, email, password, rol, departamento_id, activo)
        VALUES ($1, $2, $3, $4, $5, TRUE)
        ON CONFLICT (email) DO UPDATE SET
          nombre = EXCLUDED.nombre,
          rol = EXCLUDED.rol,
          departamento_id = EXCLUDED.departamento_id,
          activo = TRUE;
      `, [account.name, account.email, await hashPassword(account.password), account.role, department.rows[0].id]);
    }
    await client.query('COMMIT');
    console.log('Roles administrativos provisionados.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await db.end();
  }
}

bootstrapAdmins().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});