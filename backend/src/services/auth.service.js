const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const userRepo = require('../repositories/user.repo');
const doctorRepo = require('../repositories/doctor.repo');
const adminRepo = require('../repositories/admin.repo');
const AppError = require('../utils/AppError');
const { USER_TYPES } = require('../config/constants');

class AuthService {
  /**
   * Authenticate user across any of the 3 user types
   * @param {{ email: string, password: string, userType: string }} credentials
   */
  async login({ email, password, userType }) {
    const user = await userRepo.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.is_active) {
      throw new AppError(
        'Your account has been deactivated. Please contact support.',
        403,
        'ACCOUNT_DEACTIVATED'
      );
    }

    // Strict role check: userType in credentials must match user_type in database
    if (user.user_type !== userType) {
      throw new AppError(
        `Invalid credentials for user type '${userType}'.`,
        401,
        'INVALID_CREDENTIALS'
      );
    }

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
    }

    // Update last login timestamp asynchronously
    await userRepo.updateLastLogin(user.id);

    // Generate JWT token with role and userType embedded
    const token = jwt.sign(
      {
        userId: user.id,
        id: user.id,
        userType: user.user_type,
        role: user.user_type,
        email: user.email,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN }
    );

    // Fetch type-specific profile
    const profile = await this.getProfileByUserType(user.id, user.user_type);

    return {
      token,
      userType: user.user_type,
      user: profile,
    };
  }

  /**
   * Fetch full profile based on user role
   * @param {string} userId
   * @param {string} userType
   */
  async getProfileByUserType(userId, userType) {
    if (userType === USER_TYPES.DOCTOR) {
      const doc = await doctorRepo.findDoctorByUserId(userId);
      if (!doc) throw new AppError('Doctor profile not found', 404, 'PROFILE_NOT_FOUND');
      return doc;
    }

    if (userType === USER_TYPES.ADMIN) {
      const adm = await adminRepo.findProfileByUserId(userId);
      if (!adm) throw new AppError('Admin profile not found', 404, 'PROFILE_NOT_FOUND');
      return adm;
    }

    if (userType === USER_TYPES.OT_MANAGER) {
      const otm = await userRepo.findOtManagerProfile(userId);
      if (!otm) throw new AppError('OT Manager profile not found', 404, 'PROFILE_NOT_FOUND');
      return otm;
    }

    throw new AppError('Unknown user type', 400, 'INVALID_USER_TYPE');
  }

  /**
   * Change user password
   * @param {string} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await userRepo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      throw new AppError('Current password does not match', 400, 'INCORRECT_CURRENT_PASSWORD');
    }

    const newHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
    await userRepo.updatePassword(userId, newHash);

    return { success: true, message: 'Password updated successfully' };
  }
}

module.exports = new AuthService();
