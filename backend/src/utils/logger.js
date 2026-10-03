const pino = require('pino');
const env = require('../config/env');

const isDev = env.NODE_ENV === 'development';

const logger = pino({
  level: env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'password',
      'passwordHash',
      'password_hash',
      'currentPassword',
      'newPassword',
      'token',
      'authorization',
      'req.headers.authorization',
      'req.headers.cookie',
      'phone',
      'emergency_contact',
      'emergencyContact',
      'insurance_id',
      'insuranceId',
      'address',
    ],
    censor: '[REDACTED]',
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});

module.exports = logger;
