const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL no está configurada.');
  process.exit(1);
}

const migrationPath = path.join(__dirname, '..', 'migrations', '003_helpdesk_catalog_inventory.sql');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');
const client = new Client({ connectionString });

client.connect()
  .then(() => client.query(migrationSql))
  .then(() => console.log('Migración de categorías e inventario aplicada correctamente en PostgreSQL.'))
  .catch(error => {
    console.error('No se pudo aplicar la migración:', error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
