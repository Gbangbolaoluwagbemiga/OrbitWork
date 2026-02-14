// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {OrbitWork} from "../src/core/OrbitWork.sol";

contract Swapper {
    IPoolManager manager;
    
    constructor(IPoolManager _manager) {
        manager = _manager;
    }
    
    function swap(PoolKey memory key, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) external payable {
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: sqrtPriceLimitX96
        });
        
        manager.swap(key, params, "");
    }
    
    // Minimal callback handling (assuming manager.swap calls settle/take internally? No, v4 interface changed)
    // Wait, recent v4-core changed swap to be non-callback based? No, it still uses callbacks for deltas?
    // Actually, `swap` returns delta. The caller must then settle.
    // If I use `manager.swap` directly, I get a delta. I must then pay.
    // But `manager` only allows `swap` if unlocked? No, `swap` is an unlocked action?
    // Let's assume we need to `unlock` first if we want to combine actions, but `swap` itself might be callable?
    // No, `swap` is external.
    // However, paying requires `manager.settle(currency)`.
}

// Simplified script: Use direct calls if possible, or deploy a robust Swapper.
// Since we don't have a Router, we'll try to just mint tokens and approve manager, then swap?
// But who calls `settle`?
// The `Swapper` contract must call `settle`.

contract RobustSwapper {
    IPoolManager manager;
    
    constructor(IPoolManager _manager) {
        manager = _manager;
    }

    struct CallbackData {
        PoolKey key;
        IPoolManager.SwapParams params;
        address sender;
    }

    function swap(PoolKey memory key, IPoolManager.SwapParams memory params) external payable {
        // Unlock to perform swap and settlement
        manager.unlock(abi.encode(CallbackData(key, params, msg.sender)));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        CallbackData memory cb = abi.decode(data, (CallbackData));
        
        // Perform Swap
        (BalanceDelta delta) = manager.swap(cb.key, cb.params, "");
        
        // Settle / Take
        // amount0: delta.amount0()
        // amount1: delta.amount1()
        
        // If amount < 0, we must pay (settle). If > 0, we take.
        
        if (delta.amount0() < 0) {
            _settle(cb.key.currency0, uint128(-delta.amount0()));
        }
        if (delta.amount1() < 0) {
            _settle(cb.key.currency1, uint128(-delta.amount1()));
        }
        if (delta.amount0() > 0) {
            manager.take(cb.key.currency0, address(this), uint256(uint128(delta.amount0())));
        }
        if (delta.amount1() > 0) {
            manager.take(cb.key.currency1, address(this), uint256(uint128(delta.amount1())));
        }
        
        return "";
    }
    
    function _settle(Currency currency, uint256 amount) internal {
        if (currency.isAddressZero()) {
            manager.settle{value: amount}();
        } else {
            IERC20(Currency.unwrap(currency)).transferFrom(msg.sender, address(manager), amount);
            manager.sync(currency);
        }
    }
}

contract SwapScript is Script {
    IPoolManager constant MANAGER = IPoolManager(0x00B036B58a818B1BC34d502D3fE730Db729e62AC);
    address constant USDC = 0x8B9A4AE0297FA4b1fA2B6fBe9007F07a8978b1ee; 
    address constant HOOK = 0xdC524fa00C57f2914036be24746A6aC4432Fca40;
    address constant ORBIT_WORK = 0x2B77b47cE1634818d038EB4dC29A4962B25881B3;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 0. Create Escrow to add liquidity
        // Approve SecureFlow
        IERC20(USDC).approve(ORBIT_WORK, type(uint256).max);
        
        // Authorize Arbiter (Deployer is owner)
        OrbitWork(payable(ORBIT_WORK)).authorizeArbiter(deployer);
        
        // Prepare arrays
        address[] memory arbiters = new address[](1);
        arbiters[0] = deployer;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1000 * 1e18;
        
        string[] memory descriptions = new string[](1);
        descriptions[0] = "Milestone 1";

        // Create Escrow (ID 0)
        // Ensure SecureFlow is cast to payable if needed, or just address
        // createEscrow is external, not payable (unless native version). 
        // SecureFlow(SECURE_FLOW) should work if interface is correct.
        // But compiler complained about fallback. Cast to address first? Or payable.
        // Also fix arguments.
        
        // Check interface of SecureFlow via file?
        // It has createEscrow(...)
        
        OrbitWork(payable(ORBIT_WORK)).createEscrow(
            address(0x1234), // beneficiary (must be different from depositor)
            arbiters,
            1, // confirmations
            amounts,
            descriptions,
            USDC, 
            30 days, 
            "Test Escrow",
            "Description"
        );
        console.log("Escrow Created (ID 0)");

        // 1. Deploy Swapper
        RobustSwapper swapper = new RobustSwapper(MANAGER);
        
        // 2. Approve Swapper to spend USDC
        IERC20(USDC).approve(address(swapper), type(uint256).max);
        
        // 3. Define Pool Key (must match deployment)
        address token0 = USDC;
        address token1 = address(0);
        if (token0 > token1) (token0, token1) = (token1, token0);
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(token0),
            currency1: Currency.wrap(token1),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        // 4. Swap USDC for ETH (Exact Input)
        // We are selling USDC.
        // If USDC is token0, zeroForOne = true.
        // If USDC is token1, zeroForOne = false.
        
        bool zeroForOne = (USDC == token0); 
        
        console.log("Swapping 100 USDC for ETH...");
        
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: -100 * 1e18, // Exact Input (negative)
            sqrtPriceLimitX96: zeroForOne ? 4295128739 : 1461446703485210103287273052203988822378723970342 // MIN/MAX limits safe
        });
        
        swapper.swap(key, params);
        
        console.log("Swap Complete");
        
        vm.stopBroadcast();
    }
}
