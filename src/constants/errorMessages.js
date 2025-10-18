/**
 * Tập trung tất cả error messages
 * File: backend/src/constants/errorMessages.js
 */

const ERROR_MESSAGES = {
  // Auth errors
  AUTH: {
    INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng',
    UNAUTHORIZED: 'Bạn cần đăng nhập để thực hiện thao tác này',
    TOKEN_EXPIRED: 'Phiên đăng nhập đã hết hạn',
    TOKEN_INVALID: 'Token không hợp lệ',
    USER_EXISTS: 'Email này đã được sử dụng',
    USER_NOT_FOUND: 'Người dùng không tồn tại'
  },

  // Wallet errors
  WALLET: {
    CREATION_FAILED: 'Tạo ví thất bại. Vui lòng thử lại',
    INVALID_SEED: 'Cụm từ khôi phục không hợp lệ. Phải có đúng 12 từ',
    INVALID_ADDRESS: 'Địa chỉ ví không hợp lệ',
    WALLET_NOT_FOUND: 'Không tìm thấy ví',
    WALLET_EXISTS: 'Người dùng đã có ví',
    DECRYPTION_FAILED: 'Giải mã thất bại. Mật khẩu không đúng',
    ENCRYPTION_FAILED: 'Mã hóa dữ liệu thất bại'
  },

  // Transaction errors
  TRANSACTION: {
    INVALID_AMOUNT: 'Số tiền không hợp lệ. Phải lớn hơn 0',
    INSUFFICIENT_FUNDS: 'Số dư không đủ để thực hiện giao dịch',
    INVALID_RECIPIENT: 'Địa chỉ người nhận không hợp lệ',
    SEND_FAILED: 'Gửi giao dịch thất bại',
    GAS_ESTIMATION_FAILED: 'Không thể ước tính phí gas',
    TX_NOT_FOUND: 'Không tìm thấy giao dịch',
    BROADCAST_FAILED: 'Phát sóng giao dịch thất bại',
    SAME_ADDRESS: 'Không thể gửi đến chính địa chỉ của bạn'
  },

  // Validation errors
  VALIDATION: {
    REQUIRED_FIELD: 'Trường này là bắt buộc',
    INVALID_EMAIL: 'Email không hợp lệ',
    PASSWORD_TOO_SHORT: 'Mật khẩu phải có ít nhất 8 ký tự',
    PASSWORD_MISMATCH: 'Mật khẩu xác nhận không khớp',
    INVALID_NETWORK: 'Mạng blockchain không hợp lệ'
  },

  // System errors
  SYSTEM: {
    INTERNAL_ERROR: 'Lỗi hệ thống. Vui lòng thử lại sau',
    DATABASE_ERROR: 'Lỗi kết nối cơ sở dữ liệu',
    NETWORK_ERROR: 'Lỗi kết nối mạng blockchain',
    RATE_LIMIT: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau'
  }
};

module.exports = ERROR_MESSAGES;