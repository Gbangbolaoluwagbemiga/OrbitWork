// Re-export Casper config for compatibility
export {
  CONTRACTS,
  getCurrentNetwork,
  CASPER_LEGACY_NETWORKS,
} from "./casper-legacy-config";

// Casper doesn't use addresses like Ethereum, but we keep this for compatibility
export const GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

// Legacy exports for backward compatibility (deprecated - use casper-legacy-config instead)
export const BASE_MAINNET = {
  chainId: null,
  chainName: "Casper Mainnet",
  nativeCurrency: {
    name: "Lumen",
    symbol: "XLM",
    decimals: 7,
  },
  rpcUrls: ["https://soroban-mainnet.stellar.org:443"],
  blockExplorerUrls: ["https://stellar.expert/explorer/public"],
};

export const BASE_TESTNET = {
  chainId: null,
  chainName: "Casper Testnet",
  nativeCurrency: {
    name: "Lumen",
    symbol: "XLM",
    decimals: 7,
  },
  rpcUrls: ["https://soroban-testnet.stellar.org:443"],
  blockExplorerUrls: ["https://stellar.expert/explorer/testnet"],
};
