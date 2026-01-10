// This hook is no longer needed for Casper
// Casper uses Freighter directly via @stellar/freighter-api
// Keeping this file for backward compatibility but it's not used

export function useAppKitSync() {
  // Casper doesn't use AppKit, return empty object
  return { open: undefined, address: null, isConnected: false };
}
