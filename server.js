/**
 * Server Entry Point
 * File: backend/server.js
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');

// Import config
const config = require('./src/config');
const connectDB = require('./src/config/db.config');
const blockchainConfig = require('./src/config/blockchain.config');

// Import routes
const apiRoutes = require('./src/api');

// Import error handlers
const { errorHandler, notFoundHandler } = require('./src/utils/errorHandler');
const logger = require('./src/utils/logger');

// Khởi tạo Express app
const app = express();

// ======================
// MIDDLEWARES
// ======================

// Security headers
app.use(helmet());

// CORS
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP request logger
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Request ID middleware (để tracking)
app.use((req, res, next) => {
  req.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
  next();
});

// ======================
// ROUTES
// ======================

// Health check trước khi connect DB
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🚀 Blockchain Wallet Backend API',
    version: '1.0.0',
    environment: config.env,
    timestamp: new Date().toISOString()
  });
});

// Mount API routes
app.use('/api', apiRoutes);

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

// ======================
// DATABASE & BLOCKCHAIN CONNECTION
// ======================

const startServer = async () => {
  try {
    // 1. Kết nối MongoDB
    console.log('📦 Connecting to MongoDB...');
    await connectDB();

    // 2. Test kết nối Blockchain
    console.log('⛓️  Testing blockchain connection...');
    const isSepoliaConnected = await blockchainConfig.testConnection('sepolia');
    
    if (!isSepoliaConnected) {
      console.warn('⚠️  Warning: Failed to connect to Sepolia testnet');
    }

    // 3. Start server
    const PORT = config.port || 5000;
    
    const server = app.listen(PORT, () => {
      console.log('');
      console.log('='.repeat(50));
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📍 Environment: ${config.env}`);
      console.log(`🌐 API URL: http://localhost:${PORT}/api`);
      console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
      console.log('='.repeat(50));
      console.log('');
      
      logger.info(`Server started on port ${PORT}`);
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} received. Closing server gracefully...`);
      
      server.close(async () => {
        console.log('✅ HTTP server closed');
        
        // Đóng kết nối DB
        const mongoose = require('mongoose');
        await mongoose.connection.close();
        console.log('✅ MongoDB connection closed');
        
        logger.info('Server shutdown completed');
        process.exit(0);
      });

      // Force shutdown sau 10 giây
      setTimeout(() => {
        console.error('❌ Forcing shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('❌ UNHANDLED REJECTION! Shutting down...');
      logger.logError(err, 'UnhandledRejection');
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('❌ UNCAUGHT EXCEPTION! Shutting down...');
      logger.logError(err, 'UncaughtException');
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    logger.logError(error, 'Server Startup');
    process.exit(1);
  }
};

// Start the server
startServer();

module.exports = app;