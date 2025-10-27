/**
 * Transaction Controller - Xử lý các request liên quan đến giao dịch
 * File: backend/src/controllers/transaction.controller.js
 */

const transactionService = require('../services/transaction.service');
const walletService = require('../services/wallet.service');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { sendSuccess, sendPagination } = require('../utils/response');
const logger = require('../utils/logger');
const ERROR_MESSAGES = require('../constants/errorMessages');

/**
 * @desc    Gửi ETH
 * @route   POST /api/transactions/send
 * @access  Private
 */
const sendTransaction = asyncHandler(async (req, res) => {
  const { toAddress, amount, encryptedSeed, password } = req.body;
  const userId = req.user._id;

  // Lấy ví của user
  const wallet = await walletService.getWalletByUserId(userId);

  logger.info(`Sending ${amount} ETH from ${wallet.address} to ${toAddress}`);

  // Gọi transaction service
  const result = await transactionService.sendTransaction(
    wallet.id,
    toAddress,
    amount,
    encryptedSeed,
    password
  );

  logger.info(`Transaction sent: ${result.transaction.txHash}`);

  sendSuccess(res, result, 'Giao dịch đã được gửi thành công', 201);
});

/**
 * @desc    Ước tính phí gas
 * @route   POST /api/transactions/estimate-fee
 * @access  Private
 */
const estimateFee = asyncHandler(async (req, res) => {
  const { toAddress, amount } = req.body;
  const userId = req.user._id;

  // Lấy ví của user
  const wallet = await walletService.getWalletByUserId(userId);

  // Ước tính phí
  const feeEstimate = await transactionService.estimateTransactionFee(
    wallet.id,
    toAddress,
    amount
  );

  sendSuccess(res, feeEstimate, 'Ước tính phí gas thành công');
});

/**
 * @desc    Lấy lịch sử giao dịch
 * @route   GET /api/transactions/history
 * @access  Private
 */
const getTransactionHistory = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { limit = 20 } = req.query;

  // Lấy ví của user
  const wallet = await walletService.getWalletByUserId(userId);

  // Lấy lịch sử giao dịch
  const transactions = await transactionService.getTransactionHistory(
    wallet.id,
    parseInt(limit)
  );

  sendSuccess(res, {
    transactions,
    count: transactions.length
  }, 'Lấy lịch sử giao dịch thành công');
});

/**
 * @desc    Lấy chi tiết giao dịch
 * @route   GET /api/transactions/:id
 * @access  Private
 */
const getTransactionDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const transaction = await transactionService.getTransactionDetail(id);

  // Kiểm tra quyền truy cập (chỉ owner mới xem được)
  const wallet = await walletService.getWalletByUserId(req.user._id);
  
  if (transaction.walletId && transaction.walletId.toString() !== wallet.id.toString()) {
    throw new AppError('Bạn không có quyền xem giao dịch này', 403);
  }

  sendSuccess(res, { transaction });
});

/**
 * @desc    Lấy giao dịch đang pending
 * @route   GET /api/transactions/pending
 * @access  Private
 */
const getPendingTransactions = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Lấy ví của user
  const wallet = await walletService.getWalletByUserId(userId);

  // Lấy pending transactions
  const pendingTxs = await transactionService.getPendingTransactions(wallet.id);

  sendSuccess(res, {
    transactions: pendingTxs,
    count: pendingTxs.length
  });
});

/**
 * @desc    Lấy thống kê giao dịch
 * @route   GET /api/transactions/stats
 * @access  Private
 */
const getTransactionStats = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Lấy ví của user
  const wallet = await walletService.getWalletByUserId(userId);

  // Lấy thống kê
  const stats = await transactionService.getTransactionStats(wallet.id);

  sendSuccess(res, { stats }, 'Lấy thống kê thành công');
});

/**
 * @desc    Kiểm tra trạng thái giao dịch theo txHash
 * @route   GET /api/transactions/check/:txHash
 * @access  Public (hoặc Private)
 */
