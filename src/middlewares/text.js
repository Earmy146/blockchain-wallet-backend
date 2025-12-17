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
/**
 * Validation Middleware - Validate request data
 * File: backend/src/middlewares/validation.middleware.js
 */

const { body, param, validationResult } = require('express-validator');
const { sendValidationError } = require('../utils/response');
const { isValidAddress, isValidSeedPhrase } = require('../utils/validators');
const ERROR_MESSAGES = require('../constants/errorMessages');

/**
 * Middleware để check kết quả validation
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return sendValidationError(res, errors.array());
  }
  
  next();
};

/**
 * Validation rules cho đăng ký
 */
const registerValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email là bắt buộc')
    .isEmail().withMessage(ERROR_MESSAGES.VALIDATION.INVALID_EMAIL)
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Mật khẩu là bắt buộc')
    .isLength({ min: 8 }).withMessage(ERROR_MESSAGES.VALIDATION.PASSWORD_TOO_SHORT)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Mật khẩu phải chứa chữ hoa, chữ thường và số'),
  
  body('confirmPassword')
    .notEmpty().withMessage('Xác nhận mật khẩu là bắt buộc')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error(ERROR_MESSAGES.VALIDATION.PASSWORD_MISMATCH);
      }
      return true;
    }),
  
  validate
];

/**
 * Validation rules cho đăng nhập
 */
const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email là bắt buộc')
    .isEmail().withMessage(ERROR_MESSAGES.VALIDATION.INVALID_EMAIL)
    .normalizeEmail(),
  
  body('password')
    .notEmpty().withMessage('Mật khẩu là bắt buộc'),
  
  validate
];

/**
 * Validation rules cho tạo ví
 */
const createWalletValidation = [
  body('password')
    .notEmpty().withMessage('Mật khẩu là bắt buộc')
    .isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  
  body('network')
    .optional()
    .isIn(['sepolia', 'mainnet']).withMessage(ERROR_MESSAGES.VALIDATION.INVALID_NETWORK),
  
  validate
];

/**
 * Validation rules cho khôi phục ví
 */
const restoreWalletValidation = [
  body('seedPhrase')
    .trim()
    .notEmpty().withMessage('Seed phrase là bắt buộc')
    .custom((value) => {
      if (!isValidSeedPhrase(value)) {
        throw new Error(ERROR_MESSAGES.WALLET.INVALID_SEED);
      }
      return true;
    }),
  
  body('password')
    .notEmpty().withMessage('Mật khẩu là bắt buộc')
    .isLength({ min: 6 }).withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  
  body('network')
    .optional()
    .isIn(['sepolia', 'mainnet']).withMessage(ERROR_MESSAGES.VALIDATION.INVALID_NETWORK),
  
  validate
];

/**
 * Validation rules cho gửi transaction
 */
const sendTransactionValidation = [
  body('toAddress')
    .trim()
    .notEmpty().withMessage('Địa chỉ người nhận là bắt buộc')
    .custom((value) => {
      if (!isValidAddress(value)) {
        throw new Error(ERROR_MESSAGES.TRANSACTION.INVALID_RECIPIENT);
      }
      return true;
    }),
  
  body('amount')
    .notEmpty().withMessage('Số tiền là bắt buộc')
    .isFloat({ gt: 0 }).withMessage(ERROR_MESSAGES.TRANSACTION.INVALID_AMOUNT)
    .custom((value) => {
      // Giới hạn số thập phân (tối đa 18 chữ số)
      const parts = value.toString().split('.');
      if (parts[1] && parts[1].length > 18) {
        throw new Error('Số tiền không được quá 18 chữ số thập phân');
      }
      return true;
    }),
  
  body('encryptedSeed')
    .notEmpty().withMessage('Encrypted seed là bắt buộc'),
  
  body('password')
    .notEmpty().withMessage('Mật khẩu là bắt buộc'),
  
  validate
];

/**
 * Validation rules cho ước tính phí
 */
const estimateFeeValidation = [
  body('toAddress')
    .trim()
    .notEmpty().withMessage('Địa chỉ người nhận là bắt buộc')
    .custom((value) => {
      if (!isValidAddress(value)) {
        throw new Error(ERROR_MESSAGES.TRANSACTION.INVALID_RECIPIENT);
      }
      return true;
    }),
  
  body('amount')
    .notEmpty().withMessage('Số tiền là bắt buộc')
    .isFloat({ gt: 0 }).withMessage(ERROR_MESSAGES.TRANSACTION.INVALID_AMOUNT),
  
  validate
];

/**
 * Validation cho MongoDB ObjectId
 */
const mongoIdValidation = [
  param('id')
    .isMongoId().withMessage('ID không hợp lệ'),
  
  validate
];

/**
 * Validation cho transaction hash
 */
const txHashValidation = [
  param('txHash')
    .matches(/^0x[a-fA-F0-9]{64}$/).withMessage('Transaction hash không hợp lệ'),
  
  validate
];

/**
 * Validation cho Ethereum address
 */
const addressValidation = [
  param('address')
    .custom((value) => {
      if (!isValidAddress(value)) {
        throw new Error(ERROR_MESSAGES.WALLET.INVALID_ADDRESS);
      }
      return true;
    }),
  
  validate
];

/**
 * Validation cho pagination
 */
const paginationValidation = [
  body('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Trang phải là số nguyên dương'),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit phải từ 1-100'),
  
  validate
];

module.exports = {
  validate,
  registerValidation,
  loginValidation,
  createWalletValidation,
  restoreWalletValidation,
  sendTransactionValidation,
  estimateFeeValidation,
  mongoIdValidation,
  txHashValidation,
  addressValidation,
  paginationValidation
};