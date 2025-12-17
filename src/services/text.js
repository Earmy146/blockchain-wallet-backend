/**
 * Blockchain Service - Tương tác với Ethereum blockchain
 * File: backend/src/services/blockchain.service.js
 */

const { ethers } = require('ethers');
const blockchainConfig = require('../config/blockchain.config');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');
const ERROR_MESSAGES = require('../constants/errorMessages');
const { NETWORKS } = require('../constants/networks');

class BlockchainService {
  /**
   * Lấy provider theo network
   */
  getProvider(network = 'sepolia') {
    return blockchainConfig.getProvider(network);
  }

  /**
   * Lấy số dư ví (Balance)
   * @param {String} address - Địa chỉ ví
   * @param {String} network - Mạng blockchain
   * @returns {String} - Số dư ETH
   */
  async getBalance(address, network = 'sepolia') {
    try {
      const provider = this.getProvider(network);
      const balanceWei = await provider.getBalance(address);
      const balanceEth = ethers.formatEther(balanceWei);
      
      logger.info(`Balance for ${address}: ${balanceEth} ETH`);
      return balanceEth;
      
    } catch (error) {
      logger.logError(error, 'BlockchainService.getBalance');
      throw new AppError(ERROR_MESSAGES.SYSTEM.NETWORK_ERROR, 503);
    }
  }

  /**
   * Ước tính gas fee cho giao dịch
   * @param {String} from - Địa chỉ người gửi
   * @param {String} to - Địa chỉ người nhận
   * @param {String} amount - Số tiền (ETH)
   * @param {String} network 
   * @returns {Object} - {gasLimit, gasPrice, totalFee}
   */
  async estimateGas(from, to, amount, network = 'sepolia') {
    try {
      const provider = this.getProvider(network);
      
      // Lấy gas price hiện tại
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice;
      
      // Ước tính gas limit
      const amountWei = ethers.parseEther(amount);
      
      const estimatedGas = await provider.estimateGas({
        from,
        to,
        value: amountWei
      });
      
      // Tính tổng phí (gasLimit * gasPrice)
      const totalFee = estimatedGas * gasPrice;
      const totalFeeEth = ethers.formatEther(totalFee);
      
      logger.info(`Gas estimation: ${estimatedGas.toString()} units, Fee: ${totalFeeEth} ETH`);
      
      return {
        gasLimit: estimatedGas.toString(),
        gasPrice: gasPrice.toString(),
        gasPriceGwei: ethers.formatUnits(gasPrice, 'gwei'),
        totalFee: totalFee.toString(),
        totalFeeEth
      };
      
    } catch (error) {
      logger.logError(error, 'BlockchainService.estimateGas');
      throw new AppError(ERROR_MESSAGES.TRANSACTION.GAS_ESTIMATION_FAILED, 400);
    }
  }

