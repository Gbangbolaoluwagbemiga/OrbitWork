import { useState, useEffect, useCallback } from "react";
import { useCasper } from "@/contexts/casper-context";

export function useJobCreatorStatus() {
  const { isConnected, address } = useCasper();
  const [isJobCreator, setIsJobCreator] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkJobCreatorStatus = useCallback(async () => {
    if (!isConnected || !address) {
      setIsJobCreator(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setIsJobCreator(false);
    } catch (error) {
      setIsJobCreator(false);
    } finally {
      setLoading(false);
    }
  }, [isConnected, address]);

  useEffect(() => {
    checkJobCreatorStatus();
  }, [checkJobCreatorStatus]);

  return { isJobCreator, loading };
}
