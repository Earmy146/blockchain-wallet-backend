/**
 * Cấu hình các mạng blockchain
 * File: backend/src/constants/networks.js
 */

const NETWORKS = {
  SEPOLIA: {
    name: 'Sepolia Testnet',
    chainId: 11155111,
    rpcUrl: process.env.SEPOLIA_RPC_URL,
    explorer: 'https://sepolia.etherscan.io',
    symbol: 'SepoliaETH',
    decimals: 18,
    isTestnet: true
  },
  
  MAINNET: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcUrl: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
    explorer: 'https://etherscan.io',
    symbol: 'ETH',
    decimals: 18,
    isTestnet: false
  }
};

// Network mặc định cho development
const DEFAULT_NETWORK = NETWORKS.SEPOLIA;

// Hàm helper để lấy thông tin network theo chainId
const getNetworkByChainId = (chainId) => {
  return Object.values(NETWORKS).find(net => net.chainId === chainId);
};

// Hàm helper để validate chainId có tồn tại không
const isValidChainId = (chainId) => {
  return Object.values(NETWORKS).some(net => net.chainId === chainId);
};

module.exports = {
  NETWORKS,
  DEFAULT_NETWORK,
  getNetworkByChainId,
  isValidChainId
};