  /**
   * Lấy thông tin giao dịch từ blockchain
   * @param {String} txHash - Transaction hash
   * @param {String} network 
   * @returns {Object} - Thông tin giao dịch
   */
  async getTransaction(txHash, network = 'sepolia') {
    try {
      const provider = this.getProvider(network);
      
      // Lấy transaction
      const tx = await provider.getTransaction(txHash);
      
      if (!tx) {
        throw new AppError(ERROR_MESSAGES.TRANSACTION.TX_NOT_FOUND, 404);
      }
      
      // Lấy receipt (nếu đã confirmed)
      const receipt = await provider.getTransactionReceipt(txHash);
      
      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: ethers.formatEther(tx.value),
        gasLimit: tx.gasLimit.toString(),
        gasPrice: tx.gasPrice?.toString() || '0',
        nonce: tx.nonce,
        blockNumber: tx.blockNumber,
        confirmations: receipt ? await tx.confirmations() : 0,
        status: receipt ? (receipt.status === 1 ? 'confirmed' : 'failed') : 'pending',
        gasUsed: receipt ? receipt.gasUsed.toString() : '0'
      };
      
    } catch (error) {
      logger.logError(error, 'BlockchainService.getTransaction');
      
      if (error.statusCode === 404) {
        throw error;
      }
      
      throw new AppError(ERROR_MESSAGES.SYSTEM.NETWORK_ERROR, 503);
    }
  }

  /**
   * Lấy số block hiện tại
   * @param {String} network 
   * @returns {Number}
   */
  async getCurrentBlock(network = 'sepolia') {
    try {
      const provider = this.getProvider(network);
      const blockNumber = await provider.getBlockNumber();
      return blockNumber;
    } catch (error) {
      logger.logError(error, 'BlockchainService.getCurrentBlock');
      throw new AppError(ERROR_MESSAGES.SYSTEM.NETWORK_ERROR, 503);
    }
  }

  /**
   * Lấy transaction count (nonce) của địa chỉ
   * @param {String} address 
   * @param {String} network 
   * @returns {Number}
   */
  async getTransactionCount(address, network = 'sepolia') {
    try {
      const provider = this.getProvider(network);
      const count = await provider.getTransactionCount(address);
      return count;
    } catch (error) {
      logger.logError(error, 'BlockchainService.getTransactionCount');
      throw new AppError(ERROR_MESSAGES.SYSTEM.NETWORK_ERROR, 503);
    }
  }

  /**
   * Lấy link explorer cho giao dịch
   * @param {String} txHash 
   * @param {String} network 
   * @returns {String}
   */
  getExplorerUrl(txHash, network = 'sepolia') {
    const networkConfig = NETWORKS[network.toUpperCase()];
    return `${networkConfig.explorer}/tx/${txHash}`;
  }

  /**
   * Kiểm tra kết nối blockchain
   * @param {String} network 
   * @returns {Boolean}
   */
  async testConnection(network = 'sepolia') {
    try {
      const provider = this.getProvider(network);
      const blockNumber = await provider.getBlockNumber();
      logger.info(`Connected to ${network} - Block #${blockNumber}`);
      return true;
    } catch (error) {
      logger.logError(error, 'BlockchainService.testConnection');
      return false;
    }
  }

  /**
   * Chờ giao dịch được confirm
   * @param {String} txHash 
   * @param {Number} confirmations - Số block confirm cần chờ
   * @param {String} network 
   * @returns {Object} - Receipt
   */
  async waitForTransaction(txHash, confirmations = 1, network = 'sepolia') {
    try {
      const provider = this.getProvider(network);
      logger.info(`Waiting for ${confirmations} confirmation(s) for tx: ${txHash}`);
      
      const receipt = await provider.waitForTransaction(txHash, confirmations);
      
      if (!receipt) {
        throw new AppError('Transaction receipt not found', 404);
      }
      
      logger.info(`Transaction ${txHash} confirmed in block ${receipt.blockNumber}`);
      return receipt;
      
    } catch (error) {
      logger.logError(error, 'BlockchainService.waitForTransaction');
      throw new AppError(ERROR_MESSAGES.SYSTEM.NETWORK_ERROR, 503);
    }
  }
}

module.exports = new BlockchainService();

/**
 * Encryption Service - Mã hóa/Giải mã seed phrase
 * File: backend/src/services/encryption.service.js
 * 
 * Sử dụng crypto-js (AES-256) để mã hóa seed phrase với mật khẩu người dùng
 */

const CryptoJS = require('crypto-js');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');
const ERROR_MESSAGES = require('../constants/errorMessages');

class EncryptionService {
  /**
   * Mã hóa seed phrase bằng mật khẩu người dùng
   * @param {String} seedPhrase - 12 từ seed phrase
   * @param {String} password - Mật khẩu người dùng
   * @returns {String} - Chuỗi đã mã hóa (base64)
   */
  encryptSeedPhrase(seedPhrase, password) {
    try {
      if (!seedPhrase || !password) {
        throw new AppError('Seed phrase và mật khẩu là bắt buộc', 400);
      }

      // Mã hóa bằng AES
      const encrypted = CryptoJS.AES.encrypt(seedPhrase, password).toString();
      
      logger.info('Seed phrase encrypted successfully');
      return encrypted;
      
    } catch (error) {
      logger.logError(error, 'EncryptionService.encryptSeedPhrase');
      throw new AppError(ERROR_MESSAGES.WALLET.ENCRYPTION_FAILED, 500);
    }
  }