const checkTransactionStatus = asyncHandler(async (req, res) => {
  const { txHash } = req.params;
  const { network = 'sepolia' } = req.query;

  const blockchainService = require('../services/blockchain.service');
  const txInfo = await blockchainService.getTransaction(txHash, network);

  sendSuccess(res, {
    txHash,
    status: txInfo.status,
    from: txInfo.from,
    to: txInfo.to,
    value: txInfo.value,
    blockNumber: txInfo.blockNumber,
    confirmations: txInfo.confirmations,
    gasUsed: txInfo.gasUsed,
    explorerUrl: blockchainService.getExplorerUrl(txHash, network)
  });
});

/**
 * @desc    Lấy giao dịch theo địa chỉ (cho trang Receive)
 * @route   GET /api/transactions/address/:address
 * @access  Private
 */
const getTransactionsByAddress = asyncHandler(async (req, res) => {
  const { address } = req.params;
  const { limit = 20, type } = req.query;
  const userId = req.user._id;

  // Lấy ví của user
  const wallet = await walletService.getWalletByUserId(userId);

  // Kiểm tra quyền truy cập
  if (wallet.address.toLowerCase() !== address.toLowerCase()) {
    throw new AppError('Bạn không có quyền xem giao dịch của địa chỉ này', 403);
  }

  const Transaction = require('../models/transaction.model');
  
  let query = { walletId: wallet.id };
  
  // Lọc theo type nếu có
  if (type && ['send', 'receive'].includes(type)) {
    query.type = type;
  }

  const transactions = await Transaction.find(query)
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  sendSuccess(res, {
    address,
    transactions,
    count: transactions.length
  });
});

/**
 * @desc    Export lịch sử giao dịch (CSV format)
 * @route   GET /api/transactions/export
 * @access  Private
 */
