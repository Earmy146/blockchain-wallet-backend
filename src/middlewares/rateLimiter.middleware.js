/**
 * Rate Limiter Middleware - Chống spam API
 * File: backend/src/middlewares/rateLimiter.middleware.js
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');
const logger = require('../utils/logger');
const ERROR_MESSAGES = require('../constants/errorMessages');

/**
 * Rate limiter chung cho tất cả API
 * 100 requests / 15 phút
 */
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs, // 15 phút
  max: config.rateLimit.maxRequests, // 100 requests
  message: {
    success: false,
    message: ERROR_MESSAGES.SYSTEM.RATE_LIMIT
  },
  standardHeaders: true, // Trả về rate limit info trong headers
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: ERROR_MESSAGES.SYSTEM.RATE_LIMIT,
      retryAfter: req.rateLimit.resetTime
    });
  }
});

/**
 * Rate limiter nghiêm ngặt cho Auth endpoints
 * 5 requests / 15 phút (chống brute force login)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5, // Chỉ 5 lần thử
  message: {
    success: false,
    message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút'
  },
  skipSuccessfulRequests: true, // Không đếm request thành công
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    });
  }
});

/**
 * Rate limiter cho Transaction endpoints
 * 10 transactions / 5 phút (chống spam giao dịch)
 */
const transactionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 phút
  max: 10, // 10 giao dịch
  message: {
    success: false,
    message: 'Bạn đã gửi quá nhiều giao dịch. Vui lòng thử lại sau 5 phút'
  },
  keyGenerator: (req) => {
    // Sử dụng userId thay vì IP (nếu đã authenticate)
    return req.user ? req.user._id.toString() : req.ip;
  },
  handler: (req, res) => {
    const identifier = req.user ? req.user.email : req.ip;
    logger.warn(`Transaction rate limit exceeded for: ${identifier}`);
    res.status(429).json({
      success: false,
      message: 'Bạn đã gửi quá nhiều giao dịch. Vui lòng thử lại sau 5 phút',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    });
  }
});

/**
 * Rate limiter cho Wallet creation
 * 3 ví / 1 giờ per IP (chống tạo ví spam)
 */
const walletCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 3, // 3 ví
  message: {
    success: false,
    message: 'Bạn đã tạo quá nhiều ví. Vui lòng thử lại sau 1 giờ'
  },
  handler: (req, res) => {
    logger.warn(`Wallet creation rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Bạn đã tạo quá nhiều ví. Vui lòng thử lại sau 1 giờ',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    });
  }
});

/**
 * Rate limiter cho Balance check
 * 30 requests / 1 phút (chống spam check balance)
 */
const balanceCheckLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 30,
  message: {
    success: false,
    message: 'Bạn đang kiểm tra số dư quá nhanh. Vui lòng chờ 1 phút'
  },
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip;
  },
  handler: (req, res) => {
    logger.warn(`Balance check rate limit exceeded for: ${req.user?.email || req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Bạn đang kiểm tra số dư quá nhanh. Vui lòng chờ 1 phút'
    });
  }
});

/**
 * Rate limiter cho Password reset/change
 * 3 requests / 1 giờ
 */
const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 3,
  message: {
    success: false,
    message: 'Bạn đã thử đổi mật khẩu quá nhiều lần. Vui lòng thử lại sau 1 giờ'
  },
  handler: (req, res) => {
    logger.warn(`Password reset rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      message: 'Bạn đã thử đổi mật khẩu quá nhiều lần. Vui lòng thử lại sau 1 giờ'
    });
  }
});

/**
 * Custom rate limiter với cấu hình tùy chỉnh
 */
const createCustomLimiter = (windowMinutes, maxRequests, message) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: {
      success: false,
      message: message || ERROR_MESSAGES.SYSTEM.RATE_LIMIT
    },
    handler: (req, res) => {
      logger.warn(`Custom rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        success: false,
        message: message || ERROR_MESSAGES.SYSTEM.RATE_LIMIT,
        retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
      });
    }
  });
};

module.exports = {
  generalLimiter,
  authLimiter,
  transactionLimiter,
  walletCreationLimiter,
  balanceCheckLimiter,
  passwordLimiter,
  createCustomLimiter
};