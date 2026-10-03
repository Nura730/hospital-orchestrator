/**
 * Wraps an async route handler or middleware to catch errors and pass them to next()
 * @param {Function} fn
 * @returns {import('express').RequestHandler}
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
