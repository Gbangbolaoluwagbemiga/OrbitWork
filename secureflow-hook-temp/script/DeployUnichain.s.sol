// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {EscrowHook} from "../src/EscrowHook.sol";

/// @notice Deploy EscrowHook to Unichain Sepolia Testnet
contract DeployUnichain is Script {
    // Unichain Sepolia Testnet Addresses
    IPoolManager constant POOL_MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);
    
    function run() external {
        // Read EscrowCore address from environment
        address escrowCore = vm.envAddress("ESCROW_CORE");
        require(escrowCore != address(0), "ESCROW_CORE not set in .env");
        
        // Get deployer private key
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        // Hook permissions: beforeAddLiquidity + beforeRemoveLiquidity
        uint160 flags = uint160(
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
        );

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(POOL_MANAGER, escrowCore);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(EscrowHook).creationCode, constructorArgs);

        console.log("==== Unichain Deployment ====");
        console.log("Network: Unichain Sepolia Testnet");
        console.log("PoolManager:", address(POOL_MANAGER));
        console.log("EscrowCore:", escrowCore);
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("");
        console.log("Mining hook address with flags:", flags);
        console.log("Target hook address:", hookAddress);
        console.log("Salt:", vm.toString(salt));
        console.log("");

        // Deploy the hook using CREATE2
        vm.startBroadcast(deployerPrivateKey);
        EscrowHook escrowHook = new EscrowHook{salt: salt}(POOL_MANAGER, escrowCore);
        vm.stopBroadcast();

        require(address(escrowHook) == hookAddress, "Hook Address Mismatch");
        
        console.log("==== Deployment Successful! ====");
        console.log("EscrowHook deployed at:", address(escrowHook));
        console.log("");
        console.log("Next steps:");
        console.log("1. Verify contract:");
        console.log("   forge verify-contract", address(escrowHook), "EscrowHook --chain-id 1301");
        console.log("2. Create pool with this hook");
        console.log("3. Test liquid escrow flow");
    }
}
