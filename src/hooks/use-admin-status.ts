import { useState, useEffect } from "react";
import { useCasper } from "@/contexts/casper-context";
import { useDelegation } from "@/contexts/delegation-context";

export function useAdminStatus() {
  const { address: casperAddress, isConnected: isCasperConnected } = useCasper();
  const { delegations } = useDelegation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [isArbiter, setIsArbiter] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isCasperConnected || !casperAddress) {
      setIsAdmin(false);
      setIsOwner(false);
      setIsArbiter(false);
      return;
    }

    checkAdminStatus();
  }, [
    isCasperConnected,
    casperAddress,
    delegations.length,
  ]);

  const checkAdminStatus = async () => {
    setLoading(true);
    try {
      // Determine active address
      const currentAddress = casperAddress;

      if (!currentAddress) {
        return;
      }

      // 1. Check against environment variable
      const envOwner = import.meta.env.VITE_OWNER_ADDRESS || "";
      
      // Hackathon helper: If no VITE_OWNER_ADDRESS is set, treat the connected Casper account as admin
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
        return;
      }

      // 2. TODO: Implement Casper Contract owner check here
      
    } catch (error) {
      console.error("Error checking admin status:", error);
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, isOwner, isArbiter, loading };
}
