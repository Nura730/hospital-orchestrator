const dotenv = require('dotenv');
const { z } = require('zod');

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  SOCKET_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 mins
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().default(10),
  SIMULATOR: z.preprocess((val) => val === true || val === 'true', z.boolean().default(true)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  BCRYPT_ROUNDS: z.coerce.number().default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ FATAL: Invalid or missing environment configuration:');
  // eslint-disable-next-line no-console
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

module.exports = parsed.data;
