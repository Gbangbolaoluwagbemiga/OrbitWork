// Network Configuration
// Note: Transitioning to Casper Network. These values are legacy Casper config.
export const CASPER_LEGACY_NETWORKS = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org:443",
    horizonUrl: "https://horizon-testnet.stellar.org",
  },
  mainnet: {
    networkPassphrase: "Public Global Casper Network ; September 2015",
    rpcUrl: "https://soroban-mainnet.stellar.org:443",
    horizonUrl: "https://horizon.stellar.org",
  },
  local: {
    networkPassphrase: "Standalone Network ; February 2017",
    rpcUrl: "http://localhost:8000/soroban/rpc",
    horizonUrl: "http://localhost:8000",
  },
};

// Contract IDs (will be set after deployment)
// Fallback to the deployed contract ID if env variable is not set
// Testnet contract ID (deployed on testnet) - Updated with rating and badge system
const DEFAULT_CONTRACT_ID =
  "CCHLR3D3MUM5PDRP6DQRREZK5QABLWGZP6PAIMQ4SEE64ZS2B6PNDRVC";

export const CONTRACTS = {
  ORBITWORK_ESCROW:
    import.meta.env.VITE_ORBITWORK_CONTRACT_ID || DEFAULT_CONTRACT_ID,
};

// Get current network from environment
export const getCurrentNetwork = () => {
  const env = import.meta.env.VITE_CASPER_LEGACY_NETWORK || "testnet";
  return (
    CASPER_LEGACY_NETWORKS[env as keyof typeof CASPER_LEGACY_NETWORKS] ||
    CASPER_LEGACY_NETWORKS.testnet
  );
};

// Native XLM SAC (Casper Asset Contract - Legacy) addresses
// These are the contract addresses for the native XLM asset contract on each network
export const NATIVE_XLM_SAC_ADDRESSES = {
  testnet: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", // Native XLM SAC on testnet
  mainnet: "", // TODO: Add mainnet SAC address when available
  local: "", // TODO: Add local SAC address when available
};

// Get native XLM SAC address for current network
export const getNativeXLMSACAddress = () => {
  const env = import.meta.env.VITE_CASPER_LEGACY_NETWORK || "testnet";
  return (
    NATIVE_XLM_SAC_ADDRESSES[env as keyof typeof NATIVE_XLM_SAC_ADDRESSES] ||
    NATIVE_XLM_SAC_ADDRESSES.testnet
  );
};
