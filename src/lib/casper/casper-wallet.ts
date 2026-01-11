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
  getActiveAccountBalance?: () => Promise<string>;
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
      
      let signedDeploy: Deploy | undefined;
      
      try {
          // Try standard parsing first
          if (typeof signedJson === 'string') {
              const parsed = JSON.parse(signedJson);
              const deployData = parsed.deploy || parsed;
              signedDeploy = Deploy.fromJSON(deployData);
          } else {
              signedDeploy = Deploy.fromJSON(signedJson);
          }
      } catch (parseError) {
                  console.warn("Deploy.fromJSON failed, attempting manual signature extraction. Error:", parseError);
                  
                  // Manual fallback using JSON manipulation to avoid class mismatch issues
                  let deployData: any;
                  if (typeof signedJson === 'string') {
                     try {
                        const parsed = JSON.parse(signedJson);
                        deployData = parsed.deploy || parsed;
                     } catch(e) {
                        console.error("Failed to parse signedJson string:", e);
                        throw parseError;
                     }
                  } else {
                     deployData = signedJson;
                  }
                  
                  // Work with JSON representation to avoid Approval class issues
                  const originalDeployJson = Deploy.toJSON(deploy);
                  const deployToUpdate = (originalDeployJson as any).deploy || originalDeployJson;
                  
                  if (!deployToUpdate.approvals) {
                      deployToUpdate.approvals = [];
                  }

                  // Look for approvals in response
                  const approvals = deployData.approvals || (deployData.deploy && deployData.deploy.approvals);
                  
                  if (approvals && Array.isArray(approvals) && approvals.length > 0) {
                     console.log("Found approvals in response:", approvals);
                     
                     for (const a of approvals) {
                        const signer = a.signer; // Hex string
                        let signature = a.signature; // Hex string
                        
                        if (signer && signature) {
                            // Fix signature tag if needed
                            // Case 1: Signature is 130 chars (65 bytes) but has wrong tag
                            if (signature.length === 130) {
                                const expectedTag = signer.substring(0, 2);
                                const currentTag = signature.substring(0, 2);
                                if (currentTag !== expectedTag && (expectedTag === '01' || expectedTag === '02')) {
                                    console.warn(`Signature tag mismatch in approval. Expected ${expectedTag}, got ${currentTag}. Correcting...`);
                                    signature = expectedTag + signature.substring(2);
                                }
                            }
                            // Case 2: Signature is 128 chars (64 bytes) - Missing tag
                            else if (signature.length === 128) {
                                const expectedTag = signer.substring(0, 2);
                                if (expectedTag === '01' || expectedTag === '02') {
                                    console.warn(`Signature length is 128 (missing tag). Prepending expected tag ${expectedTag}...`);
                                    signature = expectedTag + signature;
                                }
                            }

                            // Check for duplicates
                            if (!deployToUpdate.approvals.some((existing: any) => existing.signer === signer)) {
                                deployToUpdate.approvals.push({
                                    signer: signer,
                                    signature: signature
                                });
                            }
                        }
                     }
                  } else if (deployData.signatureHex) {
                     console.log("Found signatureHex in response:", deployData.signatureHex);
                     
                     const signer = publicKeyHex;
                     let signature = deployData.signatureHex;
                     
                     // Fix signature tag if needed
                      // Casper Wallet sometimes returns a signature with a non-standard tag (e.g. 'fd')
                      // We force the signature tag to match the public key tag for standard 64-byte signatures
                      if (signature.length === 130) { // 1 byte tag + 64 bytes signature = 65 bytes = 130 hex chars
                          const expectedTag = signer.substring(0, 2);
                          const currentTag = signature.substring(0, 2);
                          if (currentTag !== expectedTag && (expectedTag === '01' || expectedTag === '02')) {
                              console.warn(`Signature tag mismatch. Expected ${expectedTag}, got ${currentTag}. Correcting...`);
                              signature = expectedTag + signature.substring(2);
                          }
                      }
                      // Case 2: Signature is 128 chars (64 bytes) - Missing tag
                      else if (signature.length === 128) {
                          const expectedTag = signer.substring(0, 2);
                          if (expectedTag === '01' || expectedTag === '02') {
                              console.warn(`Signature length is 128 (missing tag). Prepending expected tag ${expectedTag}...`);
                              signature = expectedTag + signature;
                          }
                      }
                     
                     // Check for duplicates
                     if (!deployToUpdate.approvals.some((existing: any) => existing.signer === signer)) {
                         deployToUpdate.approvals.push({
                             signer: signer,
                             signature: signature
                         });
                     }
                  } else {
                     console.error("No approvals found in response:", deployData);
                     throw parseError; // Re-throw original error if we can't save it
                  }

                  // Reconstruct valid Deploy object from the updated JSON
                  // This ensures internal consistency and serialization compatibility
                  signedDeploy = Deploy.fromJSON(originalDeployJson);
              }
              
              return signedDeploy || null;
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
  } catch (error: any) {
    console.error("Failed to connect Casper wallet:", error);
    
    // Handle specific error codes
    if (error?.code === 2 || error?.message?.includes('not approved')) {
      alert(
        "⚠️ Connection Not Approved\n\n" +
        "Your Casper Wallet needs to approve this connection.\n\n" +
        "Steps to fix:\n" +
        "1. Open your Casper Wallet extension\n" +
        "2. Check 'Connected Sites' settings\n" +
        "3. Enable this site (localhost:5173)\n" +
        "4. Try connecting again and click 'Approve' when prompted"
      );
    } else if (error?.message) {
      alert(`Failed to connect: ${error.message}`);
    }
    
    return null;
  }
}

