const db = require('../config/db');

/**
 * Base repository with common generic database utilities
 */
class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
  }

  /**
   * Find record by ID
   * @param {string|number} id
   * @param {object} [client] - Optional transactional client
   */
  async findById(id, client = null) {
    const executor = client || db;
    const res = await executor.query(`SELECT * FROM ${this.tableName} WHERE id = $1 LIMIT 1`, [id]);
    return res.rows[0] || null;
  }

  /**
   * Delete record by ID
   * @param {string|number} id
   * @param {object} [client]
   */
  async deleteById(id, client = null) {
    const executor = client || db;
    const res = await executor.query(`DELETE FROM ${this.tableName} WHERE id = $1 RETURNING *`, [
      id,
    ]);
    return res.rows[0] || null;
  }

  /**
   * Count records matching basic conditions
   * @param {string} whereClause
   * @param {Array} params
   * @param {object} [client]
   */
  async count(whereClause = '1=1', params = [], client = null) {
    const executor = client || db;
    const res = await executor.query(
      `SELECT COUNT(*)::int AS count FROM ${this.tableName} WHERE ${whereClause}`,
      params
    );
    return res.rows[0].count;
  }
}

module.exports = BaseRepository;
