import {
  createContext,
  use,
  useState,
  useEffect,
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

  const refreshBalance = async () => {
    if (address) {
      const bal = await getCasperBalance(address);
      setBalance(bal);
    }
  };

  const connect = async () => {
    const publicKey = await connectCasperWallet();
    if (publicKey) {
      setAddress(publicKey);
      setIsConnected(true);
      const bal = await getCasperBalance(publicKey);
      setBalance(bal);
      localStorage.setItem("casper_address", publicKey);
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
      getCasperBalance(savedAddress).then(setBalance);
    }
  }, []);

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
