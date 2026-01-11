import { useState } from "react";
import { useCasper } from "@/contexts/casper-context";
import { createEscrowDeploy, CreateEscrowParams } from "@/lib/casper/contracts";
import { Deploy } from "casper-js-sdk";
import { signDeploy, sendDeploy } from "@/lib/casper/casper-wallet";
import { useToast } from "@/hooks/use-toast";

export function useCasperEscrow() {
  const { address, isConnected } = useCasper();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const createEscrow = async (params: CreateEscrowParams) => {
    if (!isConnected || !address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your Casper wallet to post a job.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Create Deploy object
      const deploy = createEscrowDeploy(params, address);

      // 2. Sign with Casper Wallet extension
      const signedDeploy = await signDeploy(deploy, address);
      if (!signedDeploy) {
        throw new Error("Failed to sign deploy");
      }

      // 3. Send to network using improved submission method
      const deployHash = await sendDeploy(signedDeploy);

      toast({
        title: "✅ Escrow Created!",
        description: `Deploy hash: ${deployHash?.slice(0, 16)}...${deployHash?.slice(-8)}`,
        duration: 5000,
      });

      return deployHash;

    } catch (error: any) {
      console.error("Failed to create escrow:", error);
      
      // Save deploy for manual submission if network fails
      if (error.message?.includes("Network Error") || error.message?.includes("Timeout")) {
        try {
          const deploy = createEscrowDeploy(params, address);
          const signedDeploy = await signDeploy(deploy, address);
          if (signedDeploy) {
            const deployJson = JSON.stringify(Deploy.toJSON(signedDeploy), null, 2);
            localStorage.setItem('lastSignedDeploy', deployJson);
            localStorage.setItem('lastSignedDeployType', 'create_escrow');
          }
        } catch (saveError) {
          console.error("Failed to save deploy:", saveError);
        }
      }
      
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create escrow",
        variant: "destructive",
        duration: 10000,
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { createEscrow, isLoading };
}
