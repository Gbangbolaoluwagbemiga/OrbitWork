import {
  Deploy,
  ExecutableDeployItem,
  StoredContractByHash,
  Args,
  CLValue,
  PublicKey,
  DeployHeader,
  ContractHash
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
    CLValue.newCLUInt256((parseFloat(m.amount) * 1_000_000_000).toString())
  );
  const milestoneDescriptions = params.milestones.map(m => 
    CLValue.newCLString(m.description)
  );

  const contractHash = ContractHash.fromJSON(SECUREFLOW_CONTRACT_HASH.replace("hash-", ""));

  const args = Args.fromMap({
    "project_title": CLValue.newCLString(params.projectTitle),
    "project_description": CLValue.newCLString(params.projectDescription),
    "total_amount": CLValue.newCLUInt256(totalAmountMotes),
    "duration": CLValue.newCLUint64(params.duration),
    "milestone_amounts": CLValue.newCLList(milestoneAmounts.length > 0 ? milestoneAmounts[0].type : CLValue.newCLUInt256(0).type, milestoneAmounts),
    "milestone_descriptions": CLValue.newCLList(milestoneDescriptions.length > 0 ? milestoneDescriptions[0].type : CLValue.newCLString("").type, milestoneDescriptions),
  });

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHash,
    "create_escrow",
    args
  );

  const payment = ExecutableDeployItem.standardPayment("10000000000"); // 10 CSPR

  const header = new DeployHeader(chainName, [], undefined, undefined, undefined, senderPublicKey);

  return Deploy.makeDeploy(
    header,
    payment,
    session
  );
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

  const contractHash = ContractHash.fromJSON(SECUREFLOW_CONTRACT_HASH.replace("hash-", ""));

  const args = Args.fromMap({
    "escrow_id": CLValue.newCLUInt32(params.escrowId),
    "cover_letter": CLValue.newCLString(params.coverLetter),
    "proposed_timeline": CLValue.newCLUInt32(params.proposedTimeline),
  });

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHash,
    "apply_to_job",
    args
  );

  const payment = ExecutableDeployItem.standardPayment("5000000000"); // 5 CSPR

  const header = new DeployHeader(chainName, [], undefined, undefined, undefined, senderPublicKey);

  return Deploy.makeDeploy(
    header,
    payment,
    session
  );
}

export function pauseJobCreationDeploy(
  senderPublicKeyHex: string,
  chainName: string = DEFAULT_NETWORK.chainName
): Deploy {
  const senderPublicKey = PublicKey.fromHex(senderPublicKeyHex);

  const contractHash = ContractHash.fromJSON(SECUREFLOW_CONTRACT_HASH.replace("hash-", ""));

  // Assuming the entry point is named "pause_job_creation" taking no args
  const args = Args.fromMap({});

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHash,
    "pause_job_creation",
    args
  );

  const payment = ExecutableDeployItem.standardPayment("1000000000"); // 1 CSPR

  const header = new DeployHeader(chainName, [], undefined, undefined, undefined, senderPublicKey);

  return Deploy.makeDeploy(
    header,
    payment,
    session
  );
}

export function unpauseJobCreationDeploy(
  senderPublicKeyHex: string,
  chainName: string = DEFAULT_NETWORK.chainName
): Deploy {
  const senderPublicKey = PublicKey.fromHex(senderPublicKeyHex);

  const contractHash = ContractHash.fromJSON(SECUREFLOW_CONTRACT_HASH.replace("hash-", ""));

  const args = Args.fromMap({});

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHash,
    "unpause_job_creation",
    args
  );

  const payment = ExecutableDeployItem.standardPayment("1000000000"); // 1 CSPR

  const header = new DeployHeader(chainName, [], undefined, undefined, undefined, senderPublicKey);

  return Deploy.makeDeploy(
    header,
    payment,
    session
  );
}

export async function fetchEscrows() {
  // Mock implementation for now
  return [];
}
