/**
 * Sends a standardized success envelope response
 * @param {import('express').Response} res
 * @param {any} data
 * @param {object} meta
 * @param {number} statusCode
 */
function ok(res, data = null, meta = {}, statusCode = 200) {
  return res.status(statusCode).json({
    ok: true,
    data,
    error: null,
    meta,
  });
}

/**
 * Sends a standardized error envelope response
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} code
 * @param {string} message
 * @param {any} details
 * @param {object} meta
 */
function fail(
  res,
  statusCode = 500,
  code = 'ERROR',
  message = 'An error occurred',
  details = null,
  meta = {}
) {
  return res.status(statusCode).json({
    ok: false,
    data: null,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    meta,
  });
}

module.exports = {
  ok,
  fail,
};
