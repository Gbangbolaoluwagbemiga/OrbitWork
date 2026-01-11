/**
 * Admin hooks for contract administration
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useCasper } from "@/contexts/casper-context";
import { signDeploy, sendDeploy, checkDeployStatus } from "@/lib/casper/casper-wallet";
import { pauseJobCreationDeploy, unpauseJobCreationDeploy, initContractDeploy } from "@/lib/casper/contracts";
import { Deploy } from "casper-js-sdk";

/**
 * Hook to initialize the contract (must be called by deployer after deployment)
 */
export function useInitContract() {
  const queryClient = useQueryClient();
  const { isConnected: isCasperConnected, address: casperAddress } = useCasper();

  return useMutation({
    mutationFn: async () => {
      if (isCasperConnected && casperAddress) {
        const deploy = initContractDeploy(casperAddress);
        const signedDeploy = await signDeploy(deploy, casperAddress);
        if (!signedDeploy) throw new Error("Failed to sign deploy");

        const deployHash = await sendDeploy(signedDeploy);
        
        // Check if deploy actually succeeded on-chain (with retries)
        const status = await checkDeployStatus(deployHash);
        if (!status.success) {
          throw new Error(`Deploy failed on-chain: ${status.error || 'Unknown error'}`);
        }

        return deployHash;
      }

      throw new Error("Wallet not connected");
    },
    onSuccess: (txHash) => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({
        title: "✅ Contract initialized successfully!",
        description: `Deploy hash: ${txHash?.slice(0, 16)}...${txHash?.slice(-8)}`,
        duration: 5000,
      });
      setTimeout(() => window.location.reload(), 2000);
    },
    onError: (error: Error) => {
      const isOnChainFailure = error.message?.includes("Deploy failed on-chain");
      toast({
        title: isOnChainFailure ? "Transaction Failed on Blockchain" : "Initialization Failed",
        description: error.message || "Failed to initialize contract. Check console for details.",
        variant: "destructive",
        duration: 10000,
      });
    },
  });
}

/**
 * Hook to pause job creation
 */
export function usePauseJobCreation() {
  const queryClient = useQueryClient();
  const { isConnected: isCasperConnected, address: casperAddress } = useCasper();

  return useMutation({
    mutationFn: async () => {
      if (isCasperConnected && casperAddress) {
         // Casper implementation
         const deploy = pauseJobCreationDeploy(casperAddress);
         const signedDeploy = await signDeploy(deploy, casperAddress);
         if (!signedDeploy) throw new Error("Failed to sign deploy");
         
         try {
           const deployHash = await sendDeploy(signedDeploy);
           
           // Check if deploy actually succeeded on-chain (with retries)
           const status = await checkDeployStatus(deployHash);
           if (!status.success) {
             throw new Error(`Deploy failed on-chain: ${status.error || 'Unknown error'}`);
           }
           
           // Only save pause state if deploy actually succeeded
           localStorage.setItem('contractPaused', 'true');
           return deployHash;
         } catch (sendError: any) {
           // If it's a network error, save deploy for manual submission
           if (sendError.message?.includes("Network Error") || sendError.message?.includes("Timeout")) {
             const deployJsonObj = Deploy.toJSON(signedDeploy);
             const deployJson = JSON.stringify(deployJsonObj, null, 2);
             
             // Store in localStorage so user can retrieve it
             localStorage.setItem('lastSignedDeploy', deployJson);
             localStorage.setItem('lastSignedDeployType', 'pause');
             
             console.error("❌ Network submission failed. Deploy saved to localStorage.");
             console.error("📋 Deploy JSON:", deployJson);
           }
           throw sendError;
         }
      }
      
      throw new Error("Wallet not connected");
    },
    onSuccess: (txHash) => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      // Update localStorage immediately (already done in mutationFn, but ensure it's set)
      localStorage.setItem('contractPaused', 'true');
      toast({
        title: "✅ Contract paused successfully!",
        description: `Deploy hash: ${txHash?.slice(0, 16)}...${txHash?.slice(-8)}`,
        duration: 5000,
      });
      // Reload to refresh UI (reduced delay since status check is now faster)
      setTimeout(() => window.location.reload(), 1000);
    },
    onError: (error: Error) => {
      const isOnChainFailure = error.message?.includes("Deploy failed on-chain");
      toast({
        title: isOnChainFailure ? "Transaction Failed on Blockchain" : "Submission Failed",
        description: error.message || "Failed to pause job creation. Check console for details.",
        variant: "destructive",
        duration: 10000,
      });
    },
  });
}

