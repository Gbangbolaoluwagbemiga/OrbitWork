export interface NetworkConfig {
  name: string;
  nodeUrl: string;
  fallbackUrls?: string[];
  chainName: string;
  scanUrl: string;
}

// For now, bypass proxy and connect directly to avoid DNS/network issues
// The Casper RPC nodes support CORS, so direct connection should work
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const CasperNetwork: Record<'TESTNET' | 'MAINNET', NetworkConfig> = {
  TESTNET: {
    name: "Casper Testnet",
    // Connect directly to avoid proxy issues
    nodeUrl: "http://136.243.187.84:7777/rpc", // Community testnet node
    fallbackUrls: [
      "/casper-rpc", // Try local proxy as fallback
      "http://195.201.174.222:7777/rpc", // Alternative community node
      "http://65.21.235.219:7777/rpc",
    ],
    chainName: "casper-test",
    scanUrl: "https://testnet.cspr.live",
  },
  MAINNET: {
    name: "Casper Mainnet",
    nodeUrl: "http://3.140.179.157:7777/rpc",
    fallbackUrls: [
      "http://138.201.54.218:7777/rpc",
      "http://3.14.161.135:7777/rpc",
    ],
    chainName: "casper",
    scanUrl: "https://cspr.live",
  },
};

export const DEFAULT_NETWORK = CasperNetwork.TESTNET;
