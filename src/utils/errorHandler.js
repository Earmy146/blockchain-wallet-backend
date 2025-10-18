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