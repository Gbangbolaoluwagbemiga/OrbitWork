import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCasper } from "@/contexts/casper-context";
import { Copy, LogOut, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function WalletButton() {
  const { address, isConnected, balance, connect, disconnect, refreshBalance } = useCasper();
  const { toast } = useToast();

  const handleConnect = () => {
    void connect();
  };

  const handleDisconnect = () => {
    disconnect();
  };

  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard",
      });
    }
  };

  const handleRefreshBalance = async () => {
    if (refreshBalance) {
      await refreshBalance();
      toast({
        title: "Balance refreshed",
        description: "Wallet balance has been updated",
      });
    }
  };

  if (!isConnected || !address) {
    return (
      <Button
        onClick={() => {
          void handleConnect();
        }}
        variant="default"
      >
        Connect Casper Wallet
      </Button>
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
            {/* CSPR icon placeholder */}
            <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center bg-red-500">
               <span className="text-[10px] text-white font-bold">C</span>
            </div>

            <span>{Number(balance || 0).toFixed(4)} CSPR</span>
            <span className="text-muted-foreground">·</span>

            {/* Address */}
            <span className="truncate max-w-[100px]">
              {address.slice(0, 5)}...{address.slice(-5)}
            </span>
          </div>

          {/* Mobile: just show address */}
          <div className="md:hidden flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="truncate max-w-[80px]">
              {address.slice(0, 4)}...
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground flex items-center justify-between">
          <span>My Wallet</span>
          <div className="flex items-center gap-1">
             <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
               Testnet
             </span>
          </div>
        </div>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleCopyAddress} className="cursor-pointer">
          <Copy className="mr-2 h-4 w-4" />
          <span>Copy Address</span>
        </DropdownMenuItem>
        
        <DropdownMenuItem onClick={handleRefreshBalance} className="cursor-pointer">
          <RefreshCw className="mr-2 h-4 w-4" />
          <span>Refresh Balance</span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={handleDisconnect}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
