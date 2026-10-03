const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const db = require('../src/config/db');
const env = require('../src/config/env');

jest.mock('../src/config/db');

describe('Auth Endpoints (/api/v1/auth)', () => {
  const dummyPassword = 'Password@123';
  let passwordHash;
  const doctorId = '11111111-1111-1111-1111-111111111111';
  const adminId = '22222222-2222-2222-2222-222222222222';
  const otManagerId = '33333333-3333-3333-3333-333333333333';

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(dummyPassword, 8);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login Doctor successfully and return doctor specific profile', async () => {
      // Mock findByEmail
      db.query.mockImplementation((text, params) => {
        if (text.includes('FROM users WHERE email = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: doctorId,
                email: 'doctor@hospital.com',
                password_hash: passwordHash,
                user_type: 'doctor',
                full_name: 'Dr. Arjun Menon',
                is_active: true,
              },
            ],
          });
        }
        if (text.includes('UPDATE users SET last_login')) {
          return Promise.resolve({ rows: [] });
        }
        if (text.includes('FROM doctors d')) {
          return Promise.resolve({
            rows: [
              {
                id: doctorId,
                email: 'doctor@hospital.com',
                fullName: 'Dr. Arjun Menon',
                specialization: 'Cardiology',
                department: 'Cardiology',
                status: 'available',
                employeeId: 'DR-2024-001',
                todaySurgeries: 1,
                maxSurgeriesDay: 4,
                shiftEnd: '20:00:00',
                unreadNotifications: 2,
              },
            ],
          });
        }
        if (text.includes('INSERT INTO audit_log')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'doctor@hospital.com',
          password: dummyPassword,
          userType: 'doctor',
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.userType).toBe('doctor');
      expect(res.body.data.user.specialization).toBe('Cardiology');
      expect(res.body.data.user.employeeId).toBe('DR-2024-001');
    });

    it('should login Hospital Admin successfully and return admin profile', async () => {
      db.query.mockImplementation((text) => {
        if (text.includes('FROM users WHERE email = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: adminId,
                email: 'admin@hospital.com',
                password_hash: passwordHash,
                user_type: 'admin',
                full_name: 'Sarah Jenkins',
                is_active: true,
              },
            ],
          });
        }
        if (text.includes('FROM users u') && text.includes('admin_profiles ap')) {
          return Promise.resolve({
            rows: [
              {
                id: adminId,
                email: 'admin@hospital.com',
                full_name: 'Sarah Jenkins',
                employee_id: 'ADM-001',
                designation: 'Medical Director',
                permissions: { all: true },
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'admin@hospital.com',
          password: dummyPassword,
          userType: 'admin',
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.userType).toBe('admin');
      expect(res.body.data.user.designation).toBe('Medical Director');
    });

    it('should login OT Manager successfully', async () => {
      db.query.mockImplementation((text) => {
        if (text.includes('FROM users WHERE email = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: otManagerId,
                email: 'otmanager@hospital.com',
                password_hash: passwordHash,
                user_type: 'ot_manager',
                full_name: 'Marcus Vance',
                is_active: true,
              },
            ],
          });
        }
        if (text.includes('FROM users u') && text.includes('ot_managers otm')) {
          return Promise.resolve({
            rows: [
              {
                id: otManagerId,
                email: 'otmanager@hospital.com',
                fullName: 'Marcus Vance',
                employeeId: 'OTM-001',
                assignedOtIds: [1, 2, 3, 4],
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'otmanager@hospital.com',
          password: dummyPassword,
          userType: 'ot_manager',
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.userType).toBe('ot_manager');
      expect(res.body.data.user.employeeId).toBe('OTM-001');
    });

    it('should return 401 when password is incorrect', async () => {
      db.query.mockImplementation((text) => {
        if (text.includes('FROM users WHERE email = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: doctorId,
                email: 'doctor@hospital.com',
                password_hash: passwordHash,
                user_type: 'doctor',
                is_active: true,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'doctor@hospital.com',
          password: 'WrongPassword!',
          userType: 'doctor',
        });

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 when userType does not match account role', async () => {
      db.query.mockImplementation((text) => {
        if (text.includes('FROM users WHERE email = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: doctorId,
                email: 'doctor@hospital.com',
                password_hash: passwordHash,
                user_type: 'doctor',
                is_active: true,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'doctor@hospital.com',
          password: dummyPassword,
          userType: 'admin', // Mismatch! User is doctor
        });

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return doctor profile when authenticated as doctor', async () => {
      const token = jwt.sign(
        { userId: doctorId, id: doctorId, userType: 'doctor', email: 'doctor@hospital.com' },
        env.JWT_SECRET
      );

      db.query.mockImplementation((text) => {
        if (text.includes('SELECT id, email, user_type, full_name, is_active FROM users WHERE id = $1')) {
          return Promise.resolve({
            rows: [
              {
                id: doctorId,
                email: 'doctor@hospital.com',
                user_type: 'doctor',
                full_name: 'Dr. Arjun Menon',
                is_active: true,
              },
            ],
          });
        }
        if (text.includes('FROM doctors d')) {
          return Promise.resolve({
            rows: [
              {
                id: doctorId,
                fullName: 'Dr. Arjun Menon',
                specialization: 'Cardiology',
                status: 'available',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.fullName).toBe('Dr. Arjun Menon');
      expect(res.body.data.specialization).toBe('Cardiology');
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
    });
  });
});
