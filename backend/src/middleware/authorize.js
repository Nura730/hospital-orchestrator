const AppError = require('../utils/AppError');

/**
 * Role-based authorization middleware
 * @param  {...string} allowedRoles - e.g. 'admin', 'doctor', 'ot_manager'
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new AppError('Authentication required before authorization.', 401, 'UNAUTHORIZED')
      );
    }

    const currentRole = req.user.userType || req.user.role;
    if (!allowedRoles.includes(currentRole)) {
      return next(
        new AppError(
          `Forbidden: Access restricted to [${allowedRoles.join(', ')}]. Current role: '${currentRole}'`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
}

module.exports = authorize;
