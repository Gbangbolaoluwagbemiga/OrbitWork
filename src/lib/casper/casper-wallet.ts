import { RpcClient, HttpHandler, PurseIdentifier, PublicKey } from "casper-js-sdk";
import { DEFAULT_NETWORK } from "./casper-config";

// Interface for Casper Wallet extension
interface CasperWalletProvider {
  isConnected: () => Promise<boolean>;
  sign: (deployJson: string, signingPublicKeyHex: string) => Promise<string>;
  disconnectFromSite: () => Promise<boolean>;
  requestConnection: () => Promise<boolean>;
  getActivePublicKey: () => Promise<string>;
  getVersion: () => Promise<string>;
}

declare global {
  interface Window {
    CasperWalletProvider?: () => CasperWalletProvider;
    casperlabsHelper?: {
      isConnected: () => Promise<boolean>;
      sign: (deploy: any, publicKey: string) => Promise<string>;
      disconnectFromSite: () => Promise<boolean>;
      requestConnection: () => Promise<boolean>;
      getActivePublicKey: () => Promise<string>;
    };
  }
}

export async function connectCasperWallet(): Promise<string | null> {
  try {
    const provider = window.CasperWalletProvider?.() || window.casperlabsHelper;
    
    if (!provider) {
      alert("Please install Casper Wallet extension!");
      return null;
    }

    const isConnected = await provider.isConnected();
    if (!isConnected) {
      await provider.requestConnection();
    }

    const publicKey = await provider.getActivePublicKey();
    return publicKey;
  } catch (error) {
    console.error("Failed to connect Casper wallet:", error);
    return null;
  }
}

export async function getCasperBalance(publicKeyHex: string): Promise<string> {
  try {
    const httpHandler = new HttpHandler(DEFAULT_NETWORK.nodeUrl);
    const client = new RpcClient(httpHandler);
    
    const publicKey = PublicKey.fromHex(publicKeyHex);
    
    // queryLatestBalance returns BigNumber
    const balance = await client.queryLatestBalance(
      PurseIdentifier.fromPublicKey(publicKey)
    );
    
    // Convert motes to CSPR (1 CSPR = 1,000,000,000 motes)
    // balance is a BigNumber from @ethersproject/bignumber (used internally by SDK)
    return balance.div(1_000_000_000).toString();
  } catch (error) {
    console.error("Failed to get balance:", error);
    return "0";
  }
}
