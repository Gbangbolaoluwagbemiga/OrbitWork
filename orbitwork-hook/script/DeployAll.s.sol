// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";
import {OrbitWork} from "../src/core/OrbitWork.sol";
import {EscrowHook} from "../src/EscrowHook.sol";

contract DeployAll is Script {
    // Unichain Sepolia Testnet
    // Unichain Sepolia Testnet
    IPoolManager constant POOL_MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);


    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying from:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy OrbitWork (EscrowCore)
        // Args: _monadToken (0x0 for native), _feeCollector, _platformFeeBP (0 = 0%)
        OrbitWork orbitWork = new OrbitWork(address(0), deployer, 0);
        console.log("OrbitWork deployed at:", address(orbitWork));

        // 2. Mine Hook Salt with correct flags
        // Hook flags: beforeAddLiquidity + beforeRemoveLiquidity
        uint160 flags = uint160(
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG | Hooks.AFTER_SWAP_FLAG
        );

        bytes memory hookConstructorArgs = abi.encode(POOL_MANAGER, address(orbitWork));
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_FACTORY, 
            flags, 
            type(EscrowHook).creationCode, 
            hookConstructorArgs
        );

        console.log("Mined Hook Address:", hookAddress);
        console.log("Salt:", vm.toString(salt));

        // 3. Deploy EscrowHook
        EscrowHook hook = new EscrowHook{salt: salt}(POOL_MANAGER, address(orbitWork));
        require(address(hook) == hookAddress, "Hook address mismatch");
        console.log("EscrowHook deployed at:", address(hook));

        // 4. Set Hook in OrbitWork
        orbitWork.setEscrowHook(address(hook));
        console.log("OrbitWork hook set to:", address(hook));

        vm.stopBroadcast();
    }
}
