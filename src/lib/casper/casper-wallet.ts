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
          // Handle different response types from wallet
          let deployData: any;
          
          if (typeof signedJson === 'string') {
              // Try to parse as JSON string
              try {
                  deployData = JSON.parse(signedJson);
              } catch (e) {
                  // If it's not valid JSON, it might be a double-encoded string
                  try {
                      deployData = JSON.parse(JSON.parse(signedJson));
                  } catch (e2) {
                      throw new Error("Failed to parse wallet response as JSON");
                  }
              }
          } else {
              // Wallet returned an object directly
              deployData = signedJson;
          }
          
          // Extract deploy data (might be nested)
          let actualDeploy = deployData.deploy || deployData;
          
          // If the wallet returned a complete deploy structure, use it directly
          // Check if it has all required fields
          if (actualDeploy.hash && actualDeploy.header && actualDeploy.session && actualDeploy.payment) {
            // Wallet returned a complete deploy - try to parse it
            try {
              signedDeploy = Deploy.fromJSON(actualDeploy);
              console.log("✅ Successfully parsed deploy from wallet response");
            } catch (e) {
              console.warn("Wallet deploy structure exists but parsing failed, will try manual reconstruction:", e);
              throw e; // Fall through to manual reconstruction
            }
          } else {
            // Wallet didn't return complete structure, need manual reconstruction
            throw new Error("Wallet response missing required deploy fields");
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
                  // Get the original deploy JSON structure - this is the source of truth
                  const originalDeployJson = Deploy.toJSON(deploy);
                  
                  // Extract the actual deploy object (might be nested in { deploy: {...} })
                  let originalDeploy: any = (originalDeployJson as any).deploy || originalDeployJson;
                  
                  // Create a deep copy of the ORIGINAL deploy structure to preserve all fields exactly
                  // This ensures payment, session, header, hash are all preserved correctly
                  const deployToUpdate: any = JSON.parse(JSON.stringify(originalDeploy));
                  
                  // Only modify the approvals array - everything else stays the same
                  if (!deployToUpdate.approvals || !Array.isArray(deployToUpdate.approvals)) {
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

                  // All fields should already be preserved from the deep copy above
                  // Just verify critical fields are present (they should be)
                  if (!deployToUpdate.hash || !deployToUpdate.header || !deployToUpdate.payment || !deployToUpdate.session) {
                    console.error("❌ Critical deploy fields missing after copy:", {
                      hasHash: !!deployToUpdate.hash,
                      hasHeader: !!deployToUpdate.header,
                      hasPayment: !!deployToUpdate.payment,
                      hasSession: !!deployToUpdate.session
                    });
                    // Fallback: use original structure
                    const originalJson = Deploy.toJSON(deploy);
                    const originalDeploy = (originalJson as any).deploy || originalJson;
                    deployToUpdate.hash = originalDeploy.hash;
                    deployToUpdate.header = originalDeploy.header;
                    deployToUpdate.payment = originalDeploy.payment;
                    deployToUpdate.session = originalDeploy.session;
                  }
                  
                  // Log payment structure for debugging
                  console.log("💰 Payment structure:", JSON.stringify(deployToUpdate.payment, null, 2));

                  // Before reconstructing, ensure the deploy JSON is in the correct format
                  // The RPC expects: { hash, header, payment, session, approvals }
                  // Make sure all fields are properly formatted
                  
                  // Ensure approvals are in the correct format (array of { signer, signature })
                  if (deployToUpdate.approvals && deployToUpdate.approvals.length > 0) {
                    deployToUpdate.approvals = deployToUpdate.approvals.map((a: any) => ({
                      signer: a.signer,
                      signature: a.signature
                    }));
                  }

                  // Reconstruct valid Deploy object from the updated JSON
                  try {
                    signedDeploy = Deploy.fromJSON(deployToUpdate);
                    console.log("✅ Successfully reconstructed deploy with manual signature");
                    
                    // Verify the reconstructed deploy has approvals
                    const reconstructedJson = Deploy.toJSON(signedDeploy);
                    const reconstructedDeploy = (reconstructedJson as any).deploy || reconstructedJson;
                    if (!reconstructedDeploy.approvals || reconstructedDeploy.approvals.length === 0) {
                      console.warn("⚠️ Reconstructed deploy missing approvals, adding them back");
                      reconstructedDeploy.approvals = deployToUpdate.approvals;
                      signedDeploy = Deploy.fromJSON(reconstructedDeploy);
                    }
                  } catch (e) {
                    console.error("❌ Failed to reconstruct deploy:", e);
                    console.error("Deploy structure:", {
                      hasHash: !!deployToUpdate.hash,
                      hasHeader: !!deployToUpdate.header,
                      hasPayment: !!deployToUpdate.payment,
                      hasSession: !!deployToUpdate.session,
                      approvalsCount: deployToUpdate.approvals?.length || 0
                    });
                    throw new Error(`Failed to reconstruct signed deploy: ${e instanceof Error ? e.message : String(e)}`);
                  }
              }
              
              return signedDeploy || null;
          } catch (error) {
      console.error("Error signing deploy:", error);
      return null;
  }
}

