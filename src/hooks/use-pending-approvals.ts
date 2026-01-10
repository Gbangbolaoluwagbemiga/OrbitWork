import { useState, useEffect } from "react";
import { useCasper } from "@/contexts/casper-context";

export function usePendingApprovals() {
  const { isConnected, address } = useCasper();
  const [hasPendingApprovals, setHasPendingApprovals] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isConnected || !address) {
      setHasPendingApprovals(false);
      return;
    }

    checkPendingApprovals();
  }, [isConnected, address]);

  const checkPendingApprovals = async () => {
    setLoading(true);
    try {
      setHasPendingApprovals(false);
    } catch (error) {
      setHasPendingApprovals(false);
    } finally {
      setLoading(false);
    }
  };

  return {
    hasPendingApprovals,
    loading,
    refreshApprovals: checkPendingApprovals,
  };
}
