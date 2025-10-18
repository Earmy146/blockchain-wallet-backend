/**
 * Các hàm validate dữ liệu
 * File: backend/src/utils/validators.js
 */

const { ethers } = require('ethers');
const ERROR_MESSAGES = require('../constants/errorMessages');

/**
 * Validate địa chỉ Ethereum
 * @param {String} address - Địa chỉ cần validate
 * @returns {Boolean}
 */
const isValidAddress = (address) => {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
};

/**
 * Validate số tiền (amount phải > 0 và là số hợp lệ)
 * @param {String|Number} amount - Số tiền
 * @returns {Boolean}
 */
const isValidAmount = (amount) => {
  try {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0 && isFinite(num);
  } catch {
    return false;
  }
};

/**
 * Validate seed phrase (phải có đúng 12 từ)
 * @param {String} seedPhrase - Chuỗi seed phrase
 * @returns {Boolean}
 */
const isValidSeedPhrase = (seedPhrase) => {
  if (!seedPhrase || typeof seedPhrase !== 'string') {
    return false;
  }
  
  const words = seedPhrase.trim().split(/\s+/);
  return words.length === 12 && words.every(word => word.length > 0);
};

/**
 * Validate email format
 * @param {String} email 
 * @returns {Boolean}
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate mật khẩu (tối thiểu 8 ký tự)
 * @param {String} password 
 * @returns {Boolean}
 */
const isValidPassword = (password) => {
  return password && password.length >= 8;
};

/**
 * Validate network name
 * @param {String} network 
 * @returns {Boolean}
 */
const isValidNetwork = (network) => {
  const validNetworks = ['sepolia', 'mainnet'];
  return validNetworks.includes(network?.toLowerCase());
};

/**
 * Validate transaction hash
 * @param {String} txHash 
 * @returns {Boolean}
 */
const isValidTxHash = (txHash) => {
  return /^0x([A-Fa-f0-9]{64})$/.test(txHash);
};

/**
 * Sanitize address (chuyển về lowercase và trim)
 * @param {String} address 
 * @returns {String}
 */
const sanitizeAddress = (address) => {
  return address?.trim().toLowerCase();
};

/**
 * Format số tiền ETH (làm tròn đến 6 chữ số thập phân)
 * @param {String|Number} amount 
 * @returns {String}
 */
const formatAmount = (amount) => {
  return parseFloat(amount).toFixed(6);
};

/**
 * Validate toàn bộ dữ liệu giao dịch
 * @param {Object} txData - {to, amount, from}
 * @returns {Object} {valid: Boolean, errors: Array}
 */
const validateTransaction = (txData) => {
  const errors = [];

  if (!isValidAddress(txData.to)) {
    errors.push({ field: 'to', message: ERROR_MESSAGES.TRANSACTION.INVALID_RECIPIENT });
  }

  if (!isValidAmount(txData.amount)) {
    errors.push({ field: 'amount', message: ERROR_MESSAGES.TRANSACTION.INVALID_AMOUNT });
  }

  if (txData.from && !isValidAddress(txData.from)) {
    errors.push({ field: 'from', message: ERROR_MESSAGES.WALLET.INVALID_ADDRESS });
  }

  // Kiểm tra không gửi cho chính mình
  if (txData.from && txData.to && 
      sanitizeAddress(txData.from) === sanitizeAddress(txData.to)) {
    errors.push({ field: 'to', message: ERROR_MESSAGES.TRANSACTION.SAME_ADDRESS });
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  isValidAddress,
  isValidAmount,
  isValidSeedPhrase,
  isValidEmail,
  isValidPassword,
  isValidNetwork,
  isValidTxHash,
  sanitizeAddress,
  formatAmount,
  validateTransaction
};