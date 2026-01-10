/**
 * Admin hooks for contract administration
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useCasper } from "@/contexts/casper-context";
import { signDeploy, sendDeploy } from "@/lib/casper/casper-wallet";
import { pauseJobCreationDeploy, unpauseJobCreationDeploy } from "@/lib/casper/contracts";

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
         return await sendDeploy(signedDeploy);
      }
      
      throw new Error("Wallet not connected");
    },
    onSuccess: (txHash) => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({
        title: "Job creation paused",
        description: `Transaction confirmed: ${txHash?.slice(0, 8)}...`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to pause job creation",
        variant: "destructive",
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
         return await sendDeploy(signedDeploy);
      }

      throw new Error("Wallet not connected");
    },
    onSuccess: (txHash) => {
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      toast({
        title: "Job creation unpaused",
        description: `Transaction confirmed: ${txHash?.slice(0, 8)}...`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unpause job creation",
        variant: "destructive",
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
