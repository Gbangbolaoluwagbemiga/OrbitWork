export const CasperNetwork = {
  TESTNET: {
    name: "Casper Testnet",
    nodeUrl: "http://136.243.187.84:7777/rpc", // Example Testnet Node
    chainName: "casper-test",
    scanUrl: "https://testnet.cspr.live",
  },
  MAINNET: {
    name: "Casper Mainnet",
    nodeUrl: "http://138.201.54.218:7777/rpc",
    chainName: "casper",
    scanUrl: "https://cspr.live",
  },
};

export const DEFAULT_NETWORK = CasperNetwork.TESTNET;
