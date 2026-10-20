const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: String(process.env.DATABASE_SSL || 'true').toLowerCase() === 'false'
    ? false
    : { rejectUnauthorized: false },
  max: Number(process.env.DATABASE_POOL_MAX || 10),
});

pool.on('connect', () => {
  console.log('Base de datos conectada exitosamente a PostgreSQL');
});

module.exports = pool;
