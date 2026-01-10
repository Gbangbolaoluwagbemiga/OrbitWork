// This file is no longer needed for Casper
// Casper uses Freighter directly via @stellar/freighter-api
// Keeping this file for backward compatibility but it's not used

import React from "react";

export function AppKit({ children }: { children: React.ReactNode }) {
  // Casper doesn't use AppKit, just return children
  return <>{children}</>;
}
