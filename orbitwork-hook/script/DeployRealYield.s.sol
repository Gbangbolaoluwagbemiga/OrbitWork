// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {EscrowHook} from "../src/EscrowHook.sol";
import {OrbitWork} from "../src/core/OrbitWork.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployRealYield is Script {
    using CurrencyLibrary for Currency;

    // Unichain Sepolia Testnet Addresses
    // Unichain Sepolia Testnet Addresses
    IPoolManager constant POOL_MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("==== Deploying Real Yield System ====");
        console.log("Deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Mock Token (USDC)
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // 2. Deploy OrbitWork (EscrowCore)
        // FeeCollector = Deployer
        // PlatformFee = 3% (300)
        OrbitWork orbitWork = new OrbitWork(address(usdc), deployer, 300);
        console.log("OrbitWork deployed at:", address(orbitWork));

        // 3. Deploy EscrowHook
        // 3. Deploy EscrowHook
        // NOTE: Local Hooks.sol uses low bits (old version), but Unichain Sepolia PoolManager uses HIGH bits (new version).
        // We must manually define flags for high bits:
        // BeforeAddLiquidity: 157
        // BeforeRemoveLiquidity: 155
        // AfterSwap: 152
        // 3. Deploy EscrowHook
        // Manual Mining for 0x29 prefix (High bits 157, 155, 152)
        bytes memory constructorArgs = abi.encode(POOL_MANAGER, address(orbitWork));
        bytes memory initCode = abi.encodePacked(type(EscrowHook).creationCode, constructorArgs);
        bytes32 initCodeHash = keccak256(initCode);
        
        address hookAddress;
        bytes32 salt;
        bool found = false;
        
        console.log("Mining for 0x29 prefix...");
        for (uint256 i = 0; i < 30000; i++) {
            salt = bytes32(i);
            // computeCreate2Address(salt, initCodeHash, deployer)
            hookAddress = vm.computeCreate2Address(salt, initCodeHash, CREATE2_FACTORY);
            
            // Check for 0x24... wait, 0x29 (0010 1001)
            // 2 = 0010 (159=0, 158=0, 157=1, 156=0) -> BeforeAdd (157). Correct.
            // 9 = 1001 (155=1, 154=0, 153=0, 152=1) -> BeforeRemove (155), AfterSwap (152). Correct.
            if (bytes20(hookAddress)[0] == 0x29) {
                found = true;
                break;
            }
        }
        require(found, "Failed to mine 0x29 address");
        console.log("Mined Address:", hookAddress);
        console.log("Salt:", vm.toString(salt));

        EscrowHook escrowHook = new EscrowHook{salt: salt}(POOL_MANAGER, address(orbitWork));
        require(address(escrowHook) == hookAddress, "Hook Address Mismatch");
        console.log("EscrowHook deployed at:", address(escrowHook));

        // 4. Link Hook to Core
        orbitWork.setEscrowHook(address(escrowHook));
        console.log("Linked Hook to Core");

        // 5. Initialize Pool (USDC / Native)
        // Sort tokens
        address token0 = address(usdc);
        address token1 = address(0); // Native is 0
        if (token0 > token1) {
            (token0, token1) = (token1, token0);
        }
        
        Currency currency0 = Currency.wrap(token0);
        Currency currency1 = Currency.wrap(token1);
        
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 3000, // 0.3%
            tickSpacing: 60,
            hooks: IHooks(address(escrowHook))
        });
        
        // Check if pool exists, if not initialize
        // SQRT_RATIO_1_1 = 79228162514264337593543950336
        uint160 sqrtPriceX96 = 79228162514264337593543950336;
        
        // We use try/catch to avoid failure if pool already exists (though with new hook, it shouldn't)
        try POOL_MANAGER.initialize(key, sqrtPriceX96) {
            console.log("Pool Initialized");
        } catch {
            console.log("Pool already initialized (unexpected for new hook)");
        }

        // 6. Add Initial Liquidity (Generic LP - Optional, but useful for baseline)
        // Actually, let's just do a swap to generate fees?
        // But we need liquidity to swap against.
        // Deployer adds liquidity.
        
        // Mint USDC to deployer for LP
        usdc.mint(deployer, 1000000 * 1e18);
        usdc.approve(address(POOL_MANAGER), type(uint256).max);
        
        // Add full range liquidity
        int24 tickLower = (TickMath.MIN_TICK / 60) * 60;
        int24 tickUpper = (TickMath.MAX_TICK / 60) * 60;
        
        // Add 1000 USDC and ~1000 ETH worth (mock)
        // This requires providing ETH.
        
        IPoolManager.ModifyLiquidityParams memory params = IPoolManager.ModifyLiquidityParams({
             tickLower: tickLower,
             tickUpper: tickUpper,
             liquidityDelta: 100 ether, // Just some liquidity
             salt: bytes32(0)
        });
        
        // We need to pass ETH. `modifyLiquidity` is not payable directly?
        // In v4, we use `modifyLiquidity` then settle.
        // Script simplified: just unlock and callback.
        // But doing this in a script without a proper Router/PositionManager is complex.
        // We'll skip adding generic LP for now.
        // The *User* will add liquidity via Escrow.
        
        // Wait, if no liquidity in pool, the EscrowHook might fail to calculate optimal amounts?
        // No, single-sided liquidity works even in empty pool (it initializes tight range around current tick? No, full range).
        // It relies on current tick. Initialized pool has tick corresponding to `sqrtPriceX96`.
        
        vm.stopBroadcast();
        
        console.log("==== Deployment Complete ====");
        console.log("USDC:", address(usdc));
        console.log("OrbitWork:", address(orbitWork));
        console.log("Hook:", address(escrowHook));
    }
}
