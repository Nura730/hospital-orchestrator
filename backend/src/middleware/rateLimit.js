const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  // Only failed logins count, so staff signing in on several devices are not locked out
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      ok: false,
      data: null,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many failed sign-in attempts. Please try again in ${Math.ceil(env.RATE_LIMIT_WINDOW_MS / 60000)} minutes.`,
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