// Helper function to manually set balance (useful for debugging when RPC nodes are down)
export function setCasperBalanceCache(publicKeyHex: string, balance: string) {
  localStorage.setItem(`casper_balance_${publicKeyHex}`, balance);
  console.log(`✅ Cached balance set to ${balance} CSPR for ${publicKeyHex}`);
  console.log(`💡 Refresh the page to see the updated balance`);
}

// Helper to get current cached balance
export function getCachedBalance(publicKeyHex: string): string | null {
  const cached = localStorage.getItem(`casper_balance_${publicKeyHex}`);
  if (cached) {
    console.log(`📊 Cached balance for ${publicKeyHex}: ${cached} CSPR`);
  } else {
    console.log(`❌ No cached balance found for ${publicKeyHex}`);
  }
  return cached;
}

// Expose to window for console access during development
if (typeof window !== 'undefined') {
  (window as any).setCasperBalance = setCasperBalanceCache;
  (window as any).getCachedBalance = getCachedBalance;
  console.log("🔧 Casper balance helpers loaded:");
  console.log("  - setCasperBalance(publicKey, balance) - Set cached balance");
  console.log("  - getCachedBalance(publicKey) - Check cached balance");
}

export async function getCasperBalance(publicKeyHex: string): Promise<string> {
  // Check for manually cached balance in localStorage (fallback for when RPCs are down)
  const cachedBalance = localStorage.getItem(`casper_balance_${publicKeyHex}`);
  
  // First, try to get balance from the wallet extension directly
  try {
    const provider = window.CasperWalletProvider?.() || window.casperlabsHelper;
    if (provider && provider.getActiveAccountBalance) {
      console.log("Attempting to fetch balance from Casper Wallet extension...");
      const balanceInMotes = await provider.getActiveAccountBalance();
      if (balanceInMotes) {
        // Convert motes to CSPR
        const csprBalance = (BigInt(balanceInMotes) / BigInt(1_000_000_000)).toString();
        console.log("✅ Successfully fetched balance from wallet extension:", csprBalance);
        // Cache the successful balance
        localStorage.setItem(`casper_balance_${publicKeyHex}`, csprBalance);
        return csprBalance;
      }
    }
  } catch (error) {
    console.warn("Wallet extension balance fetch not available, trying RPC nodes:", error);
  }

  // Try RPC endpoints (will use proxy when on localhost)
  const endpoints = [
    DEFAULT_NETWORK.nodeUrl,
    ...(DEFAULT_NETWORK.fallbackUrls || [])
  ];

  for (let i = 0; i < endpoints.length; i++) {
    const endpoint = endpoints[i];
    try {
      console.log(`Attempting to fetch balance from RPC ${endpoint}...`);
      const httpHandler = new HttpHandler(endpoint);
      const client = new RpcClient(httpHandler);
      
      const publicKey = PublicKey.fromHex(publicKeyHex);
      
      // queryLatestBalance returns QueryBalanceResult which contains CLValueUInt512
      const result = await client.queryLatestBalance(
        PurseIdentifier.fromPublicKey(publicKey)
      );
      
      // Convert motes to CSPR (1 CSPR = 1,000,000,000 motes)
      // result.balance is CLValueUInt512, getValue() returns BigNumber
      const csprBalance = result.balance.getValue().div(1_000_000_000).toString();
      console.log("✅ Successfully fetched Casper Balance:", csprBalance, "from", endpoint);
      // Cache the successful balance
      localStorage.setItem(`casper_balance_${publicKeyHex}`, csprBalance);
      return csprBalance;
    } catch (error) {
      console.warn(`Failed to get balance from ${endpoint}:`, error);
      
      // If this is the last endpoint, log detailed error
      if (i === endpoints.length - 1) {
        console.error("❌ All RPC endpoints failed. Unable to fetch balance for key:", publicKeyHex);
        if (error instanceof Error) {
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);
        } else {
          console.error("Unknown error:", error);
        }
      }
      // Continue to next endpoint
    }
  }
  
  // All attempts failed - use cached balance if available
  if (cachedBalance) {
    console.warn("⚠️ Using cached balance:", cachedBalance, "(RPC nodes unavailable)");
    console.info("💡 Click 'View on Explorer' to verify your actual balance");
    return cachedBalance;
  }
  
  console.error("⚠️ Returning 0 balance - all methods failed and no cached balance available");
  console.info("💡 Possible solutions:");
  console.info("1. Check your internet connection");
  console.info("2. Try disconnecting and reconnecting your wallet");
  console.info("3. Verify your account has funds on testnet: " + DEFAULT_NETWORK.scanUrl + "/account/" + publicKeyHex);
  console.info("4. The RPC nodes may be temporarily down - click 'View on Explorer' to see your actual balance");
  return "0";
}
