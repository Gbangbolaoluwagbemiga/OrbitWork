import { RpcClient, HttpHandler, PurseIdentifier, PublicKey, Deploy } from "casper-js-sdk";
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

export async function signDeploy(deploy: Deploy, publicKeyHex: string): Promise<Deploy | null> {
  try {
      const provider = window.CasperWalletProvider?.() || window.casperlabsHelper;
      if (!provider) return null;

      const deployJson = Deploy.toJSON(deploy);
      const signedJson = await provider.sign(JSON.stringify(deployJson), publicKeyHex);
      
      let signedDeploy: Deploy;
      if (typeof signedJson === 'string') {
          // If it returns a string (Casper Wallet), parse it
          const parsed = JSON.parse(signedJson);
          // If it's wrapped in { deploy: ... }, extract it
          const deployData = parsed.deploy || parsed;
          signedDeploy = Deploy.fromJSON(deployData);
      } else {
          // Legacy support
          signedDeploy = Deploy.fromJSON(signedJson);
      }
      
      return signedDeploy;
  } catch (error) {
      console.error("Error signing deploy:", error);
      return null;
  }
}

export async function sendDeploy(deploy: Deploy): Promise<string> {
  try {
      const httpHandler = new HttpHandler(DEFAULT_NETWORK.nodeUrl);
      const client = new RpcClient(httpHandler);
      
      const result = await client.putDeploy(deploy);
      return typeof result === 'string' ? result : (result as any).deploy_hash;
  } catch (error) {
      console.error("Error sending deploy:", error);
      throw error;
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
    
    // queryLatestBalance returns QueryBalanceResult which contains CLValueUInt512
    const result = await client.queryLatestBalance(
      PurseIdentifier.fromPublicKey(publicKey)
    );
    
    // Convert motes to CSPR (1 CSPR = 1,000,000,000 motes)
    // result.balance is CLValueUInt512, getValue() returns BigNumber
    const csprBalance = result.balance.getValue().div(1_000_000_000).toString();
    console.log("Fetched Casper Balance:", csprBalance);
    return csprBalance;
  } catch (error) {
    console.error("Failed to get balance for key:", publicKeyHex);
    if (error instanceof Error) {
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
    } else {
        console.error("Unknown error:", error);
    }
    return "0";
  }
}
