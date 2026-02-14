// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {EscrowHook} from "../src/EscrowHook.sol";
import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

contract TestHook is Script {
    IPoolManager constant POOL_MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);
    address constant ORBIT_WORK = 0xEe8a174c6fabDEb52a5d75e8e3F951EFbC667fDB;

    function run() external {
        // Deploy Hook
        EscrowHook hook = new EscrowHook(POOL_MANAGER, ORBIT_WORK);
        
        console.log("Hook Deployed at:", address(hook));
        
        // Prepare Mock Data
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(address(1)),
            fee: 3000,
            tickSpacing: 60,
            hooks: BaseHook(address(hook))
        });
        
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: true,
            amountSpecified: 100,
            sqrtPriceLimitX96: 0
        });
        
        BalanceDelta delta = BalanceDelta.wrap(0);
        
        console.log("Calling afterSwap...");
        
        // We must prune to address(POOL_MANAGER) for onlyPoolManager modifier?
        // Wait, BaseHook.afterSwap has onlyPoolManager.
        // So we must prank.
        
        vm.prank(address(POOL_MANAGER));
        try hook.afterSwap(
            msg.sender,
            key,
            params,
            delta,
            ""
        ) returns (bytes4 selector, int128) {
            console.log("Success!");
            console.logBytes4(selector);
        } catch Error(string memory reason) {
            console.log("Revert Reason:", reason);
        } catch (bytes memory data) {
            console.log("Revert Bytes:");
            console.logBytes(data);
            if (bytes4(data) == 0x9e4d7cc7) {
                console.log("Error: HookNotImplemented");
            }
        }
    }
}
