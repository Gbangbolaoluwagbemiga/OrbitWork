/**
 * Casper Contract Service
 * Provides querying functions for Casper contract state
 * Replaces the Stellar contract service for Casper network
 */

import { RpcClient, HttpHandler } from "casper-js-sdk";
import { ORBITWORK_CONTRACT_HASH } from "./contracts";

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
  const latestBlock = await client.getLatestBlock();
  const stateRootHashValue = (latestBlock.block as any)?.header?.state_root_hash;
  // Convert to string if it's an object (Hash type)
  if (typeof stateRootHashValue === 'string') {
    return stateRootHashValue;
  }
  return stateRootHashValue?.toString?.() || String(stateRootHashValue || "");
}

async function queryGlobalStateRaw(endpoint: string, stateRootHash: string, key: string, path: string[] = []): Promise<any> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'state_get_item',
      params: {
        state_root_hash: stateRootHash,
        key: key,
        path: path
      }
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(`RPC Error: ${data.error.message || JSON.stringify(data.error)}`);
  return data.result;
}

async function queryDictionaryRaw(endpoint: string, stateRootHash: string, contractHash: string, dictionaryName: string, dictionaryItemKey: string): Promise<any> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'state_get_dictionary_item',
      params: {
        state_root_hash: stateRootHash,
        dictionary_identifier: {
          ContractNamedKey: {
            key: `hash-${contractHash}`,
            dictionary_name: dictionaryName,
            dictionary_item_key: dictionaryItemKey
          }
        }
      }
    })
  });
  const data = await response.json();
  if (data.error) throw new Error(`RPC Error: ${data.error.message || JSON.stringify(data.error)}`);
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
    
    if (result?.stored_value?.CLValue) {
      const value = result.stored_value.CLValue.parsed || result.stored_value.CLValue.value;
      const data = typeof value === "string" ? JSON.parse(value) : value;
      return {
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
        is_open_job: data.is_open_job || false,
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[casper-contract-service] Error getting escrow ${escrowId}:`, error);
    return null;
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
    const client = await getRpcClient();
    const stateRootHash = await getStateRootHashString(client);
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    const endpoint = "/casper-rpc";
    
    const result = await queryDictionaryRaw(endpoint, stateRootHash, contractHashHex, "applications", escrowId.toString());
    
    if (result?.stored_value?.CLValue) {
      const value = result.stored_value.CLValue.parsed || result.stored_value.CLValue.value;
      return value || [];
    }
    
    return [];
  } catch (error) {
    console.error(`[casper-contract-service] Error getting applications for escrow ${escrowId}:`, error);
    return [];
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
    
    const result = await queryGlobalStateRaw(endpoint, stateRootHash, `hash-${contractHashHex}`, ["is_paused"]);
    
    if (result?.stored_value?.CLValue) {
      const value = result.stored_value.CLValue.parsed || result.stored_value.CLValue.value;
      return value === true || value === 1;
    }
    
    return false;
  } catch (error) {
    console.error("[casper-contract-service] Error checking if job creation is paused:", error);
    return false;
  }
}
