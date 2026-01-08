import { useState } from "react";
import { useCasper } from "@/contexts/casper-context";
import { createEscrowDeploy, CreateEscrowParams } from "@/lib/casper/contracts";
import { Deploy, RpcClient, HttpHandler } from "casper-js-sdk";
import { DEFAULT_NETWORK } from "@/lib/casper/casper-config";
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

      // 2. Convert to JSON for signing
      const deployJson = Deploy.toJSON(deploy);

      // 3. Sign with Casper Wallet extension
      const provider = window.CasperWalletProvider?.() || window.casperlabsHelper;
      if (!provider) throw new Error("Casper Wallet provider not found");

      const signedDeployJson = await provider.sign(JSON.stringify(deployJson), address);
      
      // 4. Parse signed deploy back to object
      // Note: The signature format returned by extension might need handling.
      // Usually extension returns a signed deploy JSON structure.
      
      let signedDeploy: Deploy;
      try {
          const parsed = JSON.parse(signedDeployJson);
          // If the extension returns the full deploy object structure compatible with SDK
          const result = Deploy.fromJSON(parsed);
          if (result instanceof Deploy) {
             signedDeploy = result;
          } else {
             // If it returns a Result type (checking just in case)
             // @ts-ignore
             signedDeploy = result.unwrap ? result.unwrap() : result;
          }
      } catch (e) {
          console.warn("Direct parse failed, trying to handle extension quirk", e);
          // @ts-ignore
          const result = Deploy.fromJSON(JSON.parse(JSON.parse(signedDeployJson)));
           // @ts-ignore
          signedDeploy = result.unwrap ? result.unwrap() : result;
      }

      // 5. Send to network
      const httpHandler = new HttpHandler(DEFAULT_NETWORK.nodeUrl);
      const client = new RpcClient(httpHandler);
      
      const deployHash = await client.putDeploy(signedDeploy);

      toast({
        title: "Deploy Sent",
        description: `Job creation deploy sent! Hash: ${deployHash}`,
      });

      return deployHash;

    } catch (error) {
      console.error("Failed to create escrow:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create escrow",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { createEscrow, isLoading };
}
