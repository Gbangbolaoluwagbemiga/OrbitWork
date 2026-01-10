# OrbitWork - Casper Contracts

This directory contains the OrbitWork smart contracts for the Casper Network.

## Structure

- `orbitwork/`: The main contract package.
  - `src/lib.rs`: Contract logic and entry points.
  - `src/data.rs`: Data structures (Escrow, Application) and storage helpers.
  - `src/error.rs`: Error definitions.
  - `src/main.rs`: Contract installer (session code).

## Building

To build the contract:

```bash
cd orbitwork
cargo +nightly-2023-06-01 build --release --target wasm32-unknown-unknown -p orbitwork
```

## Next Steps

1. Install Casper client tools.
2. Deploy the contract to Casper Testnet.
3. Update the frontend to use `casper-js-sdk`.
