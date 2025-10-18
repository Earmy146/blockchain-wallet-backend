/**
 * Authentication Middleware - Xác thực JWT
 * File: backend/src/middlewares/auth.middleware.js
 */

const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const config = require('../config');
const logger = require('../utils/logger');
const { sendUnauthorized } = require('../utils/response');
const ERROR_MESSAGES = require('../constants/errorMessages');

/**
 * Middleware bảo vệ route - yêu cầu đăng nhập
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Kiểm tra token trong header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Nếu không có token
    if (!token) {
      return sendUnauthorized(res, ERROR_MESSAGES.AUTH.UNAUTHORIZED);
    }

    // 2. Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // 3. Tìm user từ token
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return sendUnauthorized(res, ERROR_MESSAGES.AUTH.USER_NOT_FOUND);
    }

    // 4. Kiểm tra account có active không
    if (!user.isActive) {
      return sendUnauthorized(res, 'Tài khoản đã bị vô hiệu hóa');
    }

    // 5. Attach user vào request
    req.user = user;
    
    logger.info(`User authenticated: ${user.email}`);
    next();

  } catch (error) {
    logger.logError(error, 'auth.middleware.protect');

    // Xử lý lỗi JWT
    if (error.name === 'JsonWebTokenError') {
      return sendUnauthorized(res, ERROR_MESSAGES.AUTH.TOKEN_INVALID);
    }

    if (error.name === 'TokenExpiredError') {
      return sendUnauthorized(res, ERROR_MESSAGES.AUTH.TOKEN_EXPIRED);
    }

    return sendUnauthorized(res, ERROR_MESSAGES.AUTH.UNAUTHORIZED);
  }
};

/**
 * Generate JWT token
 * @param {String} userId 
 * @returns {String} - JWT token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    config.jwt.secret,
    { expiresIn: config.jwt.expire }
  );
};

/**
 * Middleware optional auth (không bắt buộc đăng nhập)
 * Nếu có token hợp lệ thì attach user, không có thì bỏ qua
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Nếu lỗi, bỏ qua và tiếp tục (không block request)
    next();
  }
};

/**
 * Middleware kiểm tra quyền admin (nếu cần mở rộng sau)
 */
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền thực hiện thao tác này'
    });
  }
};

module.exports = {
  protect,
  generateToken,
  optionalAuth,
  requireAdmin
};