// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {BaseHook} from "../lib/v4-periphery/src/utils/BaseHook.sol";

contract CheckSelectors is Script {
    function run() external {
        console.log("HookNotImplemented():");
        console.logBytes4(BaseHook.HookNotImplemented.selector);
        
        console.log("PriceLimitOutOfBounds(uint160):");
        console.logBytes4(bytes4(keccak256("PriceLimitOutOfBounds(uint160)")));
    }
}
