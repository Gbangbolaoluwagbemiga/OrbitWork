import { useState } from "react";
import { useCasper } from "@/contexts/casper-context";
import { applyToJobDeploy, ApplyToJobParams } from "@/lib/casper/contracts";
import { Deploy, RpcClient, HttpHandler } from "casper-js-sdk";
import { DEFAULT_NETWORK } from "@/lib/casper/casper-config";
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
      const deployJson = Deploy.toJSON(deploy);

      const provider = window.CasperWalletProvider?.() || window.casperlabsHelper;
      if (!provider) throw new Error("Casper Wallet provider not found");

      const signedDeployJson = await provider.sign(JSON.stringify(deployJson), address);
      
      let signedDeploy: Deploy;
       try {
          const parsed = JSON.parse(signedDeployJson);
          const result = Deploy.fromJSON(parsed);
          if (result instanceof Deploy) {
             signedDeploy = result;
          } else {
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

      const httpHandler = new HttpHandler(DEFAULT_NETWORK.nodeUrl);
      const client = new RpcClient(httpHandler);
      
      const deployHash = await client.putDeploy(signedDeploy);

      toast({
        title: "Application Sent",
        description: `Application deploy sent! Hash: ${deployHash}`,
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
