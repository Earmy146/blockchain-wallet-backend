# 🚀 Blockchain Wallet Backend API

Backend API cho ứng dụng ví điện tử blockchain sử dụng Node.js, Express, MongoDB và Ethers.js.

## 📋 Tính năng

### 🔐 Authentication
- Đăng ký/Đăng nhập với JWT
- Bảo mật mật khẩu với bcrypt
- Rate limiting chống brute-force

### 💼 Wallet Management
- Tạo ví mới (generate 12 từ seed phrase)
- Khôi phục ví từ seed phrase
- Mã hóa seed phrase với mật khẩu người dùng
- Hỗ trợ Sepolia Testnet & Ethereum Mainnet

### 💸 Transactions
- Gửi ETH đến địa chỉ khác
- Ước tính phí gas
- Lịch sử giao dịch
- Tracking trạng thái giao dịch
- Export giao dịch ra CSV

## 🛠️ Tech Stack

- **Node.js** v16+
- **Express.js** - Web framework
- **MongoDB** - Database
- **Ethers.js** - Ethereum library
- **JWT** - Authentication
- **Crypto-js** - Encryption
- **Winston** - Logging

## 📦 Cài đặt

### 1. Clone repository

```bash
git clone <your-repo-url>
cd backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Cấu hình Environment Variables

Tạo file `.env` từ `.env.example`:

```bash
cp .env.example .env
```

Cập nhật các biến sau trong `.env`:

```env
# MongoDB
MONGO_URL=mongodb+srv://your-username:your-password@cluster.mongodb.net/blockchain-wallet

# JWT Secret (generate mới)
JWT_SECRET=your-random-secret-key-here

# Encryption Key (32 ký tự)
ENCRYPTION_KEY=your-32-character-encryption-key

# Infura Project ID (đăng ký tại https://infura.io)
INFURA_PROJECT_ID=your-infura-project-id
```

### 4. Khởi động server

Development mode với nodemon:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server sẽ chạy tại: `http://localhost:5000`

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Endpoints

#### 🔐 Authentication (`/api/users`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Đăng ký tài khoản | ❌ |
| POST | `/login` | Đăng nhập | ❌ |
| GET | `/me` | Thông tin user | ✅ |
| PUT | `/change-password` | Đổi mật khẩu | ✅ |

#### 💼 Wallet (`/api/wallet`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/create` | Tạo ví mới | ✅ |
| POST | `/restore` | Khôi phục ví | ✅ |
| GET | `/` | Lấy thông tin ví | ✅ |
| GET | `/balance` | Cập nhật số dư | ✅ |
| POST | `/reveal-seed` | Xem seed phrase | ✅ |

#### 💸 Transactions (`/api/transactions`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/send` | Gửi ETH | ✅ |
| POST | `/estimate-fee` | Ước tính phí gas | ✅ |
| GET | `/history` | Lịch sử giao dịch | ✅ |
| GET | `/stats` | Thống kê | ✅ |
| GET | `/:id` | Chi tiết giao dịch | ✅ |

## 🧪 Testing

```bash
npm test
```

## 📁 Cấu trúc thư mục

```
backend/
├── src/
│   ├── api/                    # Routes
│   ├── controllers/            # Controllers
│   ├── services/               # Business logic
│   ├── models/                 # MongoDB models
│   ├── middlewares/            # Middlewares
│   ├── config/                 # Configuration
│   ├── utils/                  # Utilities
│   └── constants/              # Constants
├── logs/                       # Log files
├── .env                        # Environment variables
├── server.js                   # Entry point
└── package.json
```

## 🔒 Bảo mật

- ✅ JWT authentication
- ✅ Password hashing với bcrypt
- ✅ Rate limiting
- ✅ Input validation
- ✅ Helmet security headers
- ✅ CORS protection
- ⚠️ **KHÔNG LƯU** seed phrase/private key trong database
- ⚠️ Seed phrase được mã hóa với mật khẩu người dùng và lưu trong localStorage

## 🚨 Lưu ý quan trọng

### Seed Phrase Security
- Seed phrase **CHỈ hiển thị 1 lần** khi tạo ví mới
- User phải backup seed phrase ngay lập tức
- Backend mã hóa seed phrase trước khi trả về frontend
- Frontend lưu encrypted seed vào localStorage
- Không bao giờ gửi seed phrase không mã hóa qua mạng

### Private Key Security
- Private key **KHÔNG BAO GIỜ** được lưu vào database
- Private key chỉ được derive từ seed phrase khi cần ký transaction
- Sau khi ký xong, private key bị xóa khỏi memory

## 📖 Tài liệu tham khảo

- [Ethers.js Documentation](https://docs.ethers.org/)
- [Express.js Guide](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [BIP39 Standard](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)

## 📝 License

MIT License

## 👨‍💻 Author

Your Name - Đồ án môn học Blockchain