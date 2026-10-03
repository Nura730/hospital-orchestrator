const authService = require('../services/auth.service');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const { auditLog } = require('../middleware/audit');

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);

  // Record audit log for login
  await auditLog({
    userId: result.user.id,
    username: result.user.fullName || result.user.email,
    userType: result.userType,
    action: 'USER_LOGIN',
    target: 'auth',
    targetId: result.user.id,
    ip: req.ip,
  });

  return ok(res, result);
});

const logout = asyncHandler(async (req, res) => {
  if (req.user) {
    await auditLog({
      userId: req.user.id,
      username: req.user.fullName || req.user.email,
      userType: req.user.userType,
      action: 'USER_LOGOUT',
      target: 'auth',
      targetId: req.user.id,
      ip: req.ip,
    });
  }

  return ok(res, { message: 'Successfully logged out.' });
});

const getMe = asyncHandler(async (req, res) => {
  const profile = await authService.getProfileByUserType(req.user.id, req.user.userType);
  return ok(res, profile);
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const result = await authService.changePassword(req.user.id, currentPassword, newPassword);

  await auditLog({
    userId: req.user.id,
    username: req.user.fullName || req.user.email,
    userType: req.user.userType,
    action: 'PASSWORD_CHANGED',
    target: 'users',
    targetId: req.user.id,
    ip: req.ip,
  });

  return ok(res, result);
});

module.exports = {
  login,
  logout,
  getMe,
  changePassword,
};