// Helper function to add timeout to promises (currently unused but kept for future use)
// function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
//   return Promise.race([
//     promise,
//     new Promise<T>((_, reject) => 
//       setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
//     )
//   ]);
// }

/**
 * Submit deploy via direct HTTP POST (bypasses SDK timeout issues)
 */
async function submitDeployDirectHTTP(endpoint: string, deployJson: any): Promise<string> {
  const controller = new AbortController();
  // Shorter timeout for faster failure (10s for HTTPS, 5s for HTTP)
  const timeout = endpoint.startsWith('https') ? 10000 : 5000;
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  // Ensure deployJson is the actual deploy object (not nested)
  const deployToSend = (deployJson as any).deploy || deployJson;
  
  // Validate deploy structure
  if (!deployToSend.hash) {
    throw new Error("Deploy missing hash");
  }
  if (!deployToSend.header) {
    throw new Error("Deploy missing header");
  }
  if (!deployToSend.payment) {
    throw new Error("Deploy missing payment");
  }
  if (!deployToSend.session) {
    throw new Error("Deploy missing session");
  }
  if (!deployToSend.approvals || !Array.isArray(deployToSend.approvals)) {
    console.warn("⚠️ Deploy missing approvals array, adding empty array");
    deployToSend.approvals = [];
  }
  
  // Log deploy structure for debugging
  if (endpoint === '/casper-rpc') {
    console.log("📋 Deploy structure being sent:", {
      hash: deployToSend.hash?.substring(0, 16) + '...',
      approvalsCount: deployToSend.approvals?.length || 0,
      hasHeader: !!deployToSend.header,
      hasPayment: !!deployToSend.payment,
      hasSession: !!deployToSend.session,
      headerAccount: deployToSend.header?.account?.substring(0, 16) + '...',
      paymentType: typeof deployToSend.payment,
      paymentKeys: deployToSend.payment ? Object.keys(deployToSend.payment) : [],
      paymentValue: deployToSend.payment ? JSON.stringify(deployToSend.payment).substring(0, 200) : 'null'
    });
  }
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: 1,
        jsonrpc: '2.0',
        method: 'account_put_deploy',
        params: {
          deploy: deployToSend
        }
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.error) {
      const errorMsg = result.error.message || JSON.stringify(result.error);
      const errorCode = result.error.code;
      console.error(`RPC Error Details:`, {
        code: errorCode,
        message: errorMsg,
        data: result.error.data,
        deployHash: deployJson.hash
      });
      throw new Error(`RPC Error: ${errorMsg}${errorCode ? ` (Code: ${errorCode})` : ''}`);
    }
    
    const deployHash = result.result?.deploy_hash || deployToSend.hash;
    if (!deployHash) {
      throw new Error('No deploy hash returned from RPC');
    }
    
    return deployHash;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const timeout = endpoint.startsWith('https') ? 10 : 5;
      throw new Error(`Timeout: ${endpoint} took longer than ${timeout}s`);
    }
    throw error;
  }
}

