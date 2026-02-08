// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import "../src/mocks/MockUSDC.sol";
import "../src/mocks/MockUSDT.sol";

/// @notice Deploy mock tokens for testing
contract DeployMockTokens is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        console.log("==== Deploying Mock Tokens ====");
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy USDC (lower address should be currency0)
        MockUSDC usdc = new MockUSDC();
        MockUSDT usdt = new MockUSDT();
        
        vm.stopBroadcast();
        
        console.log("==== Tokens Deployed! ====");
        console.log("MockUSDC:", address(usdc));
        console.log("MockUSDT:", address(usdt));
        console.log("");
        
        // Verify ordering for Uniswap v4 (currency0 < currency1)
        if (address(usdc) < address(usdt)) {
            console.log("Token order correct:");
            console.log("  Currency0 (USDC):", address(usdc));
            console.log("  Currency1 (USDT):", address(usdt));
        } else {
            console.log("WARNING: Token order reversed!");
            console.log("  Currency0 (USDT):", address(usdt));
            console.log("  Currency1 (USDC):", address(usdc));
        }
        
        console.log("");
        console.log("Update your .env file:");
        console.log("USDC=", address(usdc));
        console.log("USDT=", address(usdt));
    }
}
