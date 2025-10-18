/**
 * User Routes
 * File: backend/src/api/user.routes.js
 */

const express = require('express');
const router = express.Router();

// Controllers
const {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
  verifyToken
} = require('../controllers/user.controller');

// Middlewares
const { protect } = require('../middlewares/auth.middleware');
const {
  registerValidation,
  loginValidation
} = require('../middlewares/validation.middleware');
const {
  authLimiter,
  passwordLimiter
} = require('../middlewares/rateLimiter.middleware');

/**
 * @route   POST /api/users/register
 * @desc    Đăng ký tài khoản mới
 * @access  Public
 */
router.post('/register', authLimiter, registerValidation, register);

/**
 * @route   POST /api/users/login
 * @desc    Đăng nhập
 * @access  Public
 */
router.post('/login', authLimiter, loginValidation, login);

/**
 * @route   GET /api/users/verify-token
 * @desc    Verify JWT token
 * @access  Private
 */
router.get('/verify-token', protect, verifyToken);

/**
 * @route   GET /api/users/me
 * @desc    Lấy thông tin user hiện tại
 * @access  Private
 */
router.get('/me', protect, getMe);

/**
 * @route   PUT /api/users/me
 * @desc    Cập nhật thông tin user
 * @access  Private
 */
router.put('/me', protect, updateProfile);

/**
 * @route   PUT /api/users/change-password
 * @desc    Đổi mật khẩu
 * @access  Private
 */
router.put('/change-password', protect, passwordLimiter, changePassword);

/**
 * @route   DELETE /api/users/me
 * @desc    Xóa tài khoản (soft delete)
 * @access  Private
 */
router.delete('/me', protect, deleteAccount);

module.exports = router;