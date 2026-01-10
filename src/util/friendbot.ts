import { casperLegacyNetwork } from "./casper-legacy-constants";

// Utility to get the correct Friendbot URL based on environment
export function getFriendbotUrl(address: string) {
  switch (casperLegacyNetwork) {
    case "LOCAL":
      // Use proxy in development for local
      return `/friendbot?addr=${address}`;
    case "FUTURENET":
      return `https://friendbot-futurenet.stellar.org/?addr=${address}`;
    case "TESTNET":
      return `https://friendbot.stellar.org/?addr=${address}`;
    default:
      throw new Error(
        `Unknown or unsupported PUBLIC_CASPER_LEGACY_NETWORK for friendbot: ${casperLegacyNetwork}`,
      );
  }
}
