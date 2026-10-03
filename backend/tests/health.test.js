const request = require('supertest');
const app = require('../src/app');
const db = require('../src/config/db');

jest.mock('../src/config/db');

describe('Health Check Endpoint', () => {
  it('GET /health should return 200 with status healthy and db ok', async () => {
    db.checkHealth.mockResolvedValue(true);

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.db).toBe('ok');
    expect(res.body.data.uptime).toBeDefined();
    expect(res.body.data.timestamp).toBeDefined();
  });

  it('GET /api/v1/health should also return 200', async () => {
    db.checkHealth.mockResolvedValue(true);

    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.status).toBe('healthy');
  });
});
