/**
 * Transaction Routes
 * File: backend/src/api/transaction.routes.js
 */

const express = require('express');
const router = express.Router();

// Controllers
const {
  sendTransaction,
  estimateFee,
  getTransactionHistory,
  getTransactionDetail,
  getPendingTransactions,
  getTransactionStats,
  checkTransactionStatus,
  getTransactionsByAddress,
  exportTransactions,
  getCurrentGasPrice
} = require('../controllers/transaction.controller');

// Middlewares
const { protect } = require('../middlewares/auth.middleware');
const {
  sendTransactionValidation,
  estimateFeeValidation,
  mongoIdValidation,
  txHashValidation
} = require('../middlewares/validation.middleware');
const {
  transactionLimiter,
  generalLimiter
} = require('../middlewares/rateLimiter.middleware');

/**
 * @route   POST /api/transactions/send
 * @desc    Gửi ETH
 * @access  Private
 */
router.post(
  '/send',
  protect,
  transactionLimiter,
  sendTransactionValidation,
  sendTransaction
);

/**
 * @route   POST /api/transactions/estimate-fee
 * @desc    Ước tính phí gas
 * @access  Private
 */
router.post(
  '/estimate-fee',
  protect,
  estimateFeeValidation,
  estimateFee
);

/**
 * @route   GET /api/transactions/history
 * @desc    Lấy lịch sử giao dịch
 * @access  Private
 */
router.get('/history', protect, getTransactionHistory);

/**
 * @route   GET /api/transactions/pending
 * @desc    Lấy giao dịch đang pending
 * @access  Private
 */
router.get('/pending', protect, getPendingTransactions);

/**
 * @route   GET /api/transactions/stats
 * @desc    Lấy thống kê giao dịch
 * @access  Private
 */
router.get('/stats', protect, getTransactionStats);

/**
 * @route   GET /api/transactions/export
 * @desc    Export lịch sử giao dịch (CSV)
 * @access  Private
 */
router.get('/export', protect, exportTransactions);

/**
 * @route   GET /api/transactions/gas-price
 * @desc    Lấy gas price hiện tại
 * @access  Public
 */
router.get('/gas-price', getCurrentGasPrice);

/**
 * @route   GET /api/transactions/check/:txHash
 * @desc    Kiểm tra trạng thái giao dịch theo txHash
 * @access  Public
 */
router.get('/check/:txHash', txHashValidation, checkTransactionStatus);

/**
 * @route   GET /api/transactions/address/:address
 * @desc    Lấy giao dịch theo địa chỉ
 * @access  Private
 */
router.get('/address/:address', protect, getTransactionsByAddress);

/**
 * @route   GET /api/transactions/:id
 * @desc    Lấy chi tiết giao dịch
 * @access  Private
 */
router.get('/:id', protect, mongoIdValidation, getTransactionDetail);

module.exports = router;