const { Pool } = require('pg');
const env = require('./env');

const isSslRequired =
  env.DATABASE_URL.includes('sslmode=require') ||
  env.DATABASE_URL.includes('neon.tech') ||
  env.NODE_ENV === 'production';

const poolConfig = {
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

if (isSslRequired) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

/**
 * Execute a single query on the pool
 * @param {string} text
 * @param {Array} params
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.DEBUG_SQL === 'true') {
    // eslint-disable-next-line no-console
    console.debug('Executed query', { text, duration, rows: res.rowCount });
  }
  return res;
}

/**
 * Execute a series of operations in a transaction
 * @param {Function} callback - Function that accepts a client and performs queries
 * @returns {Promise<any>}
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Health check helper for database connection
 * @returns {Promise<boolean>}
 */
async function checkHealth() {
  try {
    const res = await pool.query('SELECT 1 AS ok');
    return res.rows[0].ok === 1;
  } catch {
    return false;
  }
}

module.exports = {
  pool,
  query,
  withTransaction,
  checkHealth,
};
