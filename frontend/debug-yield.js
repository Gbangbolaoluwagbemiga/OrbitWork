const ethers = require("ethers");

// ABI from the user's file
const ESCROW_HOOK_ABI = [
    {
        inputs: [{ internalType: "uint256", name: "escrowId", type: "uint256" }],
        name: "getEscrowYield",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
    },
];

// Unichain Sepolia Testnet
const RPC_URL = "https://sepolia.unichain.org"; // From config.ts
const HOOK_ADDRESS = "0xdc524fa00c57f2914036be24746a6ac4432fca40";
// From config.ts

async function checkYield() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const hookContract = new ethers.Contract(HOOK_ADDRESS, ESCROW_HOOK_ABI, provider);

    // We need an escrow ID. The user didn't provide one, but let's try a few small integers 
    // as they are likely sequential: 0, 1, 2, ...
    // In the real app, this comes from the component props.

    console.log("Checking yield for first few Escrow IDs...");

    for (let i = 0; i < 5; i++) {
        try {
            console.log(`Checking Escrow ID: ${i}`);

            // Try getEscrowYield
            try {
                const yieldVal = await hookContract.getEscrowYield(i);
                console.log(`  getEscrowYield(${i}): ${yieldVal.toString()} (${ethers.formatUnits(yieldVal, 18)} ETH/Tokens)`);
            } catch (e) {
                console.log(`  getEscrowYield(${i}) failed: ${e.message}`);
            }

        } catch (error) {
            console.error(`Error checking ID ${i}:`, error);
        }
    }
}

checkYield();
