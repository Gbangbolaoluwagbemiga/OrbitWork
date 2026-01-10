import { WalletNetwork } from "@creit.tech/stellar-wallets-kit";

// Default to TESTNET if not specified
export const casperLegacyNetwork = import.meta.env.PUBLIC_CASPER_LEGACY_NETWORK || "TESTNET";

export const networkPassphrase = 
  import.meta.env.PUBLIC_CASPER_LEGACY_NETWORK_PASSPHRASE || 
  WalletNetwork.TESTNET;

export const rpcUrl = import.meta.env.PUBLIC_CASPER_LEGACY_RPC_URL || "https://soroban-testnet.stellar.org:443";
export const horizonUrl = import.meta.env.PUBLIC_CASPER_LEGACY_HORIZON_URL || "https://horizon-testnet.stellar.org";
