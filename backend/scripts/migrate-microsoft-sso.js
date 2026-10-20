require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

(async () => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(__dirname, '../migrations/010_microsoft_sso.sql'), 'utf8'));
    await client.query('COMMIT');
    console.log('Migración de inicio de sesión Microsoft aplicada.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await db.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
