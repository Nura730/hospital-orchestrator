const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimit');
const { loginSchema, changePasswordSchema } = require('../validators/auth.validator');

const router = Router();

// Public routes with strict authentication rate limiter
router.post('/login', authLimiter, validate(loginSchema), authController.login);

// Protected routes (any authenticated user)
router.post('/logout', auth, authController.logout);
router.get('/me', auth, authController.getMe);
router.patch(
  '/change-password',
  auth,
  validate(changePasswordSchema),
  authController.changePassword
);

module.exports = router;
