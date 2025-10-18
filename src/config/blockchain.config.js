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