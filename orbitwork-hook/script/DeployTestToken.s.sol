// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {TestToken} from "../src/TestToken.sol";
import "forge-std/console.sol";

contract DeployTestToken is Script {
    function run() external returns (TestToken) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        TestToken token = new TestToken();
        
        console.log("TestToken deployed to:", address(token));
        console.log("Initial supply:", token.totalSupply() / 10**token.decimals());
        console.log("Deployer balance:", token.balanceOf(msg.sender) / 10**token.decimals());
        
        vm.stopBroadcast();
        
        return token;
    }
}
