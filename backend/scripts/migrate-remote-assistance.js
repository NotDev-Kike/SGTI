const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL no está configurada.');
  process.exit(1);
}

const migrationPath = path.join(__dirname, '..', 'migrations', '007_remote_assistance.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const client = new Client({ connectionString });

client.connect()
  .then(() => client.query('BEGIN'))
  .then(() => client.query(migrationSql))
  .then(() => client.query('COMMIT'))
  .then(() => console.log('Migración de asistencia remota aplicada correctamente.'))
  .catch(async error => {
    await client.query('ROLLBACK').catch(() => {});
    console.error('No se pudo aplicar la migración de asistencia remota:', error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
