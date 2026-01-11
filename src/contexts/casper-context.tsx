import {
  createContext,
  use,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { connectCasperWallet, getCasperBalance } from "@/lib/casper/casper-wallet";

interface CasperContextType {
  address: string | null;
  isConnected: boolean;
  balance: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

const CasperContext = createContext<CasperContextType | undefined>(undefined);

export function CasperProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>("0");
  const [isConnected, setIsConnected] = useState(false);

  const refreshBalance = useCallback(async () => {
    if (address) {
      const bal = await getCasperBalance(address);
      // Only update if we got a valid balance (not "0" from an error)
      setBalance(prevBalance => {
        if (bal !== "0" || prevBalance === "0") {
          return bal;
        }
        return prevBalance;
      });
    }
  }, [address]);

  const connect = async () => {
    try {
      const publicKey = await connectCasperWallet();
      if (publicKey) {
        setAddress(publicKey);
        setIsConnected(true);
        
        // Try to load cached balance immediately for better UX
        const cachedBalance = localStorage.getItem(`casper_balance_${publicKey}`);
        if (cachedBalance) {
          setBalance(cachedBalance);
          console.log("Loaded cached balance:", cachedBalance);
        }
        
        // Then fetch fresh balance
        const bal = await getCasperBalance(publicKey);
        setBalance(bal);
        localStorage.setItem("casper_address", publicKey);
      }
    } catch (error) {
      console.error("Error during wallet connection:", error);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setBalance("0");
    setIsConnected(false);
    localStorage.removeItem("casper_address");
  };

  // Auto-connect if previously connected
  useEffect(() => {
    const savedAddress = localStorage.getItem("casper_address");
    if (savedAddress) {
      setAddress(savedAddress);
      setIsConnected(true);
      
      // Load cached balance immediately
      const cachedBalance = localStorage.getItem(`casper_balance_${savedAddress}`);
      if (cachedBalance) {
        setBalance(cachedBalance);
        console.log("✅ Loaded cached balance on startup:", cachedBalance, "CSPR");
      }
      
      // Try to fetch fresh balance, but don't wait for it
      getCasperBalance(savedAddress).then(bal => {
        if (bal !== "0") {
          setBalance(bal);
        }
        // If it's "0" and we have a cached balance, keep the cached one
      }).catch(err => {
        console.warn("Failed to fetch balance on startup, using cached value:", err);
      });
    }
  }, []);

  // Auto-refresh balance every 2 minutes when connected (reduced frequency to avoid error spam)
  useEffect(() => {
    if (!address || !isConnected) return;

    const intervalId = setInterval(() => {
      refreshBalance().catch(err => {
        console.warn("Auto-refresh failed, will retry later:", err);
      });
    }, 120000); // 2 minutes

    return () => clearInterval(intervalId);
  }, [address, isConnected, refreshBalance]);

  return (
    <CasperContext
      value={{
        address,
        isConnected,
        balance,
        connect,
        disconnect,
        refreshBalance,
      }}
    >
      {children}
    </CasperContext>
  );
}

export function useCasper() {
  const context = use(CasperContext);
  if (context === undefined) {
    throw new Error("useCasper must be used within a CasperProvider");
  }
  return context;
}
