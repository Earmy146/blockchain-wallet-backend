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