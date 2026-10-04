const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const healthRoutes = require('./routes/health.routes');
const errorHandler = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');
const AppError = require('./utils/AppError');

const app = express();

// Security headers
app.use(helmet());

// CORS configuration
const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || (env.NODE_ENV !== 'production' && LOCAL_ORIGIN.test(origin))) {
        return callback(null, true);
      }
      return callback(new AppError('CORS origin not allowed', 403, 'CORS_ERROR'));
    },
    credentials: true,
  })
);

// Request body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP logging in development mode
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Global rate limiting
app.use(apiLimiter);

// Direct top-level health route
app.use('/health', healthRoutes);

// API v1 routes
app.use('/api/v1', routes);

// Catch 404 for unknown endpoints
app.use('*', (req, res, next) => {
  next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
});

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
