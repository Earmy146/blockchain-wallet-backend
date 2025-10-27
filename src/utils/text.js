/**
 * Middleware xử lý lỗi tập trung
 * File: backend/src/utils/errorHandler.js
 */

const logger = require('./logger');
const { sendError } = require('./response');
const ERROR_MESSAGES = require('../constants/errorMessages');

/**
 * Custom Error Class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Async handler wrapper để bắt lỗi trong async functions
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Xử lý lỗi Mongoose validation
 */
const handleMongooseValidationError = (err) => {
  const errors = Object.values(err.errors).map(e => ({
    field: e.path,
    message: e.message
  }));
  
  return new AppError('Dữ liệu không hợp lệ', 400);
};

/**
 * Xử lý lỗi Mongoose duplicate key
 */
const handleMongooseDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const message = `${field} đã tồn tại trong hệ thống`;
  return new AppError(message, 409);
};

/**
 * Xử lý lỗi JWT
 */
const handleJWTError = () => {
  return new AppError(ERROR_MESSAGES.AUTH.TOKEN_INVALID, 401);
};

const handleJWTExpiredError = () => {
  return new AppError(ERROR_MESSAGES.AUTH.TOKEN_EXPIRED, 401);
};

/**
 * Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log lỗi
  logger.logError(err, `${req.method} ${req.originalUrl}`);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    error = handleMongooseValidationError(err);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    error = handleMongooseDuplicateKeyError(err);
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    error = new AppError('Tài nguyên không tồn tại', 404);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }

  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Ethers.js errors
  if (err.code === 'INSUFFICIENT_FUNDS') {
    error = new AppError(ERROR_MESSAGES.TRANSACTION.INSUFFICIENT_FUNDS, 400);
  }

  if (err.code === 'NETWORK_ERROR') {
    error = new AppError(ERROR_MESSAGES.SYSTEM.NETWORK_ERROR, 503);
  }

  // Default error
  const statusCode = error.statusCode || 500;
  const message = error.message || ERROR_MESSAGES.SYSTEM.INTERNAL_ERROR;

  // Development: trả về stack trace
  if (process.env.NODE_ENV === 'development') {
    return res.status(statusCode).json({
      success: false,
      message,
      error: err,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
  }

  // Production: chỉ trả về message
  return sendError(res, message, statusCode);
};

/**
 * Handler cho route không tồn tại
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route ${req.originalUrl} không tồn tại`,
    404
  );
  next(error);
};

module.exports = {
  AppError,
  asyncHandler,
  errorHandler,
  notFoundHandler
};

/**
 * Winston Logger để ghi log hệ thống
 * File: backend/src/utils/logger.js
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Tạo thư mục logs nếu chưa có
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Định dạng log
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return stack 
      ? `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`
      : `${timestamp} [${level.toUpperCase()}]: ${message}`;
  })
);

// Console format với màu sắc
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} ${level}: ${message}`;
  })
);

// Tạo logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    // Ghi tất cả log vào combined.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // Ghi riêng error log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    })
  ]
});

// Thêm console log cho development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Helper functions
logger.logRequest = (req) => {
  logger.info(`${req.method} ${req.originalUrl} - IP: ${req.ip}`);
};

logger.logError = (error, context = '') => {
  logger.error(`${context ? `[${context}] ` : ''}${error.message}`, { 
    stack: error.stack 
  });
};

logger.logTransaction = (txHash, from, to, amount) => {
  logger.info(`Transaction: ${txHash} | From: ${from} | To: ${to} | Amount: ${amount} ETH`);
};

module.exports = logger;

/**
 * Chuẩn hóa format response API
 * File: backend/src/utils/response.js
 */

/**
 * Response thành công
 * @param {Object} res - Express response object
 * @param {*} data - Dữ liệu trả về
 * @param {String} message - Thông báo
 * @param {Number} statusCode - HTTP status code
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Response lỗi
 * @param {Object} res - Express response object
 * @param {String} message - Thông báo lỗi
 * @param {Number} statusCode - HTTP status code
 * @param {*} errors - Chi tiết lỗi (optional)
 */
