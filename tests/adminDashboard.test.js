const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');

jest.mock('../src/config/db');

describe('Hospital Admin Dashboard Endpoints', () => {
  const adminId = '22222222-2222-2222-2222-222222222222';
  const doctorId = '11111111-1111-1111-1111-111111111111';
  let adminToken;
  let doctorToken;

  beforeAll(() => {
    adminToken = jwt.sign(
      { userId: adminId, id: adminId, userType: 'admin', role: 'admin', email: 'admin@hospital.com' },
      env.JWT_SECRET
    );
    doctorToken = jwt.sign(
      { userId: doctorId, id: doctorId, userType: 'doctor', role: 'doctor', email: 'doctor@hospital.com' },
      env.JWT_SECRET
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should deny non-admin users from accessing /admin/dashboard with 403 Forbidden', async () => {
    // Auth middleware user query
    db.query.mockImplementation((text) => {
      if (text.includes('SELECT id, email, user_type, full_name, is_active FROM users WHERE id = $1')) {
        return Promise.resolve({
          rows: [{ id: doctorId, email: 'doctor@hospital.com', user_type: 'doctor', full_name: 'Dr. Arjun', is_active: true }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${doctorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should return aggregated master dashboard data for Admin with 200 OK', async () => {
    db.query.mockImplementation((text) => {
      if (text.includes('SELECT id, email, user_type, full_name, is_active FROM users WHERE id = $1')) {
        return Promise.resolve({
          rows: [{ id: adminId, email: 'admin@hospital.com', user_type: 'admin', full_name: 'Sarah Admin', is_active: true }],
        });
      }
      if (text.includes('FROM patients') && text.includes('total_patients')) {
        return Promise.resolve({
          rows: [{
            total_patients: 30,
            waiting_patients: 4,
            admitted_patients: 20,
            critical_patients: 4,
            in_surgery_patients: 2,
            discharged_today: 1,
            avg_wait_min: '22.50',
          }],
        });
      }
      if (text.includes('FROM beds') && text.includes('total_beds')) {
        return Promise.resolve({
          rows: [{
            total_beds: 75,
            occupied_beds: 58,
            available_beds: 17,
            cleaning_beds: 0,
            icu_total: 12,
            icu_occupied: 11,
            icu_available: 1,
            hdu_total: 8,
            hdu_occupied: 6,
          }],
        });
      }
      if (text.includes('FROM doctors d') && text.includes('total_doctors')) {
        return Promise.resolve({
          rows: [{
            total_doctors: 12,
            doctors_available: 7,
            doctors_in_surgery: 3,
            doctors_in_consultation: 1,
            doctors_off_duty: 1,
          }],
        });
      }
      if (text.includes('FROM ot_rooms') && text.includes('ot_rooms_total')) {
        return Promise.resolve({
          rows: [{
            ot_rooms_total: 4,
            ot_in_progress: 2,
            ot_available: 1,
            ot_cleaning: 1,
          }],
        });
      }
      if (text.includes('FROM ot_cases') && text.includes('today_ot_cases')) {
        return Promise.resolve({
          rows: [{ today_ot_cases: 8, completed_ot_cases: 4 }],
        });
      }
      if (text.includes('FROM equipment') && text.includes('total_equipment')) {
        return Promise.resolve({
          rows: [{ total_equipment: 20, equipment_available: 14, equipment_fault: 1 }],
        });
      }
      if (text.includes('FROM alerts') && text.includes('open_alerts')) {
        return Promise.resolve({
          rows: [{ open_alerts: 5, critical_alerts: 2 }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.overview).toBeDefined();
    expect(res.body.data.overview.totalPatients).toBe(30);
    expect(res.body.data.overview.totalBeds).toBe(75);
    expect(res.body.data.overview.bedOccupancyPct).toBe(77.33);
    expect(res.body.data.overview.icuOccupancyPct).toBe(91.67);
  });
});
