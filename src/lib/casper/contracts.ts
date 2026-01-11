import {
  Deploy,
  ExecutableDeployItem,
  StoredContractByHash,
  Args,
  CLValue,
  PublicKey,
  DeployHeader,
  ContractHash,
  CLValueOption,
  CLTypeOption
} from "casper-js-sdk";
import { DEFAULT_NETWORK } from "./casper-config";

// Placeholder for the deployed contract hash
// Try to get from environment variable first
export const ORBITWORK_CONTRACT_HASH = 
  import.meta.env.VITE_CASPER_CONTRACT_HASH || 
  import.meta.env.VITE_ORBITWORK_CONTRACT_HASH || 
  "hash-0000000000000000000000000000000000000000000000000000000000000000"; 

if (ORBITWORK_CONTRACT_HASH.includes("00000000000000000000000000000000")) {
  console.warn("⚠️ WARNING: ORBITWORK_CONTRACT_HASH is set to default zeros. Contract interactions will fail. Please set VITE_CASPER_CONTRACT_HASH in your .env file.");
}

export interface CreateEscrowParams {
  projectTitle: string;
  projectDescription: string;
  totalAmount: string; // In CSPR
  duration: number; // Seconds
  milestones: { description: string; amount: string }[];
  token?: string; // Optional token contract hash (if not provided, uses native CSPR)
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

  const contractHash = ContractHash.fromJSON(ORBITWORK_CONTRACT_HASH.replace("hash-", ""));

  // Handle optional token parameter (Option<Key>)
  // For native CSPR, create Option::None using CLValueOption.fromBytes
  let tokenValue: CLValue;
  if (params.token && params.token.trim() !== "") {
    // Token is provided - create Option::Some
    const tokenHash = params.token.trim().replace(/^hash-/, "");
    const tokenKey = ContractHash.fromJSON(tokenHash) as any;
    const tokenCLKey = CLValue.newCLKey(tokenKey);
    tokenValue = (CLValue.newCLOption as any)(tokenCLKey.type, tokenCLKey);
  } else {
    // No token (native CSPR) - create Option::None using fromBytes with 0x00
    // Create a dummy key to get the Key type
    const dummyKeyObj = ContractHash.fromJSON("0000000000000000000000000000000000000000000000000000000000000000") as any;
    const dummyKey = CLValue.newCLKey(dummyKeyObj);
    const keyType = dummyKey.type;
    const optType = new CLTypeOption(keyType);
    const optNoneResult = CLValueOption.fromBytes(Uint8Array.from([0x00]), optType);
    const optNoneClOption = optNoneResult.result;
    // Create CLValue and set the option property
    const clValue = CLValue.newCLOption(null, keyType) as any;
    clValue.option = optNoneClOption;
    tokenValue = clValue;
  }

  const args = Args.fromMap({
    "project_title": CLValue.newCLString(params.projectTitle),
    "project_description": CLValue.newCLString(params.projectDescription),
    "total_amount": CLValue.newCLUInt256(totalAmountMotes),
    "duration": CLValue.newCLUint64(params.duration),
    "milestone_amounts": CLValue.newCLList(milestoneAmounts.length > 0 ? milestoneAmounts[0].type : CLValue.newCLUInt256(0).type, milestoneAmounts),
    "milestone_descriptions": CLValue.newCLList(milestoneDescriptions.length > 0 ? milestoneDescriptions[0].type : CLValue.newCLString("").type, milestoneDescriptions),
    "token": tokenValue, // Always include token parameter (Option::Some or Option::None)
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

  const contractHash = ContractHash.fromJSON(ORBITWORK_CONTRACT_HASH.replace("hash-", ""));

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

  const contractHash = ContractHash.fromJSON(ORBITWORK_CONTRACT_HASH.replace("hash-", ""));

  // Assuming the entry point is named "pause_job_creation" taking no args
  const args = Args.fromMap({});

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHash,
    "pause_job_creation",
    args
  );

  const payment = ExecutableDeployItem.standardPayment("10000000000"); // 10 CSPR (increased for testnet minimum)

  const header = new DeployHeader(chainName, [], undefined, undefined, undefined, senderPublicKey);

  return Deploy.makeDeploy(
    header,
    payment,
    session
  );
}

export function initContractDeploy(
  senderPublicKeyHex: string,
  chainName: string = DEFAULT_NETWORK.chainName
): Deploy {
  const senderPublicKey = PublicKey.fromHex(senderPublicKeyHex);

  const contractHash = ContractHash.fromJSON(ORBITWORK_CONTRACT_HASH.replace("hash-", ""));

  // init() takes no arguments
  const args = Args.fromMap({});

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHash,
    "init",
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

export function unpauseJobCreationDeploy(
  senderPublicKeyHex: string,
  chainName: string = DEFAULT_NETWORK.chainName
): Deploy {
  const senderPublicKey = PublicKey.fromHex(senderPublicKeyHex);

  const contractHash = ContractHash.fromJSON(ORBITWORK_CONTRACT_HASH.replace("hash-", ""));

  const args = Args.fromMap({});

  const session = new ExecutableDeployItem();
  session.storedContractByHash = new StoredContractByHash(
    contractHash,
    "unpause_job_creation",
    args
  );

  const payment = ExecutableDeployItem.standardPayment("10000000000"); // 10 CSPR (increased for testnet minimum)

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