  /**
   * Giải mã seed phrase
   * @param {String} encryptedSeed - Chuỗi đã mã hóa
   * @param {String} password - Mật khẩu người dùng
   * @returns {String} - Seed phrase gốc
   */
  decryptSeedPhrase(encryptedSeed, password) {
    try {
      if (!encryptedSeed || !password) {
        throw new AppError('Encrypted seed và mật khẩu là bắt buộc', 400);
      }

      // Giải mã
      const bytes = CryptoJS.AES.decrypt(encryptedSeed, password);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);

      // Kiểm tra kết quả giải mã
      if (!decrypted) {
        throw new AppError(ERROR_MESSAGES.WALLET.DECRYPTION_FAILED, 401);
      }

      logger.info('Seed phrase decrypted successfully');
      return decrypted;
      
    } catch (error) {
      logger.logError(error, 'EncryptionService.decryptSeedPhrase');
      
      // Nếu lỗi do mật khẩu sai
      if (error.message.includes('Malformed')) {
        throw new AppError(ERROR_MESSAGES.WALLET.DECRYPTION_FAILED, 401);
      }
      
      throw new AppError(ERROR_MESSAGES.WALLET.DECRYPTION_FAILED, 500);
    }
  }

  /**
   * Mã hóa private key (backup khẩn cấp)
   * @param {String} privateKey 
   * @param {String} password 
   * @returns {String}
   */
  encryptPrivateKey(privateKey, password) {
    try {
      const encrypted = CryptoJS.AES.encrypt(privateKey, password).toString();
      return encrypted;
    } catch (error) {
      logger.logError(error, 'EncryptionService.encryptPrivateKey');
      throw new AppError(ERROR_MESSAGES.WALLET.ENCRYPTION_FAILED, 500);
    }
  }

  /**
   * Giải mã private key
   * @param {String} encryptedKey 
   * @param {String} password 
   * @returns {String}
   */
  decryptPrivateKey(encryptedKey, password) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedKey, password);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decrypted) {
        throw new AppError(ERROR_MESSAGES.WALLET.DECRYPTION_FAILED, 401);
      }
      
      return decrypted;
    } catch (error) {
      logger.logError(error, 'EncryptionService.decryptPrivateKey');
      throw new AppError(ERROR_MESSAGES.WALLET.DECRYPTION_FAILED, 500);
    }
  }

  /**
   * Tạo hash để verify dữ liệu
   * @param {String} data 
   * @returns {String}
   */
  createHash(data) {
    return CryptoJS.SHA256(data).toString();
  }

  /**
   * So sánh hash
   * @param {String} data 
   * @param {String} hash 
   * @returns {Boolean}
   */
  verifyHash(data, hash) {
    const newHash = this.createHash(data);
    return newHash === hash;
  }
}

module.exports = new EncryptionService();

/**
 * Transaction Service - Gửi & Nhận ETH
 * File: backend/src/services/transaction.service.js
 */

const { ethers } = require('ethers');
const Transaction = require('../models/transaction.model');
const Wallet = require('../models/wallet.model');
const blockchainService = require('./blockchain.service');
const walletService = require('./wallet.service');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errorHandler');
const ERROR_MESSAGES = require('../constants/errorMessages');
const { validateTransaction, sanitizeAddress } = require('../utils/validators');

class TransactionService {
  /**
   * Gửi ETH
   * @param {String} walletId - ID ví người gửi
   * @param {String} toAddress - Địa chỉ người nhận
   * @param {String} amount - Số tiền (ETH)
   * @param {String} encryptedSeed - Seed đã mã hóa
   * @param {String} password - Mật khẩu để giải mã seed
   * @returns {Object} - Transaction info
   */
  async sendTransaction(walletId, toAddress, amount, encryptedSeed, password) {
    try {
      // 1. Lấy thông tin ví người gửi
      const wallet = await Wallet.findById(walletId);
      if (!wallet) {
        throw new AppError(ERROR_MESSAGES.WALLET.WALLET_NOT_FOUND, 404);
      }

      const fromAddress = wallet.address;
      const network = wallet.network;

      // 2. Validate dữ liệu giao dịch
      const validation = validateTransaction({
        from: fromAddress,
        to: toAddress,
        amount
      });

      if (!validation.valid) {
        throw new AppError(validation.errors[0].message, 400);
      }

      // 3. Kiểm tra số dư
      const balance = await blockchainService.getBalance(fromAddress, network);
      const balanceNum = parseFloat(balance);
      const amountNum = parseFloat(amount);

      // 4. Ước tính gas fee
      const gasEstimate = await blockchainService.estimateGas(
        fromAddress,
        toAddress,
        amount,
        network
      );

      const totalFeeEth = parseFloat(gasEstimate.totalFeeEth);
      const totalRequired = amountNum + totalFeeEth;

      if (balanceNum < totalRequired) {
        throw new AppError(
          `${ERROR_MESSAGES.TRANSACTION.INSUFFICIENT_FUNDS}. Cần: ${totalRequired.toFixed(6)} ETH, Có: ${balanceNum.toFixed(6)} ETH`,
          400
        );
      }

      // 5. Lấy private key từ encrypted seed
      const privateKey = walletService.getPrivateKeyFromEncryptedSeed(encryptedSeed, password);

      // 6. Tạo wallet signer
      const provider = blockchainService.getProvider(network);
      const signer = new ethers.Wallet(privateKey, provider);

      // Verify địa chỉ khớp
      if (signer.address.toLowerCase() !== fromAddress.toLowerCase()) {
        throw new AppError('Mật khẩu không đúng hoặc seed phrase không khớp', 401);
      }

      // 7. Build transaction
      const tx = {
        to: toAddress,
        value: ethers.parseEther(amount),
        gasLimit: gasEstimate.gasLimit,
        gasPrice: gasEstimate.gasPrice
      };

      logger.info(`Sending transaction: ${amount} ETH from ${fromAddress} to ${toAddress}`);

      // 8. Ký và gửi transaction
      const txResponse = await signer.sendTransaction(tx);
      const txHash = txResponse.hash;

      logger.info(`Transaction sent: ${txHash}`);

      // 9. Lưu vào database với status pending
      const transaction = await Transaction.create({
        walletId,
        txHash,
        from: fromAddress.toLowerCase(),
        to: sanitizeAddress(toAddress),
        amount,
        gasUsed: '0',
        gasPrice: gasEstimate.gasPrice,
        totalFee: gasEstimate.totalFee,
        status: 'pending',
        type: 'send',
        network,
        explorerUrl: blockchainService.getExplorerUrl(txHash, network)
      });

      // 10. Chờ transaction được confirm (async - không block response)
      this.waitForConfirmation(txHash, transaction._id, network).catch(err => {
        logger.logError(err, 'TransactionService.waitForConfirmation');
      });

      return {
        transaction: {
          id: transaction._id,
          txHash,
          from: fromAddress,
          to: toAddress,
          amount,
          gasEstimate: gasEstimate.totalFeeEth,
          status: 'pending',
          explorerUrl: transaction.explorerUrl
        }
      };

    } catch (error) {
      logger.logError(error, 'TransactionService.sendTransaction');

      if (error instanceof AppError) {
        throw error;
      }

      // Xử lý lỗi từ ethers.js
      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new AppError(ERROR_MESSAGES.TRANSACTION.INSUFFICIENT_FUNDS, 400);
      }

      throw new AppError(ERROR_MESSAGES.TRANSACTION.SEND_FAILED, 500);
    }
  }

  /**
   * Chờ transaction được confirm và cập nhật DB
   * @param {String} txHash 
   * @param {String} transactionId 
   * @param {String} network 
   */
  async waitForConfirmation(txHash, transactionId, network) {
    try {
      logger.info(`Waiting for confirmation: ${txHash}`);

      // Chờ 1 confirmation
      const receipt = await blockchainService.waitForTransaction(txHash, 1, network);

      // Cập nhật trạng thái trong DB
      const transaction = await Transaction.findById(transactionId);
      if (transaction) {
        const status = receipt.status === 1 ? 'confirmed' : 'failed';
        await transaction.updateStatus(
          status,
          receipt.blockNumber,
          1 // confirmations
        );

        // Cập nhật gasUsed
        transaction.gasUsed = receipt.gasUsed.toString();
        await transaction.save();

        logger.info(`Transaction ${txHash} ${status} in block ${receipt.blockNumber}`);
      }

    } catch (error) {
      logger.logError(error, 'TransactionService.waitForConfirmation');
      
      // Đánh dấu là failed nếu có lỗi
      try {
        await Transaction.findByIdAndUpdate(transactionId, { status: 'failed' });
      } catch (updateError) {
        logger.logError(updateError, 'Failed to update transaction status');
      }
    }
  }

  /**
   * Lấy lịch sử giao dịch của ví
   * @param {String} walletId 
   * @param {Number} limit 
   * @returns {Array}
   */
  async getTransactionHistory(walletId, limit = 20) {
    try {
      const wallet = await Wallet.findById(walletId);
      if (!wallet) {
        throw new AppError(ERROR_MESSAGES.WALLET.WALLET_NOT_FOUND, 404);
      }

      const transactions = await Transaction.getWalletHistory(walletId, limit);

      return transactions.map(tx => ({
        id: tx._id,
        txHash: tx.txHash,
        from: tx.from,
        to: tx.to,
        amount: tx.amount,
        type: tx.type,
        status: tx.status,
        gasUsed: tx.gasUsed,
        totalFee: tx.totalFee,
        blockNumber: tx.blockNumber,
        confirmations: tx.confirmations,
        explorerUrl: tx.explorerUrl,
        createdAt: tx.createdAt
      }));

    } catch (error) {
      logger.logError(error, 'TransactionService.getTransactionHistory');
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(ERROR_MESSAGES.SYSTEM.INTERNAL_ERROR, 500);
    }
  }

  /**
   * Lấy chi tiết giao dịch
   * @param {String} transactionId 
   * @returns {Object}
   */
  async getTransactionDetail(transactionId) {
    try {
      const transaction = await Transaction.findById(transactionId)
        .populate('walletId', 'address network');

      if (!transaction) {
        throw new AppError(ERROR_MESSAGES.TRANSACTION.TX_NOT_FOUND, 404);
      }

      // Nếu pending, kiểm tra trạng thái mới nhất từ blockchain
      if (transaction.status === 'pending') {
        try {
          const txInfo = await blockchainService.getTransaction(
            transaction.txHash,
            transaction.network
          );

          if (txInfo.status !== 'pending') {
            await transaction.updateStatus(
              txInfo.status,
              txInfo.blockNumber,
              txInfo.confirmations
            );
            transaction.gasUsed = txInfo.gasUsed;
            await transaction.save();
          }
        } catch (err) {
          logger.logError(err, 'Error updating transaction status');
        }
      }

      return {
        id: transaction._id,
        txHash: transaction.txHash,
        from: transaction.from,
        to: transaction.to,
        amount: transaction.amount,
        type: transaction.type,
        status: transaction.status,
        gasUsed: transaction.gasUsed,
        gasPrice: transaction.gasPrice,
        totalFee: transaction.totalFee,
        blockNumber: transaction.blockNumber,
        confirmations: transaction.confirmations,
        network: transaction.network,
        explorerUrl: transaction.explorerUrl,
        createdAt: transaction.createdAt,
        blockTimestamp: transaction.blockTimestamp
      };

    } catch (error) {
      logger.logError(error, 'TransactionService.getTransactionDetail');
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(ERROR_MESSAGES.SYSTEM.INTERNAL_ERROR, 500);
    }
  }

  /**
   * Lấy giao dịch đang pending
   * @param {String} walletId 
   * @returns {Array}
   */
  async getPendingTransactions(walletId) {
    try {
      const wallet = await Wallet.findById(walletId);
      if (!wallet) {
        throw new AppError(ERROR_MESSAGES.WALLET.WALLET_NOT_FOUND, 404);
      }

      const pendingTxs = await Transaction.getPendingTransactions(walletId);

      // Update status cho từng pending transaction
      for (const tx of pendingTxs) {
        try {
          const txInfo = await blockchainService.getTransaction(tx.txHash, wallet.network);
          
          if (txInfo.status !== 'pending') {
            await tx.updateStatus(txInfo.status, txInfo.blockNumber, txInfo.confirmations);
            tx.gasUsed = txInfo.gasUsed;
            await tx.save();
          }
        } catch (err) {
          logger.logError(err, `Error checking pending tx: ${tx.txHash}`);
        }
      }

      return pendingTxs;

    } catch (error) {
      logger.logError(error, 'TransactionService.getPendingTransactions');
      throw new AppError(ERROR_MESSAGES.SYSTEM.INTERNAL_ERROR, 500);
    }
  }

  /**
   * Ước tính phí gas cho giao dịch
   * @param {String} walletId 
   * @param {String} toAddress 
   * @param {String} amount 
   * @returns {Object}
   */
  async estimateTransactionFee(walletId, toAddress, amount) {
    try {
      const wallet = await Wallet.findById(walletId);
      if (!wallet) {
        throw new AppError(ERROR_MESSAGES.WALLET.WALLET_NOT_FOUND, 404);
      }

      const gasEstimate = await blockchainService.estimateGas(
        wallet.address,
        toAddress,
        amount,
        wallet.network
      );

      return {
        gasLimit: gasEstimate.gasLimit,
        gasPrice: gasEstimate.gasPriceGwei + ' Gwei',
        estimatedFee: gasEstimate.totalFeeEth + ' ETH',
        totalAmount: (parseFloat(amount) + parseFloat(gasEstimate.totalFeeEth)).toFixed(6) + ' ETH'
      };

    } catch (error) {
      logger.logError(error, 'TransactionService.estimateTransactionFee');
      
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(ERROR_MESSAGES.TRANSACTION.GAS_ESTIMATION_FAILED, 400);
    }
  }

  /**
   * Thống kê giao dịch
   * @param {String} walletId 
   * @returns {Object}
   */
  async getTransactionStats(walletId) {
    try {
      const wallet = await Wallet.findById(walletId);
      if (!wallet) {
        throw new AppError(ERROR_MESSAGES.WALLET.WALLET_NOT_FOUND, 404);
      }

      const [totalSent, totalReceived, allTransactions] = await Promise.all([
        Transaction.getTotalSent(walletId),
        Transaction.getTotalReceived(walletId),
        Transaction.find({ walletId })
      ]);

      const confirmedCount = allTransactions.filter(tx => tx.status === 'confirmed').length;
      const pendingCount = allTransactions.filter(tx => tx.status === 'pending').length;
      const failedCount = allTransactions.filter(tx => tx.status === 'failed').length;

      return {
        totalSent: totalSent.toFixed(6),
        totalReceived: totalReceived.toFixed(6),
        totalTransactions: allTransactions.length,
        confirmed: confirmedCount,
        pending: pendingCount,
        failed: failedCount
      };

    } catch (error) {
      logger.logError(error, 'TransactionService.getTransactionStats');
      throw new AppError(ERROR_MESSAGES.SYSTEM.INTERNAL_ERROR, 500);
    }
  }
}

module.exports = new TransactionService();

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
/**
 * Khôi phục ví từ seed phrase - WITH DEBUG
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

    // ✅ DEBUG: Log userId
    console.log('=== RESTORE WALLET DEBUG ===');
    console.log('Current userId:', userId);
    console.log('userId type:', typeof userId);
    console.log('userId string:', userId.toString());

    // 3. Kiểm tra ví đã tồn tại trong DB chưa
    let wallet = await Wallet.findByAddress(address);

    if (wallet) {
      // ✅ DEBUG: Log wallet info
      console.log('Wallet found in DB:');
      console.log('  - wallet.userId:', wallet.userId);
      console.log('  - wallet.userId type:', typeof wallet.userId);
      console.log('  - wallet.userId toString:', wallet.userId.toString());
      
      // So sánh userId
      const walletUserIdStr = wallet.userId.toString().trim();
      const currentUserIdStr = userId.toString().trim();
      
      console.log('Comparison:');
      console.log('  - walletUserIdStr:', walletUserIdStr);
      console.log('  - currentUserIdStr:', currentUserIdStr);
      console.log('  - Are equal?:', walletUserIdStr === currentUserIdStr);
      
      // Nếu đã có, kiểm tra xem có phải của user này không
      if (walletUserIdStr !== currentUserIdStr) {
        console.error('❌ USER ID MISMATCH!');
        throw new AppError('Ví này đã được sử dụng bởi người dùng khác', 400);
      }
      
      console.log('✅ User ID matches, updating wallet...');
    } else {
      // Nếu chưa có, tạo mới
      console.log('✅ Wallet not found, creating new...');
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

    console.log('=== RESTORE COMPLETED ===');

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