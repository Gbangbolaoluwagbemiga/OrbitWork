export const CasperNetwork = {
  TESTNET: {
    name: "Casper Testnet",
    nodeUrl: "http://3.136.227.9:7777/rpc", // More reliable Testnet Node IP
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
