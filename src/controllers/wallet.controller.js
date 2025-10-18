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