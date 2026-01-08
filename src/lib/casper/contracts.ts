import {
  Deploy,
  DeployHeader,
  ExecutableDeployItem,
  StoredContractByHash,
  Args,
  PublicKey,
  CLValue,
  CLTypeU256,
  CLTypeString,
  CLTypeU64
} from "casper-js-sdk";
import { DEFAULT_NETWORK } from "./casper-config";

// Placeholder for the deployed contract hash
export const SECUREFLOW_CONTRACT_HASH = "hash-0000000000000000000000000000000000000000000000000000000000000000"; 

export interface CreateEscrowParams {
  projectTitle: string;
  projectDescription: string;
  totalAmount: string; // In CSPR
  duration: number; // Seconds
  milestones: { description: string; amount: string }[];
  beneficiary?: string;
}

export function createEscrowDeploy(
  params: CreateEscrowParams,
  senderPublicKeyHex: string,
  chainName: string = DEFAULT_NETWORK.chainName
): Deploy {
  const senderPublicKey = PublicKey.fromHex(senderPublicKeyHex);
  
  // Convert amounts to motes (1 CSPR = 10^9 motes)
  const totalAmountMotes = (parseFloat(params.totalAmount) * 1_000_000_000).toString();
  
  const milestoneAmounts = params.milestones.map(m => 
    CLValue.u256((parseFloat(m.amount) * 1_000_000_000).toString())
  );
  const milestoneDescriptions = params.milestones.map(m => 
    CLValue.string(m.description)
  );

  const contractHashAsByteArray = Uint8Array.from(
    Buffer.from(SECUREFLOW_CONTRACT_HASH.replace("hash-", ""), "hex")
  );

  const args = Args.fromMap({
    "project_title": CLValue.string(params.projectTitle),
    "project_description": CLValue.string(params.projectDescription),
    "total_amount": CLValue.u256(totalAmountMotes),
    "duration": CLValue.u64(params.duration),
    "milestone_amounts": CLValue.list(milestoneAmounts, new CLTypeU256()),
    "milestone_descriptions": CLValue.list(milestoneDescriptions, new CLTypeString()),
  });

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHashAsByteArray,
    "create_escrow",
    args
  );

  const payment = ExecutableDeployItem.standardPayment(10_000_000_000); // 10 CSPR

  const header = new DeployHeader(
    chainName,
    [], // dependencies
    1, // gasPrice
    undefined, // timestamp
    undefined, // ttl
    senderPublicKey
  );

  return Deploy.makeDeploy(header, payment, session);
}

export interface ApplyToJobParams {
  escrowId: number;
  coverLetter: string;
  proposedTimeline: number;
}

export function applyToJobDeploy(
  params: ApplyToJobParams,
  senderPublicKeyHex: string,
  chainName: string = DEFAULT_NETWORK.chainName
): Deploy {
  const senderPublicKey = PublicKey.fromHex(senderPublicKeyHex);

  const contractHashAsByteArray = Uint8Array.from(
    Buffer.from(SECUREFLOW_CONTRACT_HASH.replace("hash-", ""), "hex")
  );

  const args = Args.fromMap({
    "escrow_id": CLValue.u32(params.escrowId),
    "cover_letter": CLValue.string(params.coverLetter),
    "proposed_timeline": CLValue.u32(params.proposedTimeline),
  });

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHashAsByteArray,
    "apply_to_job",
    args
  );

  const payment = ExecutableDeployItem.standardPayment(5_000_000_000); // 5 CSPR

  const header = new DeployHeader(
    chainName,
    [],
    1,
    undefined,
    undefined,
    senderPublicKey
  );

  return Deploy.makeDeploy(header, payment, session);
}

export async function fetchEscrows() {
  // Mock implementation for now
  return [];
}
