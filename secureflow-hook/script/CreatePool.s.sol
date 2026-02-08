// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";

/// @notice Create a Uniswap v4 pool with EscrowHook on Unichain
contract CreatePool is Script {
    using PoolIdLibrary for PoolKey;
    
    // Unichain Sepolia Testnet
    IPoolManager constant POOL_MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);
    
    // Square root price for 1:1 ratio (sqrt(1) * 2^96)
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    
    function run() external {
        // Read from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address hookAddress = vm.envAddress("ESCROW_HOOK");
        address token0 = vm.envAddress("USDC");
        address token1 = vm.envAddress("USDT");
        
        require(hookAddress != address(0), "ESCROW_HOOK not set");
        require(token0 != address(0), "USDC not set");
        require(token1 != address(0), "USDT not set");
        require(token0 < token1, "Token order reversed - token0 must be < token1");
        
        // Create pool key
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 3000, // 0.30% - standard fee
            tickSpacing: 60,
            hooks: IHooks(hookAddress)
        });
        
        console.log("==== Pool Creation ====");
        console.log("Currency0 (USDC):", token0);
        console.log("Currency1 (USDT):", token1);
        console.log("Fee:", key.fee);
        console.log("Hook:", hookAddress);
        console.log("Initial Price: 1:1");
        console.log("");
        
        // Initialize pool
        vm.startBroadcast(deployerPrivateKey);
        POOL_MANAGER.initialize(key, SQRT_PRICE_1_1);
        vm.stopBroadcast();
        
        PoolId poolId = key.toId();
        console.log("==== Pool Created! ====");
        console.log("Pool ID:", vm.toString(PoolId.unwrap(poolId)));
        console.log("");
        console.log("Next steps:");
        console.log("1. Add liquidity to the pool (optional bootstrap)");
        console.log("2. Test escrow creation -> liquidity addition");
        console.log("3. Generate yield by trading");
        console.log("4. Test milestone approval -> liquidity removal");
    }
}
