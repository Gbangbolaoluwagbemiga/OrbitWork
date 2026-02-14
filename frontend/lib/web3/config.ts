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
  "0xEe8a174c6fabDEb52a5d75e8e3F951EFbC667fDB";

const RATINGS_ADDR =
  process.env.NEXT_PUBLIC_ORBITWORK_RATINGS ||
  "0xa29de3678ea79c7031fc1c5c9c0547411637bd9f";

const UNICHAIN_SEPOLIA_CONFIG = {
  RPC_URL: "https://sepolia.unichain.org",
  CHAIN_ID: 1301,
  // Definitive addresses from latest deployment (explicit hook overrides + Version 5)
  HOOK_ADDRESS: "0x11859719753C0a0d22790ee3C392d0EFB7Fe4a40",
  USDC_ADDRESS: "0x8f22D60F408DBA32ba2D4123aD0aE6D3c0b1d28B",
  MOCK_ERC20: "0x8f22D60F408DBA32ba2D4123aD0aE6D3c0b1d28B",
  POOL_MANAGER: "0x00B036B58a818B1BC34d502D3fE730Db729e62AC",
};

export const CONTRACTS = {
  // Unichain Sepolia
  ORBIT_WORK_ESCROW_UNICHAIN: "0xEe8a174c6fabDEb52a5d75e8e3F951EFbC667fDB",
  ORBITWORK_RATINGS: RATINGS_ADDR,
  ESCROW_HOOK: UNICHAIN_SEPOLIA_CONFIG.HOOK_ADDRESS,

  // Default contracts (used by frontend)
  ORBIT_WORK_ESCROW: "0xEe8a174c6fabDEb52a5d75e8e3F951EFbC667fDB",
  USDC: UNICHAIN_SEPOLIA_CONFIG.USDC_ADDRESS,
  MOCK_ERC20: UNICHAIN_SEPOLIA_CONFIG.MOCK_ERC20,
};
