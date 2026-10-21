require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');
(async () => {
  const sql = [
    fs.readFileSync(path.join(__dirname, '../migrations/008_enterprise_helpdesk.sql'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../migrations/011_fix_activos_id_sequence.sql'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../migrations/012_delivery_evidence.sql'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../migrations/013_delivery_asset_links.sql'), 'utf8')
  ].join('\n');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
  console.log('Migración empresarial aplicada.');
  await db.end();
})().catch(error => { console.error(error); process.exitCode = 1; });
