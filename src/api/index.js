/**
 * API Routes Aggregator
 * File: backend/src/api/index.js
 */

const express = require('express');
const router = express.Router();

// Import routes
const userRoutes = require('./user.routes');
const walletRoutes = require('./wallet.routes');
const transactionRoutes = require('./transaction.routes');

// Import middlewares
const { generalLimiter } = require('../middlewares/rateLimiter.middleware');
const logger = require('../utils/logger');

/**
 * Health check endpoint
 * @route   GET /api/health
 * @access  Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * API Info endpoint
 * @route   GET /api
 * @access  Public
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Blockchain Wallet API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      wallet: '/api/wallet',
      transactions: '/api/transactions'
    },
    documentation: 'https://github.com/your-repo/docs',
    timestamp: new Date().toISOString()
  });
});

/**
 * Logging middleware cho tất cả requests
 */
router.use((req, res, next) => {
  logger.logRequest(req);
  next();
});

/**
 * Apply general rate limiter cho tất cả routes
 */
router.use(generalLimiter);

/**
 * Mount routes
 */
router.use('/users', userRoutes);
router.use('/wallet', walletRoutes);
router.use('/transactions', transactionRoutes);

/**
 * 404 Handler cho routes không tồn tại
 */
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} không tồn tại`,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;