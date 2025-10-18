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