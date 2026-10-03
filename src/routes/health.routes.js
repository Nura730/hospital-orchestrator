const { Router } = require('express');
const { checkHealth } = require('../config/db');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const isDbConnected = await checkHealth();
    return ok(res, {
      status: 'healthy',
      db: isDbConnected ? 'ok' : 'error',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  })
);

module.exports = router;