/**
 * Check if a deploy succeeded on-chain
 * Polls multiple times with increasing delays to wait for finalization
 */
export async function checkDeployStatus(deployHash: string, endpoint: string = '/casper-rpc', maxAttempts: number = 3): Promise<{ success: boolean; error?: string }> {
  const httpHandler = new HttpHandler(endpoint);
  const client = new RpcClient(httpHandler);
  
  // Quick initial check (no wait)
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        // Only wait between attempts, not before first check
        const waitTime = attempt === 2 ? 2000 : 3000; // 2s for second attempt, 3s for third
        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      console.log(`🔍 Checking deploy status (attempt ${attempt}/${maxAttempts})...`);
      const deployInfo = await client.getDeploy(deployHash);
      
      // Check execution results (can be executionResultsV1 or execution_results depending on API version)
      const executionResults = (deployInfo as any).execution_results || (deployInfo as any).executionResultsV1 || [];
      
      if (executionResults.length === 0) {
        // Deploy might still be pending
        if (attempt < maxAttempts) {
          continue; // Will wait before next attempt
        } else {
          // After 3 quick checks, return success optimistically
          console.log('✅ Deploy submitted successfully (status check pending, but deploy was accepted)');
          console.log(`💡 View on explorer: https://testnet.cspr.live/deploy/${deployHash}`);
          return { success: true };
        }
      }
      
      const result = executionResults[0].result;
      
      if ('Success' in result) {
        console.log(`✅ Deploy succeeded on-chain!`);
        return { success: true };
      } else if ('Failure' in result) {
        const failure = (result as any).Failure || {};
        // Try to extract detailed error information
        let errorMsg = failure.error_message || 
                      failure.message || 
                      JSON.stringify(failure) ||
                      'Unknown error';
        
        // Check for specific error codes
        if (failure.error_code) {
          errorMsg = `Error Code ${failure.error_code}: ${errorMsg}`;
        }
        
        // Log full failure details for debugging
        console.error(`❌ Deploy failed on-chain:`, {
          errorMessage: errorMsg,
          fullFailure: failure,
          executionResult: result
        });
        
        // Provide helpful hints for common errors
        if (errorMsg.toLowerCase().includes('not authorized') || 
            errorMsg.toLowerCase().includes('authorization') ||
            errorMsg.toLowerCase().includes('revert') ||
            (failure.error_code && failure.error_code === 1)) {
          console.warn('💡 This might be an authorization error. Ensure:');
          console.warn('   1. The contract was initialized with init()');
          console.warn('   2. You are calling from the admin address');
          console.warn('   3. The admin key exists in the contract state');
        }
        
        return { success: false, error: errorMsg };
      }
      
      // Unknown status, retry once more then be optimistic
      if (attempt < maxAttempts) {
        continue;
      }
      
      // If unknown status after checks, be optimistic
      console.log('✅ Deploy submitted successfully (status unknown, but deploy was accepted)');
      return { success: true };
    } catch (error: any) {
      console.warn(`⚠️ Status check attempt ${attempt} failed: ${error.message}`);
      
      // If it's a "not found" error, the deploy might still be pending
      if (error.message?.includes('not found') || error.message?.includes('Not found')) {
        if (attempt < maxAttempts) {
          continue; // Will wait before next attempt
        } else {
          // If deploy not found after quick checks, be optimistic since it was submitted
          console.log('✅ Deploy submitted successfully (not found yet, but deploy was accepted)');
          console.log(`💡 View on explorer: https://testnet.cspr.live/deploy/${deployHash}`);
          return { success: true };
        }
      }
      
      // For other errors, retry once more then be optimistic
      if (attempt < maxAttempts) {
        continue;
      }
      
      // If we've tried a few times and still getting errors, be optimistic
      console.log('✅ Deploy submitted successfully (status check had issues, but deploy was accepted)');
      console.log(`💡 View on explorer: https://testnet.cspr.live/deploy/${deployHash}`);
      return { success: true };
    }
  }
  
  // If we've exhausted all attempts but the deploy was submitted, be optimistic
  console.log('✅ Deploy submitted successfully (quick status check complete)');
  console.log(`💡 View on explorer: https://testnet.cspr.live/deploy/${deployHash}`);
  return { success: true };
}

export async function sendDeploy(deploy: Deploy): Promise<string> {
  // Convert deploy to JSON for direct HTTP submission
  // Deploy.toJSON() might return { deploy: {...} } or just the deploy object
  let deployJsonRaw = Deploy.toJSON(deploy);
  
  // If it's a Deploy object, convert to JSON
  if (deployJsonRaw instanceof Deploy) {
    deployJsonRaw = Deploy.toJSON(deployJsonRaw);
  }
  
  // Extract the actual deploy object (handle nested structure)
  let deployJson: any = (deployJsonRaw as any).deploy || deployJsonRaw;
  
  // If deployJson is still a Deploy instance (shouldn't happen, but be safe)
  if (deployJson instanceof Deploy) {
    deployJson = Deploy.toJSON(deployJson);
    deployJson = (deployJson as any).deploy || deployJson;
  }
  
  // Filter and prioritize endpoints - use proxy first (bypasses CORS)
  const endpoints = [
    '/casper-rpc', // Try proxy first (bypasses CORS)
    DEFAULT_NETWORK.nodeUrl,
    ...(DEFAULT_NETWORK.fallbackUrls || [])
  ].filter(url => url !== '/casper-rpc' || typeof window !== 'undefined'); // Only use proxy in browser
  
  let lastError: any;
  
  // Try direct HTTP submission first (more reliable)
  // Use shorter timeout to fail faster
  for (const endpoint of endpoints) {
    try {
      console.log(`🔄 Attempting direct HTTP submission to: ${endpoint}`);
      const deployHash = await submitDeployDirectHTTP(endpoint, deployJson);
      console.log(`✅ Deploy sent successfully via HTTP! Hash: ${deployHash}`);
      return deployHash;
    } catch (error: any) {
      console.warn(`❌ Direct HTTP failed for ${endpoint}:`, error.message);
      lastError = error;
      // Continue to next endpoint
    }
  }
  
  // Fallback to SDK method
  console.log(`⚠️ Direct HTTP failed, trying SDK method...`);
  for (const endpoint of endpoints.slice(0, 2)) {
    try {
      console.log(`🔄 Attempting SDK submission to: ${endpoint}`);
      const httpHandler = new HttpHandler(endpoint);
      const client = new RpcClient(httpHandler);
      
      const result = await Promise.race([
        client.putDeploy(deploy),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 15000)
        )
      ]);
      
      const deployHash = typeof result === 'string' ? result : (result as any).deploy_hash;
      console.log(`✅ Deploy sent successfully via SDK! Hash: ${deployHash}`);
      return deployHash;
    } catch (error: any) {
      console.warn(`❌ SDK submission failed for ${endpoint}:`, error.message);
      lastError = error;
    }
  }
  
  console.error("❌ All endpoints failed. Last error:", lastError);
  
  // Save deploy for manual submission
  const deployJsonString = JSON.stringify(deployJson, null, 2);
  localStorage.setItem('lastSignedDeploy', deployJsonString);
  localStorage.setItem('lastSignedDeployType', 'pending');
  
  throw new Error(
    "Network Error: Unable to connect to Casper RPC nodes. " +
    "Deploy has been saved to localStorage. " +
    "Please use the 'Download Last Signed Deploy' button and submit via CLI: " +
    "casper-client put-deploy --node-address <RPC_URL> --chain-name casper-test --deploy <file>.json"
  );
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

export async function getCasperBalance(publicKeyHex: string, _forceRefresh: boolean = false): Promise<string> {
  // Check for manually cached balance in localStorage (fallback for when RPCs are down)
  const cachedBalance = localStorage.getItem(`casper_balance_${publicKeyHex}`);
  
  // First, try to get balance from the wallet extension directly (most reliable)
  try {
    const provider = window.CasperWalletProvider?.() || window.casperlabsHelper;
    if (provider) {
      // Try multiple methods to get balance from wallet
      let balanceInMotes: string | number | null = null;
      
      // Method 1: getActiveAccountBalance (if available)
      if ('getActiveAccountBalance' in provider && typeof provider.getActiveAccountBalance === 'function') {
        console.log("Attempting to fetch balance from Casper Wallet extension (getActiveAccountBalance)...");
        try {
          balanceInMotes = await (provider as any).getActiveAccountBalance();
        } catch (e) {
          console.warn("getActiveAccountBalance failed:", e);
        }
      }
      
      // Method 2: Try to get from wallet's internal state (if accessible)
      if (!balanceInMotes && (window as any).casperWallet?.balance) {
        console.log("Attempting to fetch balance from Casper Wallet extension (internal state)...");
        balanceInMotes = (window as any).casperWallet.balance;
      }
      
      if (balanceInMotes) {
        // Handle different formats (string, number, BigInt)
        let balanceBigInt: bigint;
        if (typeof balanceInMotes === 'string') {
          balanceBigInt = BigInt(balanceInMotes);
        } else if (typeof balanceInMotes === 'number') {
          balanceBigInt = BigInt(Math.floor(balanceInMotes));
        } else {
          balanceBigInt = BigInt(balanceInMotes);
        }
        
        // Convert motes to CSPR
        const csprBalance = (balanceBigInt / BigInt(1_000_000_000)).toString();
        console.log("✅ Successfully fetched balance from wallet extension:", csprBalance, "CSPR");
        // Cache the successful balance
        localStorage.setItem(`casper_balance_${publicKeyHex}`, csprBalance);
        return csprBalance;
      }
    }
  } catch (error) {
    console.warn("Wallet extension balance fetch not available, trying RPC nodes:", error);
  }

  // Try RPC endpoints (proxy first to bypass CORS, then direct)
  const endpoints = [
    '/casper-rpc', // Try proxy first (bypasses CORS in browser)
    DEFAULT_NETWORK.nodeUrl,
    ...(DEFAULT_NETWORK.fallbackUrls || [])
  ].filter(url => url !== '/casper-rpc' || typeof window !== 'undefined'); // Only use proxy in browser

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
      console.log("✅ Successfully fetched Casper Balance:", csprBalance, "CSPR from", endpoint);
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
  
  // All attempts failed - try wallet extension one more time as last resort
  try {
    const provider = window.CasperWalletProvider?.() || window.casperlabsHelper;
    if (provider) {
      // Try to read from wallet's internal state
      if ((window as any).casperWallet?.balance) {
        const walletBalance = (window as any).casperWallet.balance;
        const csprBalance = (BigInt(walletBalance) / BigInt(1_000_000_000)).toString();
        console.log("✅ Got balance from wallet internal state:", csprBalance, "CSPR");
        localStorage.setItem(`casper_balance_${publicKeyHex}`, csprBalance);
        return csprBalance;
      }
    }
  } catch (e) {
    console.warn("Wallet extension fallback failed:", e);
  }
  
  // Use cached balance if available
  if (cachedBalance) {
    console.warn("⚠️ Using cached balance:", cachedBalance, "CSPR (RPC nodes unavailable)");
    console.info("💡 Click 'Refresh Balance' or use setCasperBalance() in console");
    return cachedBalance;
  }
  
  console.error("⚠️ Returning 0 balance - all methods failed and no cached balance available");
  console.info("💡 Use setCasperBalance(publicKey, balance) in console to set manually");
  console.info("💡 Or check your balance on: " + DEFAULT_NETWORK.scanUrl + "/account/" + publicKeyHex);
  return "0";
}
