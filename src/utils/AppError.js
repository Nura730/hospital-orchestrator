/**
 * Custom application error class for standard operational errors
 */
class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code (default: 500)
   * @param {string} code - Machine-readable error code (e.g. 'VALIDATION_ERROR', 'NOT_FOUND')
   * @param {any} details - Additional structured details/field errors
   */
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
