const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL no está configurada.');
  process.exit(1);
}

const migrationPaths = [
  path.join(__dirname, '..', 'migrations', '003_helpdesk_catalog_inventory.sql'),
  path.join(__dirname, '..', 'migrations', '004_infrastructure_deliveries.sql')
];
const migrationSql = migrationPaths.map(migrationPath => fs.readFileSync(migrationPath, 'utf8')).join('\n');
const client = new Client({ connectionString });

client.connect()
  .then(() => client.query(migrationSql))
  .then(() => console.log('Migraciones de categorías, inventario y entregas aplicadas correctamente en PostgreSQL.'))
  .catch(error => {
    console.error('No se pudo aplicar la migración:', error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
