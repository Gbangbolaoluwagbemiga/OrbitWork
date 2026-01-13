import { useState } from "react";
import { useCasper } from "@/contexts/casper-context";
import { applyToJobDeploy, ApplyToJobParams } from "@/lib/casper/contracts";
import { useToast } from "@/hooks/use-toast";

export function useCasperApply() {
  const { address, isConnected } = useCasper();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const applyToJob = async (params: ApplyToJobParams) => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your Casper wallet to apply.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const deploy = applyToJobDeploy(params, address);
      
      // Use the signDeploy function from casper-wallet.ts which handles all wallet quirks
      const { signDeploy, sendDeploy } = await import("@/lib/casper/casper-wallet");
      
      const signedDeploy = await signDeploy(deploy, address);
      if (!signedDeploy) {
        throw new Error("Failed to sign deploy with wallet");
      }
      
      const deployHash = await sendDeploy(signedDeploy);

      toast({
        title: "Application Submitted!",
        description: "The client will review your application.",
      });

      return deployHash;

    } catch (error) {
      console.error("Failed to apply:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to apply",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { applyToJob, isLoading };
}
