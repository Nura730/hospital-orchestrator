const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      ok: false,
      data: null,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again after 15 minutes.',
      },
      meta: {
        retryAfterMs: env.RATE_LIMIT_WINDOW_MS,
      },
    });
  },
});

const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      ok: false,
      data: null,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Request limit exceeded. Please slow down your requests.',
      },
      meta: {},
    });
  },
});

module.exports = {
  authLimiter,
  apiLimiter,
};
