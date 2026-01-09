export const CasperNetwork = {
  TESTNET: {
    name: "Casper Testnet",
    nodeUrl: "http://16.162.124.124:7777/rpc", // Reliable Testnet Node
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
