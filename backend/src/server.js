const http = require('http');
const app = require('./app');
const env = require('./config/env');
const db = require('./config/db');
const logger = require('./utils/logger');
const { initSockets, getIO } = require('./sockets');
const { registerJobs, stopJobs } = require('./jobs');

const server = http.createServer(app);

// Initialize Socket.IO with server
initSockets(server);

// Register scheduled background tasks
registerJobs();

// Start HTTP server
const PORT = env.PORT || 3001;
server.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      env: env.NODE_ENV,
    },
    `🚀 MediOrchestra Backend is running on port ${PORT}`
  );
});

// Graceful shutdown handler
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ signal }, 'Graceful shutdown initiated. Closing active connections...');

  // Set timeout to force exit if hanging
  const forceExitTimer = setTimeout(() => {
    logger.error('Forced shutdown due to timeout while closing connections');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  // Stop background cron jobs
  stopJobs();

  // Close Socket.IO connections
  const io = getIO();
  if (io) {
    try {
      io.close();
      logger.info('Socket.IO connections closed.');
    } catch (err) {
      logger.error({ err: err.message }, 'Error closing Socket.IO');
    }
  }

  // Close HTTP server
  server.close(async () => {
    logger.info('HTTP server closed.');

    // Close Database Pool
    try {
      await db.pool.end();
      logger.info('Database pool drained and closed.');
    } catch (err) {
      logger.error({ err: err.message }, 'Error closing database pool');
    }

    logger.info('MediOrchestra backend shutdown complete.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'Uncaught Exception detected!');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled Promise Rejection detected!');
  gracefulShutdown('unhandledRejection');
});

module.exports = server;
