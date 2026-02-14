// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {EscrowHook} from "../src/EscrowHook.sol";

contract MineHook is Script {
    IPoolManager constant POOL_MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);
    address constant ORBIT_WORK = 0xEe8a174c6fabDEb52a5d75e8e3F951EFbC667fDB;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Mining salt for EscrowHook...");
        console.log("Deployer:", deployer);
        console.log("OrbitWork:", ORBIT_WORK);

        uint160 flags = uint160(
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG | 
            Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG | 
            Hooks.AFTER_SWAP_FLAG
        );
        
        console.log("Target Flags:", flags); // 2624 -> 0xA40

        (address hookAddress, bytes32 salt) = HookMiner.find(
            deployer, 
            flags, 
            type(EscrowHook).creationCode, 
            abi.encode(address(POOL_MANAGER), ORBIT_WORK)
        );
        
        console.log("Found Salt:", vm.toString(salt));
        console.log("Hook Address:", hookAddress);
    }
}
