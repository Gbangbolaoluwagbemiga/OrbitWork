// Unichain Sepolia - Primary network for Uniswap v4 Hooks
export const UNICHAIN_SEPOLIA = {
  chainId: "0x515", // 1301 in hex
  chainName: "Unichain Sepolia",
  nativeCurrency: {
    name: "ETH",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["https://sepolia.unichain.org"],
  blockExplorerUrls: ["https://sepolia.uniscan.xyz"],
};

// Default network export for the app
export const DEFAULT_NETWORK = UNICHAIN_SEPOLIA;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Defaults for Unichain Sepolia
const ORBIT_WORK_ADDR =
  process.env.NEXT_PUBLIC_ORBIT_WORK_ESCROW ||
  "0x2b77b47ce1634818d038eb4dc29a4962b25881b3";

const RATINGS_ADDR =
  process.env.NEXT_PUBLIC_ORBITWORK_RATINGS ||
  "0xa29de3678ea79c7031fc1c5c9c0547411637bd9f";

const UNICHAIN_SEPOLIA_CONFIG = {
  RPC_URL: "https://sepolia.unichain.org",
  CHAIN_ID: 1301,
  // Updated addresses from latest deployment (Execution 4)
  HOOK_ADDRESS: "0xdc524fa00c57f2914036be24746a6ac4432fca40",
  USDC_ADDRESS: "0x8b9a4ae0297fa4b1fa2b6fbe9007f07a8978b1ee",
  MOCK_ERC20: "0x8b9a4ae0297fa4b1fa2b6fbe9007f07a8978b1ee",
  POOL_MANAGER: "0x00B036B58a818B1BC34d502D3fE730Db729e62AC",
};

export const CONTRACTS = {
  // Unichain Sepolia
  ORBIT_WORK_ESCROW_UNICHAIN: "0x2b77b47ce1634818d038eb4dc29a4962b25881b3",
  ORBITWORK_RATINGS: RATINGS_ADDR,
  ESCROW_HOOK: UNICHAIN_SEPOLIA_CONFIG.HOOK_ADDRESS,

  // Default contracts (used by frontend)
  ORBIT_WORK_ESCROW: "0x2b77b47ce1634818d038eb4dc29a4962b25881b3",
  USDC: UNICHAIN_SEPOLIA_CONFIG.USDC_ADDRESS,
  MOCK_ERC20: UNICHAIN_SEPOLIA_CONFIG.MOCK_ERC20,
};
