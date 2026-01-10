# Deploying OrbitWork to Casper Testnet

## Prerequisites
1. Rust and Cargo installed.
2. `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`
3. Casper Client (`casper-client`) installed.

## Build Contract
```bash
cd secureflow
cargo +nightly-2023-06-01 build --release --target wasm32-unknown-unknown -p orbitwork
```

## Deploy
To deploy the contract, you need a funded Casper wallet (secret key).

```bash
casper-client put-deploy \
    --node-address https://node.testnet.casper.network \
    --chain-name casper-test \
    --secret-key /path/to/secret_key_sec1.pem \
    --payment-amount 200000000000 \
    --session-path target/wasm32-unknown-unknown/release/orbitwork.wasm
```

## Get Contract Hash
After deployment, get the deploy hash and check status:
```bash
casper-client get-deploy <DEPLOY_HASH> --node-address https://node.testnet.casper.network
```

Look for `execution_results` -> `Success` -> `effect` -> `transforms`.
Find the `WriteContract` transform. The key will be the `ContractHash`.
Format: `hash-<hex_string>`.

## Update Frontend
Copy the `ContractHash` (e.g., `hash-123...`) and update your frontend configuration.
