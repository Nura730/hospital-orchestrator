const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const logger = require('../utils/logger');

let io = null;

/**
 * Initialize Socket.IO server with authentication and role-based room subscriptions
 * @param {import('http').Server} httpServer
 * @returns {Server}
 */
function initSockets(httpServer) {
  const allowedOrigins = env.SOCKET_ORIGINS.split(',').map((s) => s.trim());

  io = new Server(httpServer, {
    cors: {
      // Same rule as the REST API: listed origins, plus any localhost port outside production
      origin: (origin, cb) =>
        cb(
          null,
          !origin ||
            allowedOrigins.includes('*') ||
            allowedOrigins.includes(origin) ||
            (env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
        ),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication handshake middleware
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.split(' ')[1]
          : null);

      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.user = {
        id: decoded.userId || decoded.id,
        userType: decoded.userType,
        email: decoded.email,
      };

      return next();
    } catch (err) {
      logger.warn({ err: err.message }, 'Socket.IO handshake authentication failed');
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  // Client connection handler
  io.on('connection', (socket) => {
    const user = socket.user;
    logger.info(
      { socketId: socket.id, userId: user?.id, userType: user?.userType },
      'Socket client connected'
    );

    if (user) {
      // Join personal user room
      socket.join(`user-${user.id}`);

      // Join role-specific rooms
      if (user.userType === 'admin') {
        socket.join('admin');
      } else if (user.userType === 'ot_manager') {
        socket.join('ot_manager');
      } else if (user.userType === 'doctor') {
        socket.join('doctor');
        socket.join(`doctor-${user.id}`);
      }
    }

    socket.on('disconnect', (reason) => {
      logger.info({ socketId: socket.id, reason }, 'Socket client disconnected');
    });
  });

  return io;
}

/**
 * Get active Socket.IO server instance
 * @returns {Server}
 */
function getIO() {
  if (!io) {
    logger.warn('Socket.IO accessed before initialization');
  }
  return io;
}

module.exports = {
  initSockets,
  getIO,
};
