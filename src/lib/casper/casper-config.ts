export interface NetworkConfig {
  name: string;
  nodeUrl: string;
  fallbackUrls?: string[];
  chainName: string;
  scanUrl: string;
}

// Check if running locally to use proxy
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const CasperNetwork: Record<'TESTNET' | 'MAINNET', NetworkConfig> = {
  TESTNET: {
    name: "Casper Testnet",
    // Use local proxy when on localhost, otherwise use direct connection
    nodeUrl: isLocalhost ? "/casper-rpc" : "http://116.202.223.80:7777/rpc",
    fallbackUrls: [],
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
