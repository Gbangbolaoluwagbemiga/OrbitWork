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
const SECUREFLOW_ADDR =
  process.env.NEXT_PUBLIC_SECUREFLOW_ESCROW ||
  "0xaa6a6Ee940803Ba5759d26a8c2FADbeE7d939052";

const RATINGS_ADDR =
  process.env.NEXT_PUBLIC_ORBITWORK_RATINGS ||
  "0xa29de3678ea79c7031fc1c5c9c0547411637bd9f";

export const CONTRACTS = {
  // Unichain Sepolia
  SECUREFLOW_ESCROW_UNICHAIN: SECUREFLOW_ADDR,
  ORBITWORK_RATINGS: RATINGS_ADDR,
  ESCROW_HOOK: "0x73640cC810E3cC302568Adfac03587669D300a00",

  // Default contracts (used by frontend)
  SECUREFLOW_ESCROW: SECUREFLOW_ADDR,
  USDC: "0x0000000000000000000000000000000000000000", // Needs actual USDC on Unichain if available
  MOCK_ERC20: "0x0000000000000000000000000000000000000000",
};
