const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');

jest.mock('../src/config/db');

describe('OT Management & Assignment Endpoints', () => {
  const otManagerId = '33333333-3333-3333-3333-333333333333';
  const surgeonId = '11111111-1111-1111-1111-111111111111';
  const patientId = '44444444-4444-4444-4444-444444444444';
  let otManagerToken;

  beforeAll(() => {
    otManagerToken = jwt.sign(
      { userId: otManagerId, id: otManagerId, userType: 'ot_manager', role: 'ot_manager', email: 'otm@hospital.com' },
      env.JWT_SECRET
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return available doctors for OT scheduling', async () => {
    db.query.mockImplementation((text) => {
      if (text.includes('SELECT id, email, user_type, full_name, is_active FROM users WHERE id = $1')) {
        return Promise.resolve({
          rows: [{ id: otManagerId, email: 'otm@hospital.com', user_type: 'ot_manager', full_name: 'Marcus Vance', is_active: true }],
        });
      }
      if (text.includes('FROM doctors d') && text.includes('WHERE u.is_active = TRUE')) {
        return Promise.resolve({
          rows: [
            {
              doctorId: surgeonId,
              name: 'Dr. Arjun Menon',
              specialization: 'Cardiology',
              status: 'available',
              currentLocation: 'Cardiology OPD',
              todaySurgeries: 1,
              maxSurgeriesDay: 4,
              isOnCall: false,
              nextAvailableAt: null,
              qualifications: ['MBBS', 'MD', 'DM'],
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .get('/api/v1/ot/available-doctors?specialization=Cardiology')
      .set('Authorization', `Bearer ${otManagerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Dr. Arjun Menon');
    expect(res.body.data[0].status).toBe('available');
  });

  it('should return 409 Conflict if scheduled OT room has overlap', async () => {
    db.query.mockImplementation((text) => {
      if (text.includes('SELECT id, email, user_type, full_name, is_active FROM users WHERE id = $1')) {
        return Promise.resolve({
          rows: [{ id: otManagerId, email: 'otm@hospital.com', user_type: 'ot_manager', full_name: 'Marcus Vance', is_active: true }],
        });
      }
      if (text.includes('FROM patients p') && (text.includes('p.id::text = $1') || text.includes('p.patient_id = $1'))) {
        return Promise.resolve({
          rows: [{ id: patientId, patient_id: 'P2024001', full_name: 'Rajan Kumar' }],
        });
      }
      if (text.includes('FROM ot_cases') && text.includes('WHERE ot_room_id = $1')) {
        // Overlap detected!
        return Promise.resolve({
          rows: [{ id: '99999999-9999-9999-9999-999999999999', case_number: 'OTC-2024-001' }],
        });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await request(app)
      .post('/api/v1/ot/cases')
      .set('Authorization', `Bearer ${otManagerToken}`)
      .send({
        patientId,
        otRoomId: 1,
        primarySurgeonId: surgeonId,
        procedureName: 'Coronary Artery Bypass',
        scheduledStart: '2024-01-15T08:00:00.000Z',
        scheduledEnd: '2024-01-15T12:00:00.000Z',
      });

    expect(res.status).toBe(409);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('ROOM_CONFLICT');
  });
});
