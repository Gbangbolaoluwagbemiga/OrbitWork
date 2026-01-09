import { useState, useEffect } from "react";
import { useWeb3 } from "@/hooks/use-web3";
import { useCasper } from "@/contexts/casper-context";
import { useDelegation } from "@/contexts/delegation-context";
import { CONTRACTS } from "@/lib/web3/config";
import { contractService } from "@/lib/web3/contract-service";

export function useAdminStatus() {
  const { wallet, getContract } = useWeb3();
  const { address: casperAddress, isConnected: isCasperConnected } = useCasper();
  const { getActiveDelegations, delegations } = useDelegation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isArbiter, setIsArbiter] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (
      (!wallet.isConnected || !wallet.address) &&
      (!isCasperConnected || !casperAddress)
    ) {
      setIsAdmin(false);
      setIsOwner(false);
      setIsArbiter(false);
      return;
    }

    checkAdminStatus();
  }, [
    wallet.isConnected,
    wallet.address,
    isCasperConnected,
    casperAddress,
    delegations.length,
  ]);

  const checkAdminStatus = async () => {
    setLoading(true);
    try {
      // Determine active address
      const currentAddress =
        isCasperConnected && casperAddress ? casperAddress : wallet.address;

      if (!currentAddress) {
        return;
      }

      // 1. Check against environment variable (Works for both Stellar and Casper)
            const envOwner = import.meta.env.VITE_OWNER_ADDRESS || "";
            
            // Hackathon helper: If no VITE_OWNER_ADDRESS is set, treat the connected Casper account as admin
            // This allows the deployer to immediately see admin pages without configuring .env
            if (!envOwner && isCasperConnected && casperAddress) {
               console.log("No VITE_OWNER_ADDRESS set. Granting Admin access to connected Casper wallet for demo.");
               setIsOwner(true);
               setIsAdmin(true);
               return;
            }

            if (
              envOwner &&
              currentAddress.toLowerCase().trim() === envOwner.toLowerCase().trim()
            ) {
        console.log("Admin access granted via VITE_OWNER_ADDRESS");
        setIsOwner(true);
        setIsAdmin(true);
        // We can return here, or continue to check other roles.
        // For now, if you are owner, you are admin.
        return;
      }

      // 2. If using Stellar, check contract state
      if (wallet.isConnected && wallet.address) {
        // Check if contract address is set
        if (!CONTRACTS.SECUREFLOW_ESCROW) {
          console.warn("SECUREFLOW_ESCROW contract address not set");
          // Don't reset here, as env check might have passed
          return;
        }

        const contract = getContract(CONTRACTS.SECUREFLOW_ESCROW);
        if (!contract) {
          console.warn("Failed to get contract instance");
          return;
        }

        // Get the contract owner
        const owner = await contract.call("owner");
        
        if (owner) {
          const ownerStr = String(owner).toLowerCase().trim();
          const walletStr = currentAddress.toLowerCase().trim();
          
          if (ownerStr === walletStr) {
             setIsOwner(true);
             setIsAdmin(true);
             return;
          }
        }
      }

      // 3. Check arbiter status (Stellar only for now)
      let arbiterCheck = false;
      if (wallet.isConnected && wallet.address) {
         // ... existing arbiter logic
         try {
           arbiterCheck = await contractService.isAuthorizedArbiter(wallet.address);
         } catch(e) { console.error(e); }
      }
      setIsArbiter(arbiterCheck);

      // 4. Delegation check
      const activeDelegations = getActiveDelegations();
      const hasDelegationForUser = activeDelegations.some(
        (d) => d.delegatee.toLowerCase() === currentAddress.toLowerCase()
      );

      setIsAdmin(isOwner || arbiterCheck || hasDelegationForUser);

    } catch (error) {
      console.error("Error checking admin status:", error);
      // Don't forcefully reset if we already found them to be owner via Env
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, isOwner, isArbiter, loading };
}
