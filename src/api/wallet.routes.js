/**
 * Wallet Routes
 * File: backend/src/api/wallet.routes.js
 */

const express = require('express');
const router = express.Router();

// Controllers
const {
  createWallet,
  restoreWallet,
  getWallet,
  updateBalance,
  getBalance,
  verifySeed,
  revealSeed,
  switchNetwork,
  getNetworkInfo
} = require('../controllers/wallet.controller');

// Middlewares
const { protect } = require('../middlewares/auth.middleware');
const {
  createWalletValidation,
  restoreWalletValidation,
  addressValidation
} = require('../middlewares/validation.middleware');
const {
  walletCreationLimiter,
  balanceCheckLimiter
} = require('../middlewares/rateLimiter.middleware');

/**
 * @route   POST /api/wallet/create
 * @desc    Tạo ví mới
 * @access  Private
 */
router.post(
  '/create',
  protect,
  walletCreationLimiter,
  createWalletValidation,
  createWallet
);

/**
 * @route   POST /api/wallet/restore
 * @desc    Khôi phục ví từ seed phrase
 * @access  Private
 */
router.post(
  '/restore',
  protect,
  walletCreationLimiter,
  restoreWalletValidation,
  restoreWallet
);

/**
 * @route   GET /api/wallet
 * @desc    Lấy thông tin ví của user
 * @access  Private
 */
router.get('/', protect, getWallet);

/**
 * @route   GET /api/wallet/balance
 * @desc    Cập nhật số dư ví
 * @access  Private
 */
router.get('/balance', protect, balanceCheckLimiter, updateBalance);

/**
 * @route   GET /api/wallet/balance/:address
 * @desc    Lấy số dư theo địa chỉ (trực tiếp từ blockchain)
 * @access  Public
 */
router.get('/balance/:address', addressValidation, getBalance);

/**
 * @route   POST /api/wallet/verify-seed
 * @desc    Verify seed phrase
 * @access  Private
 */
router.post('/verify-seed', protect, verifySeed);

/**
 * @route   POST /api/wallet/reveal-seed
 * @desc    Xem lại seed phrase (yêu cầu mật khẩu)
 * @access  Private
 */
router.post('/reveal-seed', protect, revealSeed);

/**
 * @route   PUT /api/wallet/switch-network
 * @desc    Chuyển đổi network (Sepolia/Mainnet)
 * @access  Private
 */
router.put('/switch-network', protect, switchNetwork);

/**
 * @route   GET /api/wallet/network-info
 * @desc    Lấy thông tin network hiện tại
 * @access  Private
 */
router.get('/network-info', protect, getNetworkInfo);

module.exports = router;