#!/bin/bash

# OrbitWork Contract Deployment Script
# This script deploys the OrbitWork contract to the Casper Network

set -e

echo "🚀 OrbitWork Contract Deployment"
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if WASM file exists
WASM_FILE="casper_contracts/secureflow/target/wasm32-unknown-unknown/release/orbitwork.wasm"
if [ ! -f "$WASM_FILE" ]; then
    echo -e "${YELLOW}⚠️  WASM file not found at $WASM_FILE${NC}"
    echo -e "${YELLOW}Attempting to build...${NC}"
    cd casper_contracts/secureflow
    cargo +nightly-2023-06-01 build --release --target wasm32-unknown-unknown -p orbitwork
    cd ../..
    
    if [ ! -f "$WASM_FILE" ]; then
        echo -e "${RED}❌ Build failed or WASM still not found.${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Contract binary found${NC}"
echo ""

# Check for Casper Client
if ! command -v casper-client &> /dev/null; then
    echo -e "${RED}❌ casper-client not found. Please install it first.${NC}"
    echo "Visit: https://docs.casper.network/developers/prerequisites/installing-casper-client/"
    exit 1
fi

# Get chain name (default to casper-test)
CHAIN_NAME=${1:-casper-test}
NODE_ADDRESS=${2:-https://node.testnet.casper.network}

echo -e "${YELLOW}📡 Deploying to: ${CHAIN_NAME} (${NODE_ADDRESS})${NC}"
echo ""

# Check for secret key
SECRET_KEY_PATH="secret_key_sec1.pem"
if [ ! -f "$SECRET_KEY_PATH" ]; then
    echo -e "${YELLOW}⚠️  Secret key not found at $SECRET_KEY_PATH${NC}"
    echo "Please provide the path to your secret key (e.g., /path/to/secret_key.pem):"
    read -p "Secret Key Path: " USER_KEY_PATH
    SECRET_KEY_PATH=$USER_KEY_PATH
fi

if [ ! -f "$SECRET_KEY_PATH" ]; then
    echo -e "${RED}❌ Secret key file not found.${NC}"
    exit 1
fi

echo ""
echo -e "${YELLOW}📦 Deploying contract...${NC}"
echo ""

# Deploy contract
casper-client put-deploy \
    --node-address "$NODE_ADDRESS" \
    --chain-name "$CHAIN_NAME" \
    --secret-key "$SECRET_KEY_PATH" \
    --payment-amount 200000000000 \
    --session-path "$WASM_FILE"

echo ""
echo -e "${GREEN}✅ Deployment transaction sent!${NC}"
echo "Check the explorer for status."