const sendError = (res, message = 'Error', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  // Chỉ thêm errors nếu có
  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Response cho validation errors
 * @param {Object} res - Express response object
 * @param {Array} errors - Mảng các lỗi validation
 */
const sendValidationError = (res, errors) => {
  return res.status(400).json({
    success: false,
    message: 'Dữ liệu không hợp lệ',
    errors: errors.map(err => ({
      field: err.path || err.param,
      message: err.msg || err.message
    })),
    timestamp: new Date().toISOString()
  });
};

/**
 * Response cho unauthorized
 */
const sendUnauthorized = (res, message = 'Bạn cần đăng nhập để thực hiện thao tác này') => {
  return sendError(res, message, 401);
};

/**
 * Response cho forbidden
 */
const sendForbidden = (res, message = 'Bạn không có quyền thực hiện thao tác này') => {
  return sendError(res, message, 403);
};

/**
 * Response cho not found
 */
const sendNotFound = (res, message = 'Không tìm thấy tài nguyên') => {
  return sendError(res, message, 404);
};

/**
 * Response cho pagination
 * @param {Object} res - Express response object
 * @param {Array} data - Dữ liệu
 * @param {Number} page - Trang hiện tại
 * @param {Number} limit - Số items mỗi trang
 * @param {Number} total - Tổng số items
 */
const sendPagination = (res, data, page, limit, total) => {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      currentPage: page,
      perPage: limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  sendSuccess,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendForbidden,
  sendNotFound,
  sendPagination
};

/**
 * Các hàm validate dữ liệu
 * File: backend/src/utils/validators.js
 */

const { ethers } = require('ethers');
const ERROR_MESSAGES = require('../constants/errorMessages');

/**
 * Validate địa chỉ Ethereum
 * @param {String} address - Địa chỉ cần validate
 * @returns {Boolean}
 */
const isValidAddress = (address) => {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
};

/**
 * Validate số tiền (amount phải > 0 và là số hợp lệ)
 * @param {String|Number} amount - Số tiền
 * @returns {Boolean}
 */
const isValidAmount = (amount) => {
  try {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0 && isFinite(num);
  } catch {
    return false;
  }
};

/**
 * Validate seed phrase (phải có đúng 12 từ)
 * @param {String} seedPhrase - Chuỗi seed phrase
 * @returns {Boolean}
 */
const isValidSeedPhrase = (seedPhrase) => {
  if (!seedPhrase || typeof seedPhrase !== 'string') {
    return false;
  }
  
  const words = seedPhrase.trim().split(/\s+/);
  return words.length === 12 && words.every(word => word.length > 0);
};

/**
 * Validate email format
 * @param {String} email 
 * @returns {Boolean}
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate mật khẩu (tối thiểu 8 ký tự)
 * @param {String} password 
 * @returns {Boolean}
 */
const isValidPassword = (password) => {
  return password && password.length >= 8;
};

/**
 * Validate network name
 * @param {String} network 
 * @returns {Boolean}
 */
const isValidNetwork = (network) => {
  const validNetworks = ['sepolia', 'mainnet'];
  return validNetworks.includes(network?.toLowerCase());
};

/**
 * Validate transaction hash
 * @param {String} txHash 
 * @returns {Boolean}
 */
const isValidTxHash = (txHash) => {
  return /^0x([A-Fa-f0-9]{64})$/.test(txHash);
};

/**
 * Sanitize address (chuyển về lowercase và trim)
 * @param {String} address 
 * @returns {String}
 */
const sanitizeAddress = (address) => {
  return address?.trim().toLowerCase();
};

/**
 * Format số tiền ETH (làm tròn đến 6 chữ số thập phân)
 * @param {String|Number} amount 
 * @returns {String}
 */
const formatAmount = (amount) => {
  return parseFloat(amount).toFixed(6);
};

/**
 * Validate toàn bộ dữ liệu giao dịch
 * @param {Object} txData - {to, amount, from}
 * @returns {Object} {valid: Boolean, errors: Array}
 */
const validateTransaction = (txData) => {
  const errors = [];

  if (!isValidAddress(txData.to)) {
    errors.push({ field: 'to', message: ERROR_MESSAGES.TRANSACTION.INVALID_RECIPIENT });
  }

  if (!isValidAmount(txData.amount)) {
    errors.push({ field: 'amount', message: ERROR_MESSAGES.TRANSACTION.INVALID_AMOUNT });
  }

  if (txData.from && !isValidAddress(txData.from)) {
    errors.push({ field: 'from', message: ERROR_MESSAGES.WALLET.INVALID_ADDRESS });
  }

  // Kiểm tra không gửi cho chính mình
  if (txData.from && txData.to && 
      sanitizeAddress(txData.from) === sanitizeAddress(txData.to)) {
    errors.push({ field: 'to', message: ERROR_MESSAGES.TRANSACTION.SAME_ADDRESS });
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  isValidAddress,
  isValidAmount,
  isValidSeedPhrase,
  isValidEmail,
  isValidPassword,
  isValidNetwork,
  isValidTxHash,
  sanitizeAddress,
  formatAmount,
  validateTransaction
};