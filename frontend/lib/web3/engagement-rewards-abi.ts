export const ENGAGEMENT_REWARDS_ABI = [
  {
    inputs: [
      { internalType: "address", name: "", type: "address" },
      { internalType: "address", name: "", type: "address" },
    ],
    name: "userRegistrations",
    outputs: [
      { internalType: "uint32", name: "isRegistered", type: "uint32" },
      { internalType: "uint32", name: "lastClaimTimestamp", type: "uint32" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
