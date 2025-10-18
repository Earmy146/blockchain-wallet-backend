/**
 * User Controller - Xử lý các request liên quan đến user
 * File: backend/src/controllers/user.controller.js
 */

const User = require('../models/user.model');
const { generateToken } = require('../middlewares/auth.middleware');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const ERROR_MESSAGES = require('../constants/errorMessages');

/**
 * @desc    Đăng ký user mới
 * @route   POST /api/users/register
 * @access  Public
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, username } = req.body;

  // Kiểm tra email đã tồn tại chưa
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    throw new AppError(ERROR_MESSAGES.AUTH.USER_EXISTS, 400);
  }

  // Tạo user mới
  const user = await User.create({
    email,
    password, // Sẽ được hash tự động bởi pre-save middleware
    username: username || email.split('@')[0]
  });

  // Generate JWT token
  const token = generateToken(user._id);

  logger.info(`New user registered: ${email}`);

  sendSuccess(res, {
    user: {
      id: user._id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt
    },
    token
  }, 'Đăng ký thành công', 201);
});

/**
 * @desc    Đăng nhập
 * @route   POST /api/users/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Tìm user (bao gồm password để so sánh)
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new AppError(ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS, 401);
  }

  // Kiểm tra password
  const isPasswordCorrect = await user.comparePassword(password);

  if (!isPasswordCorrect) {
    throw new AppError(ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS, 401);
  }

  // Kiểm tra tài khoản có active không
  if (!user.isActive) {
    throw new AppError('Tài khoản đã bị vô hiệu hóa', 403);
  }

  // Cập nhật lastLogin
  await user.updateLastLogin();

  // Generate token
  const token = generateToken(user._id);

  logger.info(`User logged in: ${email}`);

  sendSuccess(res, {
    user: {
      id: user._id,
      email: user.email,
      username: user.username,
      lastLogin: user.lastLogin
    },
    token
  }, 'Đăng nhập thành công');
});

/**
 * @desc    Lấy thông tin user hiện tại
 * @route   GET /api/users/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res) => {
  // req.user đã được attach bởi auth middleware
  const user = await User.findById(req.user._id)
    .populate({
      path: 'wallet',
      select: 'address network balance createdAt'
    });

  if (!user) {
    throw new AppError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND, 404);
  }

  sendSuccess(res, {
    user: {
      id: user._id,
      email: user.email,
      username: user.username,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      wallet: user.wallet || null
    }
  });
});

/**
 * @desc    Cập nhật thông tin user
 * @route   PUT /api/users/me
 * @access  Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { username } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND, 404);
  }

  // Cập nhật username nếu có
  if (username) {
    user.username = username;
  }

  await user.save();

  logger.info(`User profile updated: ${user.email}`);

  sendSuccess(res, {
    user: {
      id: user._id,
      email: user.email,
      username: user.username,
      updatedAt: user.updatedAt
    }
  }, 'Cập nhật thông tin thành công');
});

/**
 * @desc    Đổi mật khẩu
 * @route   PUT /api/users/change-password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Lấy user với password
  const user = await User.findById(req.user._id).select('+password');

  if (!user) {
    throw new AppError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND, 404);
  }

  // Verify current password
  const isPasswordCorrect = await user.comparePassword(currentPassword);

  if (!isPasswordCorrect) {
    throw new AppError('Mật khẩu hiện tại không đúng', 401);
  }

  // Cập nhật password mới
  user.password = newPassword; // Sẽ được hash tự động
  await user.save();

  logger.info(`Password changed for user: ${user.email}`);

  sendSuccess(res, null, 'Đổi mật khẩu thành công');
});

/**
 * @desc    Xóa tài khoản (soft delete)
 * @route   DELETE /api/users/me
 * @access  Private
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND, 404);
  }

  // Soft delete - chỉ đánh dấu isActive = false
  user.isActive = false;
  await user.save();

  logger.warn(`User account deactivated: ${user.email}`);

  sendSuccess(res, null, 'Tài khoản đã được vô hiệu hóa');
});

/**
 * @desc    Verify token (kiểm tra token còn hợp lệ không)
 * @route   GET /api/users/verify-token
 * @access  Private
 */
const verifyToken = asyncHandler(async (req, res) => {
  // Nếu đến được đây nghĩa là token hợp lệ (đã qua auth middleware)
  sendSuccess(res, {
    valid: true,
    user: {
      id: req.user._id,
      email: req.user.email,
      username: req.user.username
    }
  }, 'Token hợp lệ');
});

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
  verifyToken
};