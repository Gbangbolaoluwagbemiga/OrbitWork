"use client";

import React from "react";
import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { ethers } from "ethers";

// Get projectId from environment
export const projectId =
  process.env.NEXT_PUBLIC_REOWN_ID || "1db88bda17adf26df9ab7799871788c4";

// Create metadata
// In development, use localhost; in production, use the production URL
export const metadata = {
  name: "Orbitwork",
  description: "Decentralized Freelance Platform Powered by Uniswap v4 Hooks",
  url: typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_APP_URL || "https://secureflow.app",
  icons: ["/secureflow-logo.svg"],
};

// Define networks - Unichain Sepolia only (Uniswap v4 Hooks)
const networks = [
  {
    id: 1301,
    name: "Unichain Sepolia",
    currency: "ETH",
    explorerUrl: "https://sepolia.uniscan.xyz",
    rpcUrl: "https://sepolia.unichain.org",
  },
];

// Create the AppKit instance
createAppKit({
  adapters: [new EthersAdapter()],
  metadata,
  networks: networks as any,
  projectId,
  features: {
    analytics: true,
  },
});

export function AppKit({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
