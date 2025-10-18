/**
 * Transaction Model - Schema giao dịch
 * File: backend/src/models/transaction.model.js
 */

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Liên kết với Wallet
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  
  // Transaction Hash (unique identifier trên blockchain)
  txHash: {
    type: String,
    required: [true, 'Transaction hash là bắt buộc'],
    unique: true,
    match: [/^0x[a-fA-F0-9]{64}$/, 'Transaction hash không hợp lệ']
  },
  
  // Địa chỉ người gửi
  from: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Địa chỉ người gửi không hợp lệ']
  },
  
  // Địa chỉ người nhận
  to: {
    type: String,
    required: true,
    lowercase: true,
    match: [/^0x[a-fA-F0-9]{40}$/, 'Địa chỉ người nhận không hợp lệ']
  },
  
  // Số tiền (lưu dưới dạng string để tránh mất độ chính xác)
  amount: {
    type: String,
    required: [true, 'Số tiền là bắt buộc']
  },
  
  // Phí gas đã sử dụng
  gasUsed: {
    type: String,
    default: '0'
  },
  
  // Giá gas (gwei)
  gasPrice: {
    type: String,
    default: '0'
  },
  
  // Tổng phí (gasUsed * gasPrice)
  totalFee: {
    type: String,
    default: '0'
  },
  
  // Block number
  blockNumber: {
    type: Number,
    default: null
  },
  
  // Trạng thái giao dịch
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending'
  },
  
  // Loại giao dịch
  type: {
    type: String,
    enum: ['send', 'receive'],
    required: true
  },
  
  // Mạng blockchain
  network: {
    type: String,
    enum: ['sepolia', 'mainnet'],
    default: 'sepolia',
    lowercase: true
  },
  
  // Thời gian giao dịch trên blockchain
  blockTimestamp: {
    type: Date,
    default: null
  },
  
  // Số confirmations
  confirmations: {
    type: Number,
    default: 0
  },
  
  // Ghi chú (optional)
  note: {
    type: String,
    maxlength: 200,
    default: null
  },
  
  // Link explorer
  explorerUrl: {
    type: String,
    default: null
  }
}, {
  timestamps: true, // createdAt sẽ là thời gian tạo trong hệ thống
  toJSON: { virtuals: true }
});

// Index để query nhanh
transactionSchema.index({ walletId: 1, createdAt: -1 });
transactionSchema.index({ txHash: 1 });
transactionSchema.index({ from: 1 });
transactionSchema.index({ to: 1 });
transactionSchema.index({ status: 1 });

// Virtual field: Format amount để hiển thị
transactionSchema.virtual('formattedAmount').get(function() {
  return parseFloat(this.amount).toFixed(6);
});

// Method: Cập nhật trạng thái giao dịch
transactionSchema.methods.updateStatus = async function(status, blockNumber = null, confirmations = 0) {
  this.status = status;
  if (blockNumber) {
    this.blockNumber = blockNumber;
    this.blockTimestamp = new Date();
  }
  this.confirmations = confirmations;
  await this.save();
};

// Static method: Lấy lịch sử giao dịch của ví
transactionSchema.statics.getWalletHistory = function(walletId, limit = 20) {
  return this.find({ walletId })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Static method: Tìm giao dịch theo hash
transactionSchema.statics.findByHash = function(txHash) {
  return this.findOne({ txHash });
};

// Static method: Lấy giao dịch pending của ví
transactionSchema.statics.getPendingTransactions = function(walletId) {
  return this.find({ 
    walletId, 
    status: 'pending' 
  }).sort({ createdAt: -1 });
};

// Static method: Tính tổng số tiền đã gửi
transactionSchema.statics.getTotalSent = async function(walletId) {
  const result = await this.aggregate([
    { 
      $match: { 
        walletId: mongoose.Types.ObjectId(walletId),
        type: 'send',
        status: 'confirmed'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $toDouble: '$amount' } }
      }
    }
  ]);
  
  return result.length > 0 ? result[0].total : 0;
};

// Static method: Tính tổng số tiền đã nhận
transactionSchema.statics.getTotalReceived = async function(walletId) {
  const result = await this.aggregate([
    { 
      $match: { 
        walletId: mongoose.Types.ObjectId(walletId),
        type: 'receive',
        status: 'confirmed'
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: { $toDouble: '$amount' } }
      }
    }
  ]);
  
  return result.length > 0 ? result[0].total : 0;
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;