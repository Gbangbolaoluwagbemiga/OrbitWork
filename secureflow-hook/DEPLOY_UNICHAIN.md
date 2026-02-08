# Unichain Deployment Guide

## Prerequisites

Before deploying to Unichain testnet, ensure you have:

1. **Wallet Setup**
   - Private key with testnet ETH
   - Add Unichain Sepolia to your wallet:
     - Network Name: Unichain Sepolia
     - RPC URL: https://sepolia.unichain.org  
     - Chain ID: 1301
     - Block Explorer: https://sepolia.uniscan.xyz

2. **Get Testnet ETH**
   - Use the Unichain faucet: https://faucet.unichain.org
   - Or bridge from Ethereum Sepolia

3. **Deploy EscrowCore First**
   - Your existing SecureFlow contracts must be deployed
   - Note the `EscrowCore` contract address

---

## Step 1: Environment Configuration

Create `.env` file in `secureflow-hook/` directory:

```bash
# Copy the example
cp .env.unichain.example .env

# Edit with your values
PRIVATE_KEY=your_private_key_here
ESCROW_CORE=0xYourEscrowCoreAddress
```

**⚠️ Never commit `.env` to git!**

---

## Step 2: Deploy EscrowHook

```bash
cd secureflow-hook

# Deploy to Unichain Sepolia
forge script script/DeployUnichain.s.sol \
  --rpc-url https://sepolia.unichain.org \
  --broadcast \
  --verify \
  -vvvv
```

**Expected Output:**
```
==== Unichain Deployment ====
Network: Unichain Sepolia Testnet
PoolManager: 0x00b036b58a818b1bc34d502d3fe730db729e62ac
EscrowCore: 0xYourAddress
Deployer: 0xYourWallet

Mining hook address with flags: 24576
Target hook address: 0x...
Salt: 0x...

==== Deployment Successful! ====
EscrowHook deployed at: 0x...
```

**Save the hook address!** You'll need it for creating pools.

---

## Step 3: Verify Contract (if auto-verify fails)

```bash
forge verify-contract \
  YOUR_HOOK_ADDRESS \
  src/EscrowHook.sol:EscrowHook \
  --chain-id 1301 \
  --constructor-args $(cast abi-encode "constructor(address,address)" 0x00b036b58a818b1bc34d502d3fe730db729e62ac YOUR_ESCROW_CORE) \
  --etherscan-api-key YOUR_API_KEY
```

---

## Step 4: Create Pool (Coming Next)

After hook deployment, you need to:

1. **Get Test Tokens** - Deploy mock USDC/USDT or use existing testnet tokens
2. **Initialize Pool** - Create a pool with your hook attached
3. **Add Initial Liquidity** - Bootstrap the pool

We'll create this script next!

---

## Troubleshooting

### "Insufficient funds"
- Make sure you have testnet ETH from the faucet
- Check balance: `cast balance YOUR_ADDRESS --rpc-url https://sepolia.unichain.org`

### "Hook address mismatch"
- The deployment will mine the correct salt automatically
- If it fails, try again - salt mining is deterministic

### "ESCROW_CORE not set"
- Make sure your `.env` file exists and has `ESCROW_CORE=0x...`
- Double-check the address is correct

### "Invalid hook permissions"
- Our hook uses:
  - `BEFORE_ADD_LIQUIDITY_FLAG` (8192)
  - `BEFORE_REMOVE_LIQUIDITY_FLAG` (16384)
  - Combined flags value: 24576

---

## Deployment Checklist

- [ ] Testnet ETH acquired
- [ ] `.env` file created with `PRIVATE_KEY` and `ESCROW_CORE`
- [ ] Run deployment script
- [ ] Save hook address
- [ ] Verify contract on explorer
- [ ] Ready for pool creation!

---

## Network Information

### Unichain Sepolia Testnet

| Item | Value |
|------|-------|
| RPC URL | https://sepolia.unichain.org |
| Chain ID | 1301 |
| Block Explorer | https://sepolia.uniscan.xyz |
| PoolManager | 0x00b036b58a818b1bc34d502d3fe730db729e62ac |
| Faucet | https://faucet.unichain.org |

### Uniswap v4 Contracts

| Contract | Address |
|----------|---------|
| PoolManager | 0x00b036b58a818b1bc34d502d3fe730db729e62ac |
| PositionManager | 0x4529a01c7a0410167c5740c487a8de60232617bf |
| Quoter | 0x333e3c607b141b18ff6de9f258db6e77fe7491e0 |

---

## Next Steps After Deployment

1. **Create Test Pool** with your hook
2. **Test Liquid Escrow** end-to-end
3. **Measure Yield** from LP fees
4. **Record Demo** showing the flow
5. **Submit to Hookathon** 🏆
