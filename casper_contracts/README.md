# SecureFlow - Casper Contracts

This directory contains the port of the SecureFlow smart contracts for the Casper Network.

## Structure

- `secureflow/`: The main contract package.
  - `src/lib.rs`: Contract logic and entry points.
  - `src/data.rs`: Data structures (Escrow, Application) and storage helpers.
  - `src/error.rs`: Error definitions.
  - `src/main.rs`: Contract installer (session code).

## Building

To build the contract:

```bash
make build-contract
```

## Next Steps

1. Install Casper client tools.
2. Deploy the contract to Casper Testnet.
3. Update the frontend to use `casper-js-sdk`.
