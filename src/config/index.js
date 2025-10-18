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