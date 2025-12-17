/**
 * Cấu hình kết nối Ethereum blockchain
 * File: backend/src/config/blockchain.config.js
 */

const { ethers } = require('ethers');
const { NETWORKS, DEFAULT_NETWORK } = require('../constants/networks');

class BlockchainConfig {
  constructor() {
    this.providers = {};
    this.initProviders();
  }

  /**
   * Khởi tạo providers cho các networks
   */
  initProviders() {
    try {
      // Sepolia Testnet Provider
      this.providers.sepolia = new ethers.JsonRpcProvider(
        NETWORKS.SEPOLIA.rpcUrl,
        {
          chainId: NETWORKS.SEPOLIA.chainId,
          name: NETWORKS.SEPOLIA.name
        }
      );

      // Mainnet Provider (optional, để sau này mở rộng)
      this.providers.mainnet = new ethers.JsonRpcProvider(
        NETWORKS.MAINNET.rpcUrl,
        {
          chainId: NETWORKS.MAINNET.chainId,
          name: NETWORKS.MAINNET.name
        }
      );

      console.log('✅ Blockchain providers initialized');
    } catch (error) {
      console.error('❌ Failed to initialize blockchain providers:', error);
      throw error;
    }
  }

  /**
   * Lấy provider theo network
   */
  getProvider(network = 'sepolia') {
    const provider = this.providers[network];
    if (!provider) {
      throw new Error(`Provider not found for network: ${network}`);
    }
    return provider;
  }

  /**
   * Lấy thông tin mạng
   */
  getNetworkConfig(network = 'sepolia') {
    return NETWORKS[network.toUpperCase()];
  }

  /**
   * Test kết nối đến blockchain
   */
  async testConnection(network = 'sepolia') {
    try {
      const provider = this.getProvider(network);
      const blockNumber = await provider.getBlockNumber();
      console.log(`✅ Connected to ${network} - Block #${blockNumber}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to connect to ${network}:`, error.message);
      return false;
    }
  }
}

// Export singleton instance
const blockchainConfig = new BlockchainConfig();

module.exports = blockchainConfig;

/**
 * Cấu hình kết nối MongoDB
 * File: backend/src/config/db.config.js
 */

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📂 Database: ${conn.connection.name}`);

    // Lắng nghe các sự kiện
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed due to app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    process.exit(1); // Thoát nếu không kết nối được DB
  }
};

module.exports = connectDB;

/**
 * Tổng hợp tất cả config
 * File: backend/src/config/index.js
 */

require('dotenv').config();

const config = {
  // Server
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT) || 5000,
  
  // Database
  mongoUrl: process.env.MONGO_URL,
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expire: process.env.JWT_EXPIRE || '7d'
  },
  
  // Encryption (dùng cho mã hóa seed phrase)
  encryption: {
    key: process.env.ENCRYPTION_KEY,
    algorithm: 'aes-256-cbc'
  },
  
  // Blockchain
  infura: {
    projectId: process.env.INFURA_PROJECT_ID
  },
  sepolia: {
    rpcUrl: process.env.SEPOLIA_RPC_URL,
    chainId: parseInt(process.env.SEPOLIA_CHAIN_ID)
  },
  
  // CORS
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  // Gas Settings
  gas: {
    defaultLimit: parseInt(process.env.DEFAULT_GAS_LIMIT) || 21000,
    maxPriceGwei: parseInt(process.env.MAX_GAS_PRICE_GWEI) || 50
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 phút
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  }
};

// Validate required environment variables
const requiredEnvVars = [
  'MONGO_URL',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'INFURA_PROJECT_ID',
  'SEPOLIA_RPC_URL'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach(varName => console.error(`   - ${varName}`));
  process.exit(1);
}

module.exports = config;