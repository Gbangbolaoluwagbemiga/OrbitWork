// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {OrbitWork} from "../src/core/OrbitWork.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract DeployCore is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("==== Deploying Core Contracts ====");
        console.log("Deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Mock Token (USDC)
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // 2. Deploy OrbitWork (EscrowCore)
        OrbitWork orbitWork = new OrbitWork(address(usdc), deployer, 300);
        console.log("OrbitWork deployed at:", address(orbitWork));
        
        vm.stopBroadcast();
    }
}
