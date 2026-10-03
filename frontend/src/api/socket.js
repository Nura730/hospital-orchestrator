/**
 * @file socket.js
 * Unified real-time communication layer.
 * Exposes an identical interface for both real Socket.IO connections and the simulated mock liveEmitter:
 * - connect()
 * - disconnect()
 * - on(event, callback)
 * - off(event, callback)
 * - emit(event, data)
 * - isConnected()
 */

import { io } from 'socket.io-client';
import { liveEmitter } from './mock/liveEmitter.js';

const isMock = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_MOCK !== undefined)
  ? import.meta.env.VITE_USE_MOCK !== 'false'
  : true;
const socketUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SOCKET_URL)
  ? import.meta.env.VITE_SOCKET_URL
  : 'http://localhost:3001';

class HospitalSocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.statusListeners = new Set();
    this.eventListeners = new Map();
  }

  /**
   * Register a connection status listener (true = connected, false = disconnected).
   */
  onStatusChange(callback) {
    this.statusListeners.add(callback);
    callback(this.connected);
    return () => this.statusListeners.delete(callback);
  }

  notifyStatus(status) {
    this.connected = status;
    this.statusListeners.forEach((cb) => {
      try {
        cb(status);
      } catch (e) {
        console.error('[Socket status listener error]:', e);
      }
    });
  }

  /**
   * Connect to real-time events.
   */
  connect(token) {
    if (isMock) {
      if (!this.connected) {
        liveEmitter.start();
        this.notifyStatus(true);
        console.info('[Socket] Simulated live emitter connected');
      }
      return;
    }

    // Real Socket.IO connection
    if (this.socket && this.socket.connected) return;

    this.socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      console.info('[Socket] Real socket connected to', socketUrl);
      this.notifyStatus(true);
    });

    this.socket.on('disconnect', () => {
      console.warn('[Socket] Disconnected from server');
      this.notifyStatus(false);
    });

    this.socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      this.notifyStatus(false);
    });

    // Reattach any registered listeners
    this.eventListeners.forEach((callbacks, event) => {
      callbacks.forEach((cb) => {
        this.socket.on(event, cb);
      });
    });
  }

  /**
   * Disconnect from real-time events.
   */
  disconnect() {
    if (isMock) {
      liveEmitter.stop();
      this.notifyStatus(false);
      console.info('[Socket] Simulated live emitter stopped');
      return;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.notifyStatus(false);
    }
  }

  /**
   * Subscribe to event.
   */
  on(event, callback) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event).add(callback);

    if (isMock) {
      return liveEmitter.on(event, callback);
    }

    if (this.socket) {
      this.socket.on(event, callback);
    }

    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from event.
   */
  off(event, callback) {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event).delete(callback);
    }

    if (isMock) {
      liveEmitter.off(event, callback);
      return;
    }

    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Emit client event to server / mock bus.
   */
  emit(event, data) {
    if (isMock) {
      liveEmitter.emit(event, data);
      return;
    }

    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
    }
  }

  /**
   * Connection status check.
   */
  isConnected() {
    return this.connected;
  }
}

export const socketClient = new HospitalSocketClient();
export default socketClient;
