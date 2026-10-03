const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');
const logger = require('../src/utils/logger');

async function reset() {
  logger.info('Resetting database: dropping all tables and types...');

  const dropScript = `
    DROP TRIGGER IF EXISTS trg_ot_cases_updated ON ot_cases;
    DROP TRIGGER IF EXISTS trg_beds_updated ON beds;
    DROP TRIGGER IF EXISTS trg_patients_updated ON patients;
    DROP TRIGGER IF EXISTS trg_doctors_updated ON doctors;
    DROP TRIGGER IF EXISTS trg_users_updated ON users;
    DROP FUNCTION IF EXISTS set_updated_at CASCADE;

    DROP TABLE IF EXISTS ot_requests CASCADE;
    DROP TABLE IF EXISTS kpi_snapshots CASCADE;
    DROP TABLE IF EXISTS audit_log CASCADE;
    DROP TABLE IF EXISTS patient_timeline CASCADE;
    DROP TABLE IF EXISTS doctor_ot_assignments CASCADE;
    DROP TABLE IF EXISTS notifications CASCADE;
    DROP TABLE IF EXISTS alerts CASCADE;
    DROP TABLE IF EXISTS equipment CASCADE;
    DROP TABLE IF EXISTS ot_cases CASCADE;
    DROP TABLE IF EXISTS ot_rooms CASCADE;
    DROP TABLE IF EXISTS beds CASCADE;
    DROP TABLE IF EXISTS patients CASCADE;
    DROP TABLE IF EXISTS ot_managers CASCADE;
    DROP TABLE IF EXISTS admin_profiles CASCADE;
    DROP TABLE IF EXISTS doctors CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS departments CASCADE;

    DROP TYPE IF EXISTS notification_type CASCADE;
    DROP TYPE IF EXISTS alert_status CASCADE;
    DROP TYPE IF EXISTS alert_severity CASCADE;
    DROP TYPE IF EXISTS equipment_status CASCADE;
    DROP TYPE IF EXISTS case_urgency CASCADE;
    DROP TYPE IF EXISTS ot_case_status CASCADE;
    DROP TYPE IF EXISTS ot_room_status CASCADE;
    DROP TYPE IF EXISTS bed_status CASCADE;
    DROP TYPE IF EXISTS bed_type CASCADE;
    DROP TYPE IF EXISTS patient_status CASCADE;
    DROP TYPE IF EXISTS doctor_status CASCADE;
    DROP TYPE IF EXISTS user_type CASCADE;
  `;

  try {
    await db.query(dropScript);
    logger.info('All tables and types dropped.');

    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await db.query(sql);
    logger.info('✅ Database schema recreated successfully.');
  } catch (err) {
    logger.error({ err: err.message }, '❌ Failed to reset database.');
    throw err;
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  reset().catch(() => process.exit(1));
}

module.exports = { reset };
