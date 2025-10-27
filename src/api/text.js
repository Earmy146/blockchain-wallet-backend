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

/**
 * API Routes Aggregator
 * File: backend/src/api/index.js
 */

const express = require('express');
const router = express.Router();

// Import routes
const userRoutes = require('./user.routes');
const walletRoutes = require('./wallet.routes');
const transactionRoutes = require('./transaction.routes');

// Import middlewares
const { generalLimiter } = require('../middlewares/rateLimiter.middleware');
const logger = require('../utils/logger');

/**
 * Health check endpoint
 * @route   GET /api/health
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * API Info endpoint
 * @route   GET /api
 * @access  Public
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Blockchain Wallet API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      wallet: '/api/wallet',
      transactions: '/api/transactions'
    },
    documentation: 'https://github.com/your-repo/docs',
    timestamp: new Date().toISOString()
  });
});

/**
 * Logging middleware cho tất cả requests
 */
router.use((req, res, next) => {
  logger.logRequest(req);
  next();
});

/**
 * Apply general rate limiter cho tất cả routes
 */
router.use(generalLimiter);

/**
 * Mount routes
 */
router.use('/users', userRoutes);
router.use('/wallet', walletRoutes);
router.use('/transactions', transactionRoutes);

/**
 * 404 Handler cho routes không tồn tại
 */
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} không tồn tại`,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;