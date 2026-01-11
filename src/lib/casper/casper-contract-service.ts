/**
 * Casper Contract Service
 * Provides querying functions for Casper contract state
 * Replaces the Stellar contract service for Casper network
 */

import { RpcClient, HttpHandler, ParamDictionaryIdentifier } from "casper-js-sdk";
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

export async function getNextEscrowId(): Promise<number> {
  try {
    const client = await getRpcClient();
    const stateRootHashResult = await client.getStateRootHashLatest();
    const stateRootHash = (stateRootHashResult as any).stateRootHash || (stateRootHashResult as any).state_root_hash || stateRootHashResult;
    
    // Extract hex string from contract hash (remove "hash-" prefix if present)
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    
    // Query named key using getStateItem
    const result = await client.getStateItem(stateRootHash, contractHashHex, ["next_escrow_id"]);
    
    if (result?.storedValue?.clValue) {
      const value = (result.storedValue.clValue as any).parsed || (result.storedValue.clValue as any).value;
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
    const stateRootHashResult = await client.getStateRootHashLatest();
    const stateRootHash = (stateRootHashResult as any).stateRootHash || (stateRootHashResult as any).state_root_hash || stateRootHashResult;
    
    // Extract hex string from contract hash (remove "hash-" prefix if present)
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    
    // Query dictionary item using getDictionaryItemByIdentifier
    const dictionaryIdentifier: ParamDictionaryIdentifier = {
      contractNamedKey: {
        key: contractHashHex,
        dictionaryName: "escrows",
        dictionaryItemKey: escrowId.toString(),
      },
    };
    
    const result = await client.getDictionaryItemByIdentifier(stateRootHash, dictionaryIdentifier);
    
    if (result?.storedValue?.clValue) {
      const value = (result.storedValue.clValue as any).parsed || (result.storedValue.clValue as any).value;
      const data = typeof value === "string" ? JSON.parse(value) : value;
      // Parse and map the contract data to CasperEscrowData
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
    const stateRootHashResult = await client.getStateRootHashLatest();
    const stateRootHash = (stateRootHashResult as any).stateRootHash || (stateRootHashResult as any).state_root_hash || stateRootHashResult;
    
    // Extract hex string from contract hash (remove "hash-" prefix if present)
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    
    const dictionaryIdentifier: ParamDictionaryIdentifier = {
      contractNamedKey: {
        key: contractHashHex,
        dictionaryName: "milestones",
        dictionaryItemKey: escrowId.toString(),
      },
    };
    
    const result = await client.getDictionaryItemByIdentifier(stateRootHash, dictionaryIdentifier);
    
    if (result?.storedValue?.clValue) {
      const value = (result.storedValue.clValue as any).parsed || (result.storedValue.clValue as any).value;
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
    const stateRootHashResult = await client.getStateRootHashLatest();
    const stateRootHash = (stateRootHashResult as any).stateRootHash || (stateRootHashResult as any).state_root_hash || stateRootHashResult;
    
    // Extract hex string from contract hash (remove "hash-" prefix if present)
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    
    const dictionaryIdentifier: ParamDictionaryIdentifier = {
      contractNamedKey: {
        key: contractHashHex,
        dictionaryName: "applications",
        dictionaryItemKey: escrowId.toString(),
      },
    };
    
    const result = await client.getDictionaryItemByIdentifier(stateRootHash, dictionaryIdentifier);
    
    if (result?.storedValue?.clValue) {
      const value = (result.storedValue.clValue as any).parsed || (result.storedValue.clValue as any).value;
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
    const stateRootHashResult = await client.getStateRootHashLatest();
    const stateRootHash = (stateRootHashResult as any).stateRootHash || (stateRootHashResult as any).state_root_hash || stateRootHashResult;
    
    // Extract hex string from contract hash (remove "hash-" prefix if present)
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    
    const dictionaryIdentifier: ParamDictionaryIdentifier = {
      contractNamedKey: {
        key: contractHashHex,
        dictionaryName: "badges",
        dictionaryItemKey: address,
      },
    };
    
    const result = await client.getDictionaryItemByIdentifier(stateRootHash, dictionaryIdentifier);
    
    if (result?.storedValue?.clValue) {
      const value = (result.storedValue.clValue as any).parsed || (result.storedValue.clValue as any).value;
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
    const stateRootHashResult = await client.getStateRootHashLatest();
    const stateRootHash = (stateRootHashResult as any).stateRootHash || (stateRootHashResult as any).state_root_hash || stateRootHashResult;
    
    // Extract hex string from contract hash (remove "hash-" prefix if present)
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    
    const dictionaryIdentifier: ParamDictionaryIdentifier = {
      contractNamedKey: {
        key: contractHashHex,
        dictionaryName: "average_ratings",
        dictionaryItemKey: address,
      },
    };
    
    const result = await client.getDictionaryItemByIdentifier(stateRootHash, dictionaryIdentifier);
    
    if (result?.storedValue?.clValue) {
      const value = (result.storedValue.clValue as any).parsed || (result.storedValue.clValue as any).value;
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
    const stateRootHashResult = await client.getStateRootHashLatest();
    const stateRootHash = (stateRootHashResult as any).stateRootHash || (stateRootHashResult as any).state_root_hash || stateRootHashResult;
    
    // Extract hex string from contract hash (remove "hash-" prefix if present)
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    
    const dictionaryIdentifier: ParamDictionaryIdentifier = {
      contractNamedKey: {
        key: contractHashHex,
        dictionaryName: "ratings",
        dictionaryItemKey: escrowId.toString(),
      },
    };
    
    const result = await client.getDictionaryItemByIdentifier(stateRootHash, dictionaryIdentifier);
    
    if (result?.storedValue?.clValue) {
      const value = (result.storedValue.clValue as any).parsed || (result.storedValue.clValue as any).value;
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
    const stateRootHashResult = await client.getStateRootHashLatest();
    const stateRootHash = (stateRootHashResult as any).stateRootHash || (stateRootHashResult as any).state_root_hash || stateRootHashResult;
    
    // Extract hex string from contract hash (remove "hash-" prefix if present)
    const contractHashHex = ORBITWORK_CONTRACT_HASH.replace(/^hash-/, "");
    
    const result = await client.getStateItem(stateRootHash, contractHashHex, ["is_paused"]);
    
    if (result?.storedValue?.clValue) {
      const value = (result.storedValue.clValue as any).parsed || (result.storedValue.clValue as any).value;
      return value === true || value === 1;
    }
    
    return false;
  } catch (error) {
    console.error("[casper-contract-service] Error checking if job creation is paused:", error);
    return false;
  }
}