/**
 * Hook to unpause job creation
 */
export function useUnpauseJobCreation() {
  const queryClient = useQueryClient();
  const { isConnected: isCasperConnected, address: casperAddress } = useCasper();

  return useMutation({
    mutationFn: async () => {
      if (isCasperConnected && casperAddress) {
         // Casper implementation
         const deploy = unpauseJobCreationDeploy(casperAddress);
         const signedDeploy = await signDeploy(deploy, casperAddress);
         if (!signedDeploy) throw new Error("Failed to sign deploy");
         
         try {
           const deployHash = await sendDeploy(signedDeploy);
           
           // Check if deploy actually succeeded on-chain (with retries)
           const status = await checkDeployStatus(deployHash);
           if (!status.success) {
             throw new Error(`Deploy failed on-chain: ${status.error || 'Unknown error'}`);
           }
           
           // Only save unpause state if deploy actually succeeded
           localStorage.setItem('contractPaused', 'false');
           return deployHash;
         } catch (sendError: any) {
           // If it's a network error, save deploy for manual submission
           if (sendError.message?.includes("Network Error") || sendError.message?.includes("Timeout")) {
             const deployJsonObj = Deploy.toJSON(signedDeploy);
             const deployJson = JSON.stringify(deployJsonObj, null, 2);
             localStorage.setItem('lastSignedDeploy', deployJson);
             localStorage.setItem('lastSignedDeployType', 'unpause');
             
             console.error("❌ Network submission failed. Deploy saved to localStorage.");
           }
           throw sendError;
         }
      }

      throw new Error("Wallet not connected");
    },
    onSuccess: (txHash) => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      // Update localStorage immediately (already done in mutationFn, but ensure it's set)
      localStorage.setItem('contractPaused', 'false');
      toast({
        title: "✅ Contract unpaused successfully!",
        description: `Deploy hash: ${txHash?.slice(0, 16)}...${txHash?.slice(-8)}`,
        duration: 5000,
      });
      // Reload to refresh UI (reduced delay since status check is now faster)
      setTimeout(() => window.location.reload(), 1000);
    },
    onError: (error: Error) => {
      const isOnChainFailure = error.message?.includes("Deploy failed on-chain");
      toast({
        title: isOnChainFailure ? "Transaction Failed on Blockchain" : "Submission Failed",
        description: error.message || "Failed to unpause job creation. Check console for details.",
        variant: "destructive",
        duration: 10000,
      });
    },
  });
}

/**
 * Hook to set platform fee
 */
export function useSetPlatformFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_feeBP: number) => {
      throw new Error("Not implemented for Casper yet");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({
        title: "Platform fee updated",
        description: "Platform fee has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set platform fee",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to set fee collector
 */
export function useSetFeeCollector() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_feeCollector: string) =>
      { throw new Error("Not implemented for Casper yet"); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({
        title: "Fee collector updated",
        description: "Fee collector has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set fee collector",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to whitelist token
 */
export function useWhitelistToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_token: string) => { throw new Error("Not implemented for Casper yet"); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({
        title: "Token whitelisted",
        description: "Token has been whitelisted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to whitelist token",
        variant: "destructive",
      });
    },
  });
}

/**
 * Hook to authorize arbiter
 */
export function useAuthorizeArbiter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_arbiter: string) => { throw new Error("Not implemented for Casper yet"); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({
        title: "Arbiter authorized",
        description: "Arbiter has been authorized successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to authorize arbiter",
        variant: "destructive",
      });
    },
  });
}
