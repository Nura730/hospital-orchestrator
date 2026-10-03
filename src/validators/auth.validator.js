const { z } = require('zod');
const { USER_TYPES } = require('../config/constants');

const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Valid email address is required'),
    password: z.string().min(1, 'Password is required'),
    userType: z.enum([USER_TYPES.ADMIN, USER_TYPES.DOCTOR, USER_TYPES.OT_MANAGER], {
      errorMap: () => ({ message: 'userType must be admin, doctor, or ot_manager' }),
    }),
  }),
});

const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
  }),
});

module.exports = {
  loginSchema,
  changePasswordSchema,
};
