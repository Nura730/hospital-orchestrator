const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');
const logger = require('../src/utils/logger');

async function run() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  logger.info('Applying database schema from db/schema.sql...');
  try {
    await db.query(sql);
    logger.info('✅ Database schema applied successfully.');
  } catch (err) {
    logger.error({ err: err.message }, '❌ Failed to apply database schema.');
    throw err;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  run().catch(() => process.exit(1));
}

module.exports = { run };
