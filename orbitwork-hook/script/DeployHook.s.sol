// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {EscrowHook} from "../src/EscrowHook.sol";
import {OrbitWork} from "../src/core/OrbitWork.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

contract DeployHook is Script {
    IPoolManager constant POOL_MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);
    address constant ORBIT_WORK = 0xEe8a174c6fabDEb52a5d75e8e3F951EFbC667fDB; 
    address constant USDC = 0x8f22D60F408DBA32ba2D4123aD0aE6D3c0b1d28B;
    
    // Standard Forge Deterministic Deployer (Fixed Checksum)
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("==== Deploying EscrowHook with CREATE2 Proxy Mining ====");
        console.log("EOA Deployer:", deployer);
        console.log("CREATE2 Proxy:", CREATE2_DEPLOYER);
        
        vm.startBroadcast(deployerPrivateKey);

        uint160 flags = uint160(
            Hooks.BEFORE_ADD_LIQUIDITY_FLAG | 
            Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG | 
            Hooks.AFTER_SWAP_FLAG
        );
        
        console.log("Mining for flags:", flags);
        
        // Use the Proxy address for mining calculation
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER, 
            flags, 
            type(EscrowHook).creationCode, 
            abi.encode(POOL_MANAGER, ORBIT_WORK)
        );
        
        console.log("Mined Salt:", vm.toString(salt));
        console.log("Expected Address:", hookAddress);
        
        EscrowHook escrowHook = new EscrowHook{salt: salt}(POOL_MANAGER, ORBIT_WORK);
        
        console.log("Actual Address:", address(escrowHook));
        
        require(address(escrowHook) == hookAddress, "Hook Address Mismatch");
        console.log("EscrowHook deployed successfully at:", address(escrowHook));
        
        // Link to OrbitWork
        OrbitWork(payable(ORBIT_WORK)).setEscrowHook(address(escrowHook));
        console.log("Linked Hook to OrbitWork");
        
        // Initialize Pool
        address token0 = USDC;
        address token1 = address(0);
        if (token0 > token1) (token0, token1) = (token1, token0);
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(escrowHook))
        });
        
        // SQRT_RATIO_1_1
        uint160 sqrtPriceX96 = 79228162514264337593543950336;
        
        try POOL_MANAGER.initialize(key, sqrtPriceX96) {
            console.log("Pool Initialized");
        } catch {
            console.log("Pool already initialized");
        }
        
        vm.stopBroadcast();
    }
}
