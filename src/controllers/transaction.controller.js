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