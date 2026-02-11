"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWeb3 } from "@/contexts/web3-context";
import { useAppKit, useAppKitAccount } from "@reown/appkit/react";
import { useState, useEffect } from "react";
import { AlertCircle, RefreshCcw, LogOut, Wallet } from "lucide-react";
import { NetworkSetupDialog } from "@/components/network-setup-dialog";

export function WalletButton() {
  const { wallet, switchToUnichain } = useWeb3();
  const { open } = useAppKit();
  const { isConnected: appKitConnected } = useAppKitAccount();
  const [networkIconError, setNetworkIconError] = useState(false);
  const [walletIconError, setWalletIconError] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [showNetworkDialog, setShowNetworkDialog] = useState(false);
  const [hasCheckedNetwork, setHasCheckedNetwork] = useState(false);

  // Show network dialog when wallet is connected but on wrong network
  useEffect(() => {
    if (wallet.address && !wallet.isConnected && !hasCheckedNetwork) {
      // User is connected but on wrong network - show helpful message
      // They can click the button to add network if needed
      setHasCheckedNetwork(true);
    }
  }, [wallet.address, wallet.isConnected, hasCheckedNetwork]);

  const handleClick = async () => {
    // Prevent multiple simultaneous connection attempts
    if (isOpening || appKitConnected) {
      return;
    }

    setIsOpening(true);
    try {
      await open?.();
    } catch (error: any) {
      console.error("Failed to open AppKit:", error);

      // Check if error is related to network
      const errorMessage = error.message?.toLowerCase() || "";
      if (errorMessage.includes("network") || errorMessage.includes("chain")) {
        setShowNetworkDialog(true);
      }
    } finally {
      // Reset after a delay to allow AppKit modal to open
      setTimeout(() => setIsOpening(false), 1000);
    }
  };

  // If we have an address but are on the wrong network, show options
  if (wallet.address && !wallet.isConnected) {
    return (
      <>
        <Button
          onClick={() => setShowNetworkDialog(true)}
          variant="default"
          className="mr-2"
        >
          Add Unichain Network
        </Button>
        <Button onClick={switchToUnichain} variant="outline">
          Switch to Unichain
        </Button>
        <NetworkSetupDialog
          open={showNetworkDialog}
          onOpenChange={setShowNetworkDialog}
        />
      </>
    );
  }

  if (!wallet.isConnected || !wallet.address) {
    return (
      <>
        <Button onClick={handleClick} variant="default">
          Connect Wallet
        </Button>
        <NetworkSetupDialog
          open={showNetworkDialog}
          onOpenChange={setShowNetworkDialog}
        />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className="font-mono flex items-center gap-2 px-3 md:px-4 py-2 bg-muted/50 hover:bg-muted/70 border border-border/40 max-w-[160px] md:max-w-none"
        >
          {/* Desktop/tablet: show network + balance + avatar */}
          <div className="hidden md:flex items-center gap-2">
            {/* Uniswap-themed network icon */}
            <div className="w-4 h-4 rounded-full overflow-hidden">
              <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
            </div>

            <span>{Number(wallet.balance).toFixed(3)} ETH</span>
            <span className="text-muted-foreground">·</span>

            {/* Dynamic wallet avatar (Effigy gradient orb) */}
            <div className="w-4 h-4 rounded-full overflow-hidden">
              {!walletIconError ? (
                <img
                  src={`https://effigy.im/a/${wallet.address}.svg`}
                  alt="Wallet"
                  className="w-full h-full object-cover"
                  onError={() => setWalletIconError(true)}
                />
              ) : (
                <div className="w-full h-full bg-linear-to-br from-blue-400 to-blue-600 rounded-full"></div>
              )}
            </div>
          </div>

          {/* Mobile: show network icon + balance */}
          <div className="flex md:hidden items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full overflow-hidden flex-shrink-0">
              <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            </div>
            <span className="text-xs">{Number(wallet.balance).toFixed(3)}</span>
            <span className="text-xs text-muted-foreground">ETH</span>
          </div>

          {/* Always show just the address on mobile; also show on desktop after icons */}
          <span className="truncate md:ml-1" title={wallet.address}>
            {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            window.location.reload();
          }}
          className="cursor-pointer"
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          <span>Refresh Balance</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => open?.()}
          className="cursor-pointer"
        >
          <Wallet className="mr-2 h-4 w-4" />
          <span>Wallet Details</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            open?.({ view: 'Account' });
          }}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
