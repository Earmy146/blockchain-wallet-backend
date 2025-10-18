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