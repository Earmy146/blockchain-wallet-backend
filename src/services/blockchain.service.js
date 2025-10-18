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