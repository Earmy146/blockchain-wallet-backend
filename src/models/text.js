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

/**
 * User Model - Schema người dùng
 * File: backend/src/models/user.model.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email là bắt buộc'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ']
  },
  
  password: {
    type: String,
    required: [true, 'Mật khẩu là bắt buộc'],
    minlength: [8, 'Mật khẩu phải có ít nhất 8 ký tự'],
    select: false // Không trả về password khi query
  },
  
  // Tùy chọn: Thêm username nếu muốn
  username: {
    type: String,
    trim: true,
    maxlength: 50
  },
  
  // Trạng thái tài khoản
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Thời gian đăng nhập cuối
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true, // Tự động thêm createdAt và updatedAt
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.password;
      return ret;
    }
  }
});

// Virtual field để lấy thông tin ví (relationship)
userSchema.virtual('wallet', {
  ref: 'Wallet',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

// Pre-save middleware: Hash password trước khi lưu
userSchema.pre('save', async function(next) {
  // Chỉ hash nếu password được modify
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method: So sánh password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Method: Cập nhật lastLogin
userSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save();
};

// Static method: Tìm user theo email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

const User = mongoose.model('User', userSchema);

module.exports = User;


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