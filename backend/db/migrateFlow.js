const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');
const logger = require('../src/utils/logger');

/**
 * Applies the additive Predictive Flow Intelligence migration.
 * @param {{ keepPoolOpen?: boolean }} options
 */
async function run({ keepPoolOpen = false } = {}) {
  const sqlPath = path.join(__dirname, 'migrations', '001_flow_intelligence.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  logger.info('Applying flow intelligence migration...');
  try {
    await db.query(sql);
    logger.info('✅ Flow intelligence migration applied.');
  } catch (err) {
    logger.error({ err: err.message }, '❌ Flow intelligence migration failed.');
    throw err;
  } finally {
    if (!keepPoolOpen) await db.pool.end();
  }
}

if (require.main === module) {
  run().catch(() => process.exit(1));
}

module.exports = { run };
