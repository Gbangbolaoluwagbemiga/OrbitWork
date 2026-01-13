/**
 * Casper Contract Service
 * Provides querying functions for Casper contract state
 * Replaces the Stellar contract service for Casper network
 */

import { RpcClient, HttpHandler } from "casper-js-sdk";
import { ORBITWORK_CONTRACT_HASH } from "./contracts";
import { deserializeEscrow } from "./casper-deserializer";

// Export interface compatible with existing EscrowData from contract-service
export interface CasperEscrowData {
  escrow_id: number;
  creator: string; // depositor from contract
  freelancer?: string; // beneficiary from contract  
  status: number;
  token?: string;
  amount: string; // total_amount from contract
  paid_amount?: string;
  deadline: number;
  created_at: number;
  milestones?: any[];
  project_title?: string;
  project_description?: string;
  is_open_job?: boolean;
}

const endpoints = [
  "/casper-rpc",
  "https://node.testnet.casper.network/rpc",
  "http://65.21.235.219:7777/rpc",
];

async function getRpcClient(): Promise<RpcClient> {
  for (const endpoint of endpoints) {
    try {
      const httpHandler = new HttpHandler(endpoint);
      const client = new RpcClient(httpHandler);
      await client.getLatestBlock();
      return client;
    } catch (error) {
      console.warn(`[casper-contract-service] Failed to connect to ${endpoint}:`, error);
      continue;
    }
  }
  throw new Error("Failed to connect to any Casper RPC endpoint");
}

async function getStateRootHashString(client: RpcClient): Promise<string> {
  try {
    // Use chain_get_state_root_hash RPC method directly for reliability
    const response = await fetch("/casper-rpc", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'chain_get_state_root_hash'
      })
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(`Failed to get state root hash: ${data.error.message}`);
    }
    const stateRootHash = data.result?.state_root_hash || data.result;
    if (typeof stateRootHash === 'string') {
      return stateRootHash;
    }
    // Fallback to block header if RPC fails
    const latestBlock = await client.getLatestBlock();
    const blockHash = (latestBlock.block as any)?.header?.state_root_hash;
    if (typeof blockHash === 'string') return blockHash;
    return String(blockHash || "");
  } catch (error) {
    console.warn("[casper-contract-service] Failed to get state root hash via RPC, using block header:", error);
    const latestBlock = await client.getLatestBlock();
    const stateRootHashValue = (latestBlock.block as any)?.header?.state_root_hash;
    if (typeof stateRootHashValue === 'string') {
      return stateRootHashValue;
    }
    // Try to extract from nested structure
    const hashStr = (stateRootHashValue as any)?.value?.() || 
                    (stateRootHashValue as any)?.hex || 
                    (stateRootHashValue as any)?.toString?.() || 
                    String(stateRootHashValue || "");
    return hashStr;
  }
}

async function queryGlobalStateRaw(endpoint: string, stateRootHash: string, key: string, path: string[] = []): Promise<any> {
  // Ensure stateRootHash is a string
  const stateRootHashStr = typeof stateRootHash === 'string' ? stateRootHash : String(stateRootHash || "");
  
  const requestBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'state_get_item',
    params: {
      state_root_hash: stateRootHashStr,
      key: key,
      path: path.length > 0 ? path : undefined
    }
  };
  
  // Remove undefined path if empty
  if (!requestBody.params.path) {
    delete (requestBody.params as any).path;
  }
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  if (data.error) {
    console.error("[casper-contract-service] RPC Error:", {
      method: 'state_get_item',
      params: requestBody.params,
      error: data.error
    });
    throw new Error(`RPC Error: ${data.error.message || JSON.stringify(data.error)}`);
  }
  return data.result;
}

async function queryDictionaryRaw(endpoint: string, stateRootHash: string, contractHash: string, dictionaryName: string, dictionaryItemKey: string): Promise<any> {
  // Ensure stateRootHash is a string
  const stateRootHashStr = typeof stateRootHash === 'string' ? stateRootHash : String(stateRootHash || "");
  
  const requestBody = {
    jsonrpc: '2.0',
    id: 1,
    method: 'state_get_dictionary_item',
    params: {
      state_root_hash: stateRootHashStr,
      dictionary_identifier: {
        ContractNamedKey: {
          key: contractHash.startsWith('hash-') ? contractHash : `hash-${contractHash}`,
          dictionary_name: dictionaryName,
          dictionary_item_key: dictionaryItemKey
        }
      }
    }
  };
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const data = await response.json();
  if (data.error) {
    console.error("[casper-contract-service] RPC Error:", {
      method: 'state_get_dictionary_item',
      params: requestBody.params,
      error: data.error
    });
    throw new Error(`RPC Error: ${data.error.message || JSON.stringify(data.error)}`);
  }
  return data.result;
}

export async function getNextEscrowId(): Promise<number> {
  try {
    const client = await getRpcClient();
    const stateRootHash = await getStateRootHashString(client);
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    const endpoint = "/casper-rpc";
    
    const result = await queryGlobalStateRaw(endpoint, stateRootHash, `hash-${contractHashHex}`, ["next_escrow_id"]);
    
    if (result?.stored_value?.CLValue) {
      const value = result.stored_value.CLValue.parsed || result.stored_value.CLValue.value;
      return Number.parseInt(value?.toString() || "0", 10);
    }
    
    return 0;
  } catch (error) {
    console.error("[casper-contract-service] Error getting next escrow ID:", error);
    return 0;
  }
}

export async function getEscrow(escrowId: number): Promise<CasperEscrowData | null> {
  try {
    const client = await getRpcClient();
    const stateRootHash = await getStateRootHashString(client);
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    const endpoint = "/casper-rpc";
    
    const result = await queryDictionaryRaw(endpoint, stateRootHash, contractHashHex, "escrows", escrowId.toString());
    
    if (result?.stored_value) {
      // Handle different CLValue structures
      const clValue = result.stored_value.CLValue || result.stored_value.clValue;
      if (!clValue) {
        console.warn(`[casper-contract-service] No CLValue found in result for escrow ${escrowId}`);
        return null;
      }
      
      // Extract value - try parsed, then value, then manual deserialization from bytes
      let data: any = clValue.parsed || clValue.value;
      
      // If value is still not available and we have bytes, manually deserialize
      if (!data && clValue.bytes && clValue.cl_type === 'Any') {
        try {
          const hexBytes = typeof clValue.bytes === 'string' ? clValue.bytes : 
                           Array.isArray(clValue.bytes) ? clValue.bytes.map((b: number) => b.toString(16).padStart(2, '0')).join('') :
                           '';
          if (hexBytes) {
            data = deserializeEscrow(hexBytes);
            console.log(`[casper-contract-service] Successfully deserialized escrow ${escrowId} from bytes`);
          }
        } catch (e: any) {
          console.error(`[casper-contract-service] Failed to deserialize CLValue bytes for escrow ${escrowId}:`, e);
          // Don't return null - return minimal escrow data so UI can still show something
          console.warn(`[casper-contract-service] Returning minimal escrow structure for escrow ${escrowId}`);
          return {
            escrow_id: escrowId,
            creator: "",
            freelancer: undefined,
            status: 0,
            token: undefined,
            amount: "0",
            paid_amount: "0",
            deadline: Date.now() + 7 * 24 * 60 * 60 * 1000,
            created_at: Date.now(),
            milestones: [],
            project_title: `Escrow #${escrowId}`,
            project_description: "Escrow data could not be fully deserialized due to byte misalignment",
            is_open_job: true,
          };
        }
      }
      
      // If still no data, try parsing as JSON string
      if (!data && typeof clValue.value === 'string') {
        try {
          data = JSON.parse(clValue.value);
        } catch (e) {
          // Not JSON, skip
        }
      }
      
      if (!data || typeof data !== 'object') {
        console.warn(`[casper-contract-service] No valid data extracted for escrow ${escrowId}. CLValue structure:`, {
          cl_type: clValue.cl_type,
          has_parsed: !!clValue.parsed,
          has_value: !!clValue.value,
          has_bytes: !!clValue.bytes,
          bytes_length: clValue.bytes?.length
        });
        return null;
      }
      
      const escrowData = {
        escrow_id: escrowId,
        creator: data.depositor || data.creator || "",
        freelancer: data.beneficiary || data.freelancer,
        status: data.status || 0,
        token: data.token,
        amount: data.total_amount?.toString() || data.amount?.toString() || "0",
        paid_amount: data.paid_amount?.toString(),
        deadline: data.deadline || 0,
        created_at: data.created_at || 0,
        milestones: data.milestones || [],
        project_title: data.project_title || "",
        project_description: data.project_description || "",
        is_open_job: data.is_open_job !== undefined ? data.is_open_job : true,
      };
      
      console.log(`[getEscrow] Returning escrow ${escrowId} data:`, {
        creator: escrowData.creator,
        freelancer: escrowData.freelancer,
        is_open_job: escrowData.is_open_job,
        project_title: escrowData.project_title,
        project_description: escrowData.project_description,
        status: escrowData.status,
        amount: escrowData.amount,
        created_at: escrowData.created_at,
        deadline: escrowData.deadline,
      });
      
      return escrowData;
    }
    
    return null;
  } catch (error: any) {
    console.error(`[casper-contract-service] Error getting escrow ${escrowId}:`, error);
    // Even if deserialization failed, try to return a minimal escrow structure
    // so the UI can at least show that an escrow exists
    console.warn(`[casper-contract-service] Returning minimal escrow structure for escrow ${escrowId} due to deserialization error`);
      return {
        escrow_id: escrowId,
        creator: "",
        freelancer: undefined,
        status: 0,
        token: undefined,
      amount: "0",
      paid_amount: "0",
      deadline: 0,
      created_at: Date.now(),
      milestones: [],
      project_title: `Escrow #${escrowId}`,
      project_description: "Escrow data could not be fully deserialized",
      is_open_job: true,
    };
  }
}

export async function getMilestones(escrowId: number): Promise<any[]> {
  try {
    const client = await getRpcClient();
    const stateRootHash = await getStateRootHashString(client);
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    const endpoint = "/casper-rpc";
    
    const result = await queryDictionaryRaw(endpoint, stateRootHash, contractHashHex, "milestones", escrowId.toString());
    
    if (result?.stored_value?.CLValue) {
      const value = result.stored_value.CLValue.parsed || result.stored_value.CLValue.value;
      return value || [];
    }
    
    return [];
  } catch (error) {
    console.error(`[casper-contract-service] Error getting milestones for escrow ${escrowId}:`, error);
    return [];
  }
}

export async function getApplications(escrowId: number): Promise<any[]> {
  try {
    // Applications are stored with key format: "escrow_id:freelancer_key_hex"
    // We can't iterate, so we return empty array for now
    // TODO: Contract should store a Vec<Application> or we need to track applicants separately
    console.warn(`[casper-contract-service] getApplications(${escrowId}) - Applications stored with composite keys, cannot list all. Returning empty array.`);
    return [];
  } catch (error) {
    console.error(`[casper-contract-service] Error getting applications for escrow ${escrowId}:`, error);
    return [];
  }
}

/**
 * Check if a specific user has applied to an escrow
 * Applications are stored with key: "escrow_id:freelancer_key_hex"
 */
export async function hasUserApplied(escrowId: number, userAddress: string): Promise<boolean> {
  try {
    const client = await getRpcClient();
    const stateRootHash = await getStateRootHashString(client);
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    const endpoint = "/casper-rpc";
    
    // Convert user address to Key format for dictionary key
    // The contract stores applications with key: "escrow_id:freelancer_key_hex"
    // We need to construct the key properly
    const { PublicKey } = await import("casper-js-sdk");
    const userPublicKey = PublicKey.fromHex(userAddress);
    const userAccountHash = userPublicKey.accountHash();
    const userKeyHex = userAccountHash.toHex();
    
    // Dictionary key format: "escrow_id:freelancer_key_hex"
    const dictKey = `${escrowId}:${userKeyHex}`;
    
    const result = await queryDictionaryRaw(endpoint, stateRootHash, contractHashHex, "applications", dictKey);
    
    if (result?.stored_value?.CLValue) {
      // If we get a CLValue, the application exists
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`[casper-contract-service] Error checking if user has applied to escrow ${escrowId}:`, error);
    return false;
  }
}

export async function getBadge(address: string): Promise<string> {
  try {
    const client = await getRpcClient();
    const stateRootHash = await getStateRootHashString(client);
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    const endpoint = "/casper-rpc";
    
    const result = await queryDictionaryRaw(endpoint, stateRootHash, contractHashHex, "badges", address);
    
    if (result?.stored_value?.CLValue) {
      const value = result.stored_value.CLValue.parsed || result.stored_value.CLValue.value;
      return value?.toString() || "Beginner";
    }
    
    return "Beginner";
  } catch (error) {
    console.error(`[casper-contract-service] Error getting badge for ${address}:`, error);
    return "Beginner";
  }
}

export async function getAverageRating(address: string): Promise<{ average: number; count: number }> {
  try {
    const client = await getRpcClient();
    const stateRootHash = await getStateRootHashString(client);
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    const endpoint = "/casper-rpc";
    
    const result = await queryDictionaryRaw(endpoint, stateRootHash, contractHashHex, "average_ratings", address);
    
    if (result?.stored_value?.CLValue) {
      const value = result.stored_value.CLValue.parsed || result.stored_value.CLValue.value;
      const data = typeof value === "string" ? JSON.parse(value) : value;
      return {
        average: data?.average || 0,
        count: data?.count || 0,
      };
    }
    
    return { average: 0, count: 0 };
  } catch (error) {
    console.error(`[casper-contract-service] Error getting average rating for ${address}:`, error);
    return { average: 0, count: 0 };
  }
}

export async function getRating(escrowId: number): Promise<{ rating: number; review: string } | null> {
  try {
    const client = await getRpcClient();
    const stateRootHash = await getStateRootHashString(client);
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    const endpoint = "/casper-rpc";
    
    const result = await queryDictionaryRaw(endpoint, stateRootHash, contractHashHex, "ratings", escrowId.toString());
    
    if (result?.stored_value?.CLValue) {
      const value = result.stored_value.CLValue.parsed || result.stored_value.CLValue.value;
      const data = typeof value === "string" ? JSON.parse(value) : value;
      return {
        rating: data?.rating || 0,
        review: data?.review || "",
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[casper-contract-service] Error getting rating for escrow ${escrowId}:`, error);
    return null;
  }
}

export async function isJobCreationPaused(): Promise<boolean> {
  try {
    const client = await getRpcClient();
    const stateRootHash = await getStateRootHashString(client);
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    const endpoint = "/casper-rpc";
    
    // Try querying for "paused" named key (contract might use different key name)
    try {
      const result = await queryGlobalStateRaw(endpoint, stateRootHash, `hash-${contractHashHex}`, ["paused"]);
      const clValue = result?.stored_value?.CLValue || result?.stored_value?.clValue;
      if (clValue) {
        const value = clValue.parsed || clValue.value;
        return value === true || value === 1;
      }
    } catch (e) {
      // Try "is_paused" if "paused" fails
      try {
        const result = await queryGlobalStateRaw(endpoint, stateRootHash, `hash-${contractHashHex}`, ["is_paused"]);
        const clValue = result?.stored_value?.CLValue || result?.stored_value?.clValue;
        if (clValue) {
          const value = clValue.parsed || clValue.value;
          return value === true || value === 1;
        }
      } catch (e2) {
        // Key doesn't exist - contract not initialized or different structure
        // This is fine, just return false (not paused)
        console.warn("[casper-contract-service] Could not find pause status key, assuming not paused");
      }
    }
    
    return false;
  } catch (error) {
    // If all queries fail, assume not paused
    console.warn("[casper-contract-service] Error checking if job creation is paused, assuming not paused:", error);
    return false;
  }
}
