/**
 * Wallet Model - Schema ví điện tử
 * File: backend/src/models/wallet.model.js
 * 
 * LƯU Ý: Không lưu seed phrase và private key trong DB!
 */

const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  // Liên kết với User
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // Mỗi user chỉ có 1 ví
  },
  
  // Địa chỉ ví (public)
  address: {
    type: String,
    required: [true, 'Địa chỉ ví là bắt buộc'],
    unique: true,
    lowercase: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Địa chỉ Ethereum không hợp lệ']
  },
  
  // Public Key (optional - có thể lưu để hiển thị)
  publicKey: {
    type: String,
    default: null
  },
  
  // Mạng đang sử dụng
  network: {
    type: String,
    enum: ['sepolia', 'mainnet'],
    default: 'sepolia',
    lowercase: true
  },
  
  // Số dư hiện tại (cache - không phải nguồn chính thống)
  // Chỉ để hiển thị nhanh, luôn verify bằng blockchain
  balance: {
    type: String,
    default: '0'
  },
  
  // Thời gian cập nhật số dư lần cuối
  lastBalanceUpdate: {
    type: Date,
    default: Date.now
  },
  
  // Trạng thái ví
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true }
});

// Virtual field: Lấy danh sách giao dịch
walletSchema.virtual('transactions', {
  ref: 'Transaction',
  localField: '_id',
  foreignField: 'walletId'
});

// Index để query nhanh
walletSchema.index({ userId: 1 });
walletSchema.index({ address: 1 });

// Method: Cập nhật số dư
walletSchema.methods.updateBalance = async function(newBalance) {
  this.balance = newBalance;
  this.lastBalanceUpdate = new Date();
  await this.save();
};

// Static method: Tìm ví theo address
walletSchema.statics.findByAddress = function(address) {
  return this.findOne({ address: address.toLowerCase() });
};

// Static method: Tìm ví theo userId
walletSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId });
};

// Static method: Kiểm tra địa chỉ đã tồn tại chưa
walletSchema.statics.isAddressExists = async function(address) {
  const wallet = await this.findOne({ address: address.toLowerCase() });
  return !!wallet;
};

const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;