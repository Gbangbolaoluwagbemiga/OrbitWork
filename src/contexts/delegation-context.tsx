

import {
  createContext,
  use,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useToast } from "@/hooks/use-toast";
import { useCasper } from "./casper-context";


interface Delegation {
  id: string;
  delegator: string;
  delegatee: string;
  functions: string[];
  expiry: number;
  isActive: boolean;
}

interface DelegationContextType {
  delegations: Delegation[];
  createDelegation: (
    delegatee: string,
    functions: string[],
    duration: number,
  ) => Promise<string>;
  revokeDelegation: (delegationId: string) => Promise<void>;
  executeDelegatedFunction: (
    delegationId: string,
    functionName: string,
    _args: any[],
  ) => Promise<string>;
  isDelegatedFunction: (functionName: string) => boolean;
  getActiveDelegations: () => Delegation[];
}

const DelegationContext = createContext<DelegationContextType | undefined>(
  undefined,
);

export function DelegationProvider({ children }: { children: ReactNode }) {
  const { isConnected, address } = useCasper();
  const { toast } = useToast();
  const [delegations, setDelegations] = useState<Delegation[]>([]);

  // Functions that can be delegated for gasless execution
  const DELEGATABLE_FUNCTIONS = [
    "create_escrow",
    "createEscrowNative",
    "pause",
    "unpause",
    "resolveDispute",
    "authorize_arbiter",
    "revokeArbiter",
    "whitelist_token",
    "blacklistToken",
    "approve_milestone",
    "rejectMilestone",
    "resubmitMilestone",
    "dispute_milestone",
    "submit_milestone",
    "start_work",
  ];

  useEffect(() => {
    if (isConnected) {
      loadDelegations();
    }
  }, [isConnected]);

  const loadDelegations = async () => {
    try {
      // In a real implementation, this would load from the blockchain
      // For now, we'll use localStorage for demo purposes
      const stored = localStorage.getItem("orbitwork_delegations");
      if (stored) {
        setDelegations(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load delegations:", error);
    }
  };

  const saveDelegations = (newDelegations: Delegation[]) => {
    setDelegations(newDelegations);
    localStorage.setItem(
      "orbitwork_delegations",
      JSON.stringify(newDelegations),
    );
  };

  const createDelegation = async (
    delegatee: string,
    functions: string[],
    duration: number,
  ) => {
    try {
      if (!isConnected || !address) {
        throw new Error("Wallet not connected");
      }

      // Validate functions
      const invalidFunctions = functions.filter(
        (fn) => !DELEGATABLE_FUNCTIONS.includes(fn),
      );
      if (invalidFunctions.length > 0) {
        throw new Error(`Invalid functions: ${invalidFunctions.join(", ")}`);
      }

      const delegation: Delegation = {
        id: `delegation_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        delegator: address!,
        delegatee,
        functions,
        expiry: Math.floor(Date.now() / 1000) + duration,
        isActive: true,
      };

      console.log("Creating delegation:", delegation);
      const updatedDelegations = [...delegations, delegation];
      console.log("Updated delegations:", updatedDelegations);
      saveDelegations(updatedDelegations);

      // Wait for state update
      await new Promise((resolve) => setTimeout(resolve, 100));

      toast({
        title: "Delegation Created",
        description: `Delegated ${functions.length} functions to ${delegatee.slice(0, 6)}...${delegatee.slice(-4)}`,
      });

      // Delegation created successfully
      return delegation.id;
    } catch (error: any) {
      console.error("Delegation creation failed:", error);
      toast({
        title: "Delegation Failed",
        description: error.message || "Failed to create delegation",
        variant: "destructive",
      });
      throw error;
    }
  };

  const revokeDelegation = async (delegationId: string) => {
    try {
      const updatedDelegations = delegations.map((delegation) =>
        delegation.id === delegationId
          ? { ...delegation, isActive: false }
          : delegation,
      );

      saveDelegations(updatedDelegations);

      toast({
        title: "Delegation Revoked",
        description: "Delegation has been successfully revoked",
      });
    } catch (error: any) {
      console.error("Delegation revocation failed:", error);
      toast({
        title: "Revocation Failed",
        description: error.message || "Failed to revoke delegation",
        variant: "destructive",
      });
      throw error;
    }
  };

  const executeDelegatedFunction = async (
    delegationId: string,
    functionName: string,
    _args: any[],
  ) => {
    try {
      const delegation = delegations.find((d) => d.id === delegationId);
      if (!delegation) {
        throw new Error("Delegation not found");
      }

      if (!delegation.isActive) {
        throw new Error("Delegation is not active");
      }

      if (delegation.expiry < Math.floor(Date.now() / 1000)) {
        throw new Error("Delegation has expired");
      }

      if (!delegation.functions.includes(functionName)) {
        throw new Error(`Function ${functionName} is not delegated`);
      }

      // Placeholder Casper implementation: simulate action and return dummy hash
      await new Promise((resolve) => setTimeout(resolve, 500));
      const txHash = "0x" + "0".repeat(64);
      toast({
        title: "Delegated Function Executed",
        description: `Function ${functionName} executed successfully`,
      });
      return txHash;
    } catch (error: any) {
      console.error("Delegated function execution failed:", error);
      toast({
        title: "Execution Failed",
        description: error.message || "Failed to execute delegated function",
        variant: "destructive",
      });
      throw error;
    }
  };

  const isDelegatedFunction = (functionName: string): boolean => {
    return delegations.some(
      (delegation) =>
        delegation.isActive &&
        (!!address &&
          delegation.delegatee.toLowerCase() === address.toLowerCase()) &&
        delegation.functions.includes(functionName) &&
        delegation.expiry > Math.floor(Date.now() / 1000),
    );
  };

  const getActiveDelegations = (): Delegation[] => {
    return delegations.filter(
      (delegation) =>
        delegation.isActive &&
        delegation.expiry > Math.floor(Date.now() / 1000),
    );
  };

  const value = useMemo(
    () => ({
      delegations,
      createDelegation,
      revokeDelegation,
      executeDelegatedFunction,
      isDelegatedFunction,
      getActiveDelegations,
    }),
    [delegations],
  );

  return (
    <DelegationContext.Provider value={value}>
      {children}
    </DelegationContext.Provider>
  );
}

export function useDelegation() {
  const context = use(DelegationContext);
  if (context === undefined) {
    throw new Error("useDelegation must be used within a DelegationProvider");
  }
  return context;
}
