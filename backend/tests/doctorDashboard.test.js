const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');

jest.mock('../src/config/db');

describe('Doctor Dashboard & Patient Isolation Endpoints', () => {
  const doctor1Id = '11111111-1111-1111-1111-111111111111';
  const doctor2Id = '22222222-2222-2222-2222-222222222222';
  const patient1Id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  let doctor1Token;

  beforeAll(() => {
    doctor1Token = jwt.sign(
      { userId: doctor1Id, id: doctor1Id, userType: 'doctor', role: 'doctor', email: 'doctor1@hospital.com' },
      env.JWT_SECRET
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return doctor dashboard with isolated profile, patients, and schedule', async () => {
    db.query.mockImplementation((text, params) => {
      if (text.includes('SELECT id, email, user_type, full_name, is_active FROM users WHERE id = $1')) {
        return Promise.resolve({
          rows: [{ id: doctor1Id, email: 'doctor1@hospital.com', user_type: 'doctor', full_name: 'Dr. Arjun', is_active: true }],
        });
      }
      if (text.includes('FROM doctors d') && text.includes('WHERE d.id = $1')) {
        return Promise.resolve({
          rows: [{
            id: doctor1Id,
            fullName: 'Dr. Arjun Menon',
            specialization: 'Cardiology',
            department: 'ICU',
            status: 'available',
            consultationRoom: 'CR-101',
            shiftEnd: '20:00:00',
            surgeriesToday: 1,
            maxSurgeriesDay: 4,
          }],
        });
      }
      if (text.includes('SELECT COUNT(*)::int AS total FROM patients p WHERE p.assigned_doctor_id = $1')) {
        return Promise.resolve({ rows: [{ total: 3 }] });
      }
      if (text.includes('FROM patients p') && text.includes('p.assigned_doctor_id = $1')) {
        return Promise.resolve({
          rows: [
            {
              id: patient1Id,
              patientId: 'P2024001',
              fullName: 'Patient One',
              age: 55,
              status: 'admitted',
              acuity: 2,
              bedId: 'GW-01',
              diagnosis: 'Hypertension',
              requiresOt: false,
            },
          ],
        });
      }
      if (text.includes('FROM notifications')) {
        return Promise.resolve({ rows: [] });
      }
      if (text.includes('SELECT COUNT(*)::int AS unread FROM notifications')) {
        return Promise.resolve({ rows: [{ unread: 0 }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/v1/doctor/dashboard')
      .set('Authorization', `Bearer ${doctor1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.profile.name).toBe('Dr. Arjun Menon');
    expect(res.body.data.myPatients).toHaveLength(1);
    expect(res.body.data.myPatients[0].name).toBe('Patient One');
  });

  it('should block Doctor 1 from accessing details of patient assigned to Doctor 2 (Strict Isolation)', async () => {
    db.query.mockImplementation((text) => {
      if (text.includes('SELECT id, email, user_type, full_name, is_active FROM users WHERE id = $1')) {
        return Promise.resolve({
          rows: [{ id: doctor1Id, email: 'doctor1@hospital.com', user_type: 'doctor', full_name: 'Dr. Arjun', is_active: true }],
        });
      }
      if (text.includes('FROM patients p') && (text.includes('p.id::text = $1') || text.includes('p.patient_id = $1'))) {
        // Patient belongs to doctor2Id!
        return Promise.resolve({
          rows: [
            {
              id: patient1Id,
              patientId: 'P2024002',
              fullName: 'Confidential Patient',
              assignedDoctorId: doctor2Id, // NOT doctor1Id
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get(`/api/v1/doctor/my-patients/${patient1Id}`)
      .set('Authorization', `Bearer ${doctor1Token}`);

    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN_PATIENT_ACCESS');
  });
});