const exportTransactions = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Lấy ví của user
  const wallet = await walletService.getWalletByUserId(userId);

  // Lấy tất cả giao dịch
  const transactions = await transactionService.getTransactionHistory(wallet.id, 1000);

  // Convert sang CSV format
  const csvHeader = 'Date,TxHash,Type,From,To,Amount,Status,Fee,Explorer\n';
  const csvRows = transactions.map(tx => {
    const date = new Date(tx.createdAt).toISOString();
    return `${date},${tx.txHash},${tx.type},${tx.from},${tx.to},${tx.amount},${tx.status},${tx.totalFee || '0'},${tx.explorerUrl}`;
  }).join('\n');

  const csv = csvHeader + csvRows;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=transactions_${wallet.address}.csv`);
  res.send(csv);
});

/**
 * @desc    Lấy gas price hiện tại
 * @route   GET /api/transactions/gas-price
 * @access  Public
 */
const getCurrentGasPrice = asyncHandler(async (req, res) => {
  const { network = 'sepolia' } = req.query;
  
  const blockchainService = require('../services/blockchain.service');
  const provider = blockchainService.getProvider(network);
  const feeData = await provider.getFeeData();
  
  const { ethers } = require('ethers');
  const gasPriceGwei = ethers.formatUnits(feeData.gasPrice, 'gwei');

  sendSuccess(res, {
    network,
    gasPrice: feeData.gasPrice.toString(),
    gasPriceGwei: parseFloat(gasPriceGwei).toFixed(2) + ' Gwei',
    timestamp: new Date()
  });
});

module.exports = {
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
};

/**
 * User Controller - Xử lý các request liên quan đến user
 * File: backend/src/controllers/user.controller.js
 */

const User = require('../models/user.model');
const { generateToken } = require('../middlewares/auth.middleware');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');
const ERROR_MESSAGES = require('../constants/errorMessages');

/**
 * @desc    Đăng ký user mới
 * @route   POST /api/users/register
 * @access  Public
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, username } = req.body;

  // Kiểm tra email đã tồn tại chưa
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    throw new AppError(ERROR_MESSAGES.AUTH.USER_EXISTS, 400);
  }

  // Tạo user mới
  const user = await User.create({
    email,
    password, // Sẽ được hash tự động bởi pre-save middleware
    username: username || email.split('@')[0]
  });

  // Generate JWT token
  const token = generateToken(user._id);

  logger.info(`New user registered: ${email}`);

  sendSuccess(res, {
    user: {
      id: user._id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt
    },
    token
  }, 'Đăng ký thành công', 201);
});

/**
 * @desc    Đăng nhập
 * @route   POST /api/users/login
 * @access  Public
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Tìm user (bao gồm password để so sánh)
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new AppError(ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS, 401);
  }

  // Kiểm tra password
  const isPasswordCorrect = await user.comparePassword(password);

  if (!isPasswordCorrect) {
    throw new AppError(ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS, 401);
  }

  // Kiểm tra tài khoản có active không
  if (!user.isActive) {
    throw new AppError('Tài khoản đã bị vô hiệu hóa', 403);
  }

  // Cập nhật lastLogin
  await user.updateLastLogin();

  // Generate token
  const token = generateToken(user._id);

  logger.info(`User logged in: ${email}`);

  sendSuccess(res, {
    user: {
      id: user._id,
      email: user.email,
      username: user.username,
      lastLogin: user.lastLogin
    },
    token
  }, 'Đăng nhập thành công');
});

/**
 * @desc    Lấy thông tin user hiện tại
 * @route   GET /api/users/me
 * @access  Private
 */
const getMe = asyncHandler(async (req, res) => {
  // req.user đã được attach bởi auth middleware
  const user = await User.findById(req.user._id)
    .populate({
      path: 'wallet',
      select: 'address network balance createdAt'
    });

  if (!user) {
    throw new AppError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND, 404);
  }

  sendSuccess(res, {
    user: {
      id: user._id,
      email: user.email,
      username: user.username,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      wallet: user.wallet || null
    }
  });
});

/**
 * @desc    Cập nhật thông tin user
 * @route   PUT /api/users/me
 * @access  Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { username } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND, 404);
  }

  // Cập nhật username nếu có
  if (username) {
    user.username = username;
  }

  await user.save();

  logger.info(`User profile updated: ${user.email}`);

  sendSuccess(res, {
    user: {
      id: user._id,
      email: user.email,
      username: user.username,
      updatedAt: user.updatedAt
    }
  }, 'Cập nhật thông tin thành công');
});

/**
 * @desc    Đổi mật khẩu
 * @route   PUT /api/users/change-password
 * @access  Private
 */
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  // Lấy user với password
  const user = await User.findById(req.user._id).select('+password');

  if (!user) {
    throw new AppError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND, 404);
  }

  // Verify current password
  const isPasswordCorrect = await user.comparePassword(currentPassword);

  if (!isPasswordCorrect) {
    throw new AppError('Mật khẩu hiện tại không đúng', 401);
  }

  // Cập nhật password mới
  user.password = newPassword; // Sẽ được hash tự động
  await user.save();

  logger.info(`Password changed for user: ${user.email}`);

  sendSuccess(res, null, 'Đổi mật khẩu thành công');
});

/**
 * @desc    Xóa tài khoản (soft delete)
 * @route   DELETE /api/users/me
 * @access  Private
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new AppError(ERROR_MESSAGES.AUTH.USER_NOT_FOUND, 404);
  }

  // Soft delete - chỉ đánh dấu isActive = false
  user.isActive = false;
  await user.save();

  logger.warn(`User account deactivated: ${user.email}`);

  sendSuccess(res, null, 'Tài khoản đã được vô hiệu hóa');
});

/**
 * @desc    Verify token (kiểm tra token còn hợp lệ không)
 * @route   GET /api/users/verify-token
 * @access  Private
 */
const verifyToken = asyncHandler(async (req, res) => {
  // Nếu đến được đây nghĩa là token hợp lệ (đã qua auth middleware)
  sendSuccess(res, {
    valid: true,
    user: {
      id: req.user._id,
      email: req.user.email,
      username: req.user.username
    }
  }, 'Token hợp lệ');
});

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  deleteAccount,
  verifyToken
};

/**
 * Wallet Controller - Xử lý các request liên quan đến ví
 * File: backend/src/controllers/wallet.controller.js
 */

const walletService = require('../services/wallet.service');
const blockchainService = require('../services/blockchain.service');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { sendSuccess } = require('../utils/response');
const logger = require('../utils/logger');
const ERROR_MESSAGES = require('../constants/errorMessages');

/**
 * @desc    Tạo ví mới
 * @route   POST /api/wallet/create
 * @access  Private
 */
const createWallet = asyncHandler(async (req, res) => {
  const { password, network = 'sepolia' } = req.body;
  const userId = req.user._id;

  logger.info(`Creating wallet for user: ${req.user.email}`);

  // Gọi wallet service
  const result = await walletService.createWallet(userId, password, network);

  // QUAN TRỌNG: Seed phrase chỉ trả về 1 lần duy nhất
  logger.info(`Wallet created successfully for user: ${req.user.email}`);

  sendSuccess(res, {
    wallet: result.wallet,
    encryptedSeed: result.encryptedSeed,
    seedPhrase: result.seedPhrase, // User phải backup ngay!
    warning: '⚠️ Hãy lưu 12 từ khôi phục này ngay! Đây là lần duy nhất hiển thị.'
  }, 'Tạo ví thành công', 201);
});

/**
 * @desc    Khôi phục ví từ seed phrase
 * @route   POST /api/wallet/restore
 * @access  Private
 */
const restoreWallet = asyncHandler(async (req, res) => {
  const { seedPhrase, password, network = 'sepolia' } = req.body;
  const userId = req.user._id;
  
  // ✅ THÊM LOG NÀY
  console.log('=== RESTORE WALLET DEBUG ===');
  console.log('User ID from token:', userId);
  console.log('User ID type:', typeof userId);
  console.log('User email:', req.user.email);
  
  logger.info(`Restoring wallet for user: ${req.user.email}`);
  
  // Gọi wallet service
  const result = await walletService.restoreWallet(userId, seedPhrase, password, network);
  
  logger.info(`Wallet restored successfully for user: ${req.user.email}`);
  
  sendSuccess(res, {
    wallet: result.wallet,
    encryptedSeed: result.encryptedSeed
  }, 'Khôi phục ví thành công', 201);
});

/**
 * @desc    Lấy thông tin ví
 * @route   GET /api/wallet
 * @access  Private
 */
const getWallet = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const wallet = await walletService.getWalletByUserId(userId);

  sendSuccess(res, { wallet });
});

/**
 * @desc    Cập nhật số dư ví
 * @route   GET /api/wallet/balance
 * @access  Private
 */
const updateBalance = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // Lấy ví
  const wallet = await walletService.getWalletByUserId(userId);

  // Cập nhật số dư
  const balance = await walletService.updateWalletBalance(wallet.id);

  logger.info(`Balance updated for wallet: ${wallet.address}`);

  sendSuccess(res, {
    address: wallet.address,
    balance,
    network: wallet.network,
    updatedAt: new Date()
  }, 'Cập nhật số dư thành công');
});

/**
 * @desc    Lấy số dư trực tiếp từ blockchain
 * @route   GET /api/wallet/balance/:address
 * @access  Public (hoặc Private tùy yêu cầu)
 */
const getBalance = asyncHandler(async (req, res) => {
  const { address } = req.params;
  const { network = 'sepolia' } = req.query;

  const balance = await blockchainService.getBalance(address, network);

  sendSuccess(res, {
    address,
    balance,
    network,
    timestamp: new Date()
  });
});

/**
 * @desc    Verify seed phrase
 * @route   POST /api/wallet/verify-seed
 * @access  Private
 */
const verifySeed = asyncHandler(async (req, res) => {
  const { seedPhrase } = req.body;
  const userId = req.user._id;

  // Lấy ví của user
  const wallet = await walletService.getWalletByUserId(userId);

  // Verify seed phrase khớp với address
  const isValid = walletService.verifySeedPhrase(seedPhrase, wallet.address);

  if (!isValid) {
    throw new AppError('Seed phrase không khớp với ví hiện tại', 400);
  }

  sendSuccess(res, {
    valid: true,
    address: wallet.address
  }, 'Seed phrase hợp lệ');
});

/**
 * @desc    Xem lại seed phrase (yêu cầu mật khẩu để giải mã)
 * @route   POST /api/wallet/reveal-seed
 * @access  Private
 */
const revealSeed = asyncHandler(async (req, res) => {
  const { encryptedSeed, password } = req.body;
  
  if (!encryptedSeed || !password) {
    throw new AppError('Encrypted seed và mật khẩu là bắt buộc', 400);
  }

  const encryptionService = require('../services/encryption.service');
  
  try {
    // Giải mã seed phrase
    const seedPhrase = encryptionService.decryptSeedPhrase(encryptedSeed, password);
    
    // Verify seed phrase khớp với ví của user
    const wallet = await walletService.getWalletByUserId(req.user._id);
    const isValid = walletService.verifySeedPhrase(seedPhrase, wallet.address);
    
    if (!isValid) {
      throw new AppError('Seed phrase không khớp với ví hiện tại', 400);
    }
    
    logger.warn(`Seed phrase revealed for user: ${req.user.email}`);
    
    sendSuccess(res, {
      seedPhrase,
      warning: '⚠️ Không chia sẻ seed phrase với bất kỳ ai!'
    }, 'Seed phrase đã được giải mã');
    
  } catch (error) {
    if (error.message.includes('Malformed') || error.statusCode === 401) {
      throw new AppError(ERROR_MESSAGES.WALLET.DECRYPTION_FAILED, 401);
    }
    throw error;
  }
});

/**
 * @desc    Chuyển đổi network (Sepolia <-> Mainnet)
 * @route   PUT /api/wallet/switch-network
 * @access  Private
 */
const switchNetwork = asyncHandler(async (req, res) => {
  const { network } = req.body;
  const userId = req.user._id;

  if (!['sepolia', 'mainnet'].includes(network)) {
    throw new AppError(ERROR_MESSAGES.VALIDATION.INVALID_NETWORK, 400);
  }

  const Wallet = require('../models/wallet.model');
  const wallet = await Wallet.findOne({ userId });

  if (!wallet) {
    throw new AppError(ERROR_MESSAGES.WALLET.WALLET_NOT_FOUND, 404);
  }

  wallet.network = network;
  await wallet.save();

  // Cập nhật số dư mới
  const balance = await blockchainService.getBalance(wallet.address, network);
  await wallet.updateBalance(balance);

  logger.info(`Network switched to ${network} for user: ${req.user.email}`);

  sendSuccess(res, {
    wallet: {
      id: wallet._id,
      address: wallet.address,
      network: wallet.network,
      balance: wallet.balance
    }
  }, `Đã chuyển sang ${network}`);
});

/**
 * @desc    Lấy thông tin network hiện tại
 * @route   GET /api/wallet/network-info
 * @access  Private
 */
const getNetworkInfo = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const wallet = await walletService.getWalletByUserId(userId);

  const currentBlock = await blockchainService.getCurrentBlock(wallet.network);
  const { NETWORKS } = require('../constants/networks');
  const networkConfig = NETWORKS[wallet.network.toUpperCase()];

  sendSuccess(res, {
    network: wallet.network,
    networkName: networkConfig.name,
    chainId: networkConfig.chainId,
    currentBlock,
    explorer: networkConfig.explorer,
    isTestnet: networkConfig.isTestnet
  });
});

module.exports = {
  createWallet,
  restoreWallet,
  getWallet,
  updateBalance,
  getBalance,
  verifySeed,
  revealSeed,
  switchNetwork,
  getNetworkInfo
};