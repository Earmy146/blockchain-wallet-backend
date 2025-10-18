/**
 * Wallet Service - Tạo & Khôi phục ví
 * File: backend/src/services/wallet.service.js
 * 
 * Luồng: Seed Phrase → Private Key → Public Key → Address
 */

const { ethers } = require('ethers');
const Wallet = require('../models/wallet.model');
const User = require('../models/user.model');
const encryptionService = require('./encryption.service');
const blockchainService = require('./blockchain.service');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');
const ERROR_MESSAGES = require('../constants/errorMessages');
const { isValidSeedPhrase } = require('../utils/validators');

class WalletService {
  /**
   * Tạo ví mới
   * @param {String} userId - ID người dùng
   * @param {String} password - Mật khẩu để mã hóa seed
   * @param {String} network - Mạng blockchain
   * @returns {Object} - {wallet, encryptedSeed, seedPhrase}
   */
  async createWallet(userId, password, network = 'sepolia') {
    try {
      // Kiểm tra user đã có ví chưa
      const existingWallet = await Wallet.findByUserId(userId);
      if (existingWallet) {
        throw new AppError(ERROR_MESSAGES.WALLET.WALLET_EXISTS, 400);
      }

      // 1. Generate random wallet (tự động tạo seed phrase)
      const randomWallet = ethers.Wallet.createRandom();
      
      // 2. Lấy seed phrase (12 từ)
      const seedPhrase = randomWallet.mnemonic.phrase;
      
      // 3. Lấy private key, public key, address
      const privateKey = randomWallet.privateKey;
      const publicKey = randomWallet.publicKey;
      const address = randomWallet.address;

      logger.info(`Wallet created: ${address}`);

      // 4. Mã hóa seed phrase bằng mật khẩu người dùng
      const encryptedSeed = encryptionService.encryptSeedPhrase(seedPhrase, password);

      // 5. Lưu thông tin ví vào MongoDB (CHỈ lưu address & publicKey)
      const wallet = await Wallet.create({
        userId,
        address: address.toLowerCase(),
        publicKey,
        network,
        balance: '0'
      });

      // 6. Lấy số dư ban đầu từ blockchain
      const balance = await blockchainService.getBalance(address, network);
      await wallet.updateBalance(balance);

      logger.info(`Wallet saved to DB: ${wallet._id}`);

      return {
        wallet: {
          id: wallet._id,
          address: wallet.address,
          publicKey: wallet.publicKey,
          network: wallet.network,
          balance: wallet.balance
        },
        encryptedSeed, // Trả về để frontend lưu vào localStorage
        seedPhrase // CHỈ trả về 1 lần duy nhất để user backup
      };

    } catch (error) {
      logger.logError(error, 'WalletService.createWallet');
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(ERROR_MESSAGES.WALLET.CREATION_FAILED, 500);
    }
  }

  /**
   * Khôi phục ví từ seed phrase
   * @param {String} userId 
   * @param {String} seedPhrase - 12 từ khôi phục
   * @param {String} password - Mật khẩu để mã hóa seed
   * @param {String} network 
   * @returns {Object}
   */
  async restoreWallet(userId, seedPhrase, password, network = 'sepolia') {
    try {
      // 1. Validate seed phrase
      if (!isValidSeedPhrase(seedPhrase)) {
        throw new AppError(ERROR_MESSAGES.WALLET.INVALID_SEED, 400);
      }

      // 2. Khôi phục wallet từ seed phrase
      const restoredWallet = ethers.Wallet.fromPhrase(seedPhrase.trim());
      
      const privateKey = restoredWallet.privateKey;
      const publicKey = restoredWallet.publicKey;
      const address = restoredWallet.address;

      logger.info(`Wallet restored: ${address}`);

      // 3. Kiểm tra ví đã tồn tại trong DB chưa
      let wallet = await Wallet.findByAddress(address);

      if (wallet) {
        // Nếu đã có, kiểm tra xem có phải của user này không
        if (wallet.userId.toString() !== userId) {
          throw new AppError('Ví này đã được sử dụng bởi người dùng khác', 400);
        }
      } else {
        // Nếu chưa có, tạo mới
        wallet = await Wallet.create({
          userId,
          address: address.toLowerCase(),
          publicKey,
          network,
          balance: '0'
        });
      }

      // 4. Mã hóa seed phrase
      const encryptedSeed = encryptionService.encryptSeedPhrase(seedPhrase, password);

      // 5. Cập nhật số dư
      const balance = await blockchainService.getBalance(address, network);
      await wallet.updateBalance(balance);

      return {
        wallet: {
          id: wallet._id,
          address: wallet.address,
          publicKey: wallet.publicKey,
          network: wallet.network,
          balance: wallet.balance
        },
        encryptedSeed
      };

    } catch (error) {
      logger.logError(error, 'WalletService.restoreWallet');
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(ERROR_MESSAGES.WALLET.CREATION_FAILED, 500);
    }
  }

  /**
   * Lấy private key từ seed phrase đã mã hóa
   * @param {String} encryptedSeed 
   * @param {String} password 
   * @returns {String} - Private key
   */
  getPrivateKeyFromEncryptedSeed(encryptedSeed, password) {
    try {
      // 1. Giải mã seed phrase
      const seedPhrase = encryptionService.decryptSeedPhrase(encryptedSeed, password);
      
      // 2. Derive private key từ seed
      const wallet = ethers.Wallet.fromPhrase(seedPhrase);
      
      return wallet.privateKey;
      
    } catch (error) {
      logger.logError(error, 'WalletService.getPrivateKeyFromEncryptedSeed');
      throw new AppError(ERROR_MESSAGES.WALLET.DECRYPTION_FAILED, 401);
    }
  }

  /**
   * Lấy thông tin ví của user
   * @param {String} userId 
   * @returns {Object}
   */
  async getWalletByUserId(userId) {
    try {
      const wallet = await Wallet.findByUserId(userId);
      
      if (!wallet) {
        throw new AppError(ERROR_MESSAGES.WALLET.WALLET_NOT_FOUND, 404);
      }

      // Cập nhật số dư mới nhất
      const balance = await blockchainService.getBalance(wallet.address, wallet.network);
      await wallet.updateBalance(balance);

      return {
        id: wallet._id,
        address: wallet.address,
        publicKey: wallet.publicKey,
        network: wallet.network,
        balance: wallet.balance,
        createdAt: wallet.createdAt
      };

    } catch (error) {
      logger.logError(error, 'WalletService.getWalletByUserId');
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(ERROR_MESSAGES.SYSTEM.INTERNAL_ERROR, 500);
    }
  }

  /**
   * Cập nhật số dư ví
   * @param {String} walletId 
   * @returns {String} - Balance
   */
  async updateWalletBalance(walletId) {
    try {
      const wallet = await Wallet.findById(walletId);
      
      if (!wallet) {
        throw new AppError(ERROR_MESSAGES.WALLET.WALLET_NOT_FOUND, 404);
      }

      const balance = await blockchainService.getBalance(wallet.address, wallet.network);
      await wallet.updateBalance(balance);

      return balance;

    } catch (error) {
      logger.logError(error, 'WalletService.updateWalletBalance');
      throw new AppError(ERROR_MESSAGES.SYSTEM.INTERNAL_ERROR, 500);
    }
  }

  /**
   * Verify seed phrase với address
   * @param {String} seedPhrase 
   * @param {String} expectedAddress 
   * @returns {Boolean}
   */
  verifySeedPhrase(seedPhrase, expectedAddress) {
    try {
      if (!isValidSeedPhrase(seedPhrase)) {
        return false;
      }

      const wallet = ethers.Wallet.fromPhrase(seedPhrase.trim());
      return wallet.address.toLowerCase() === expectedAddress.toLowerCase();

    } catch (error) {
      logger.logError(error, 'WalletService.verifySeedPhrase');
      return false;
    }
  }
}

module.exports = new WalletService();