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
      // Clear cached balance to force fresh fetch
      localStorage.removeItem(`casper_balance_${address}`);
      
      // Force refresh from wallet/RPC
      const bal = await getCasperBalance(address, true);
      
      // Always update with fresh balance
      if (bal && bal !== "0") {
        setBalance(bal);
        console.log("✅ Balance refreshed:", bal, "CSPR");
      } else if (bal === "0") {
        // If we get 0, it might be a network issue, but update anyway
        setBalance(bal);
        console.warn("⚠️ Balance refresh returned 0 - network may be down");
      }
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
      getCasperBalance(savedAddress, true).then(bal => {
        // Always update with fresh balance if we get one
        if (bal && bal !== "0") {
          setBalance(bal);
          console.log("✅ Updated balance from network:", bal, "CSPR");
        } else if (bal === "0" && cachedBalance) {
          // Only keep cached if fresh fetch returns 0 (might be network issue)
          console.warn("⚠️ Fresh balance fetch returned 0, keeping cached:", cachedBalance);
        }
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
