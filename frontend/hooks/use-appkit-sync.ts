"use client";

import { useEffect, useRef } from "react";
import { useAppKit, useAppKitAccount, useAppKitNetwork } from "@reown/appkit/react";
import { useWeb3 } from "@/contexts/web3-context";

export function useAppKitSync() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { chainId } = useAppKitNetwork();
  const { wallet } = useWeb3();
  const prevConnectedRef = useRef(false);

  // Sync AppKit connection state with Web3 context
  useEffect(() => {
    // If AppKit just connected and Web3 context doesn't know about it
    // Don't call eth_requestAccounts here - AppKit already handled the connection
    // Just let the Web3 context's checkConnection pick it up via polling
    if (isConnected && address && !wallet.isConnected) {
      // The Web3 context will detect the connection via its polling mechanism
      // No need to trigger another request that could conflict
    }

    // If AppKit disconnected and Web3 context still thinks we're connected
    if (!isConnected && wallet.isConnected) {
      // The Web3 context polling will catch this, but we can trigger it faster
      if (typeof window !== "undefined" && window.ethereum) {
        (window.ethereum as any).request({ method: "eth_accounts" }).catch(() => {
          // Ignore errors
        });
      }
    }

    prevConnectedRef.current = isConnected;
  }, [isConnected, address, chainId, wallet.isConnected]);

  return { open, address, isConnected };
}
