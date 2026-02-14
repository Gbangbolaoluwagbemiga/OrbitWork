// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {OrbitWork} from "../src/core/OrbitWork.sol";

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
        manager.unlock(abi.encode(CallbackData(key, params, msg.sender)));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        CallbackData memory cb = abi.decode(data, (CallbackData));
        (BalanceDelta delta) = manager.swap(cb.key, cb.params, "");
        
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
    address constant USDC = 0x8f22D60F408DBA32ba2D4123aD0aE6D3c0b1d28B; 
    address constant HOOK = 0x11859719753C0a0d22790ee3C392d0EFB7Fe4a40;
    address constant ORBIT_WORK = 0xEe8a174c6fabDEb52a5d75e8e3F951EFbC667fDB;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Define Key
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

        // 0. Initialize Pool if needed
        try MANAGER.initialize(key, 79228162514264337593543950336) {
            console.log("Pool Initialized by Swap Script");
        } catch {
            console.log("Pool already initialized");
        }

        // 1. Create Escrow to add liquidity
        IERC20(USDC).approve(ORBIT_WORK, type(uint256).max);
        
        // Authorize Arbiter
        OrbitWork(payable(ORBIT_WORK)).authorizeArbiter(deployer);
        
        address[] memory arbiters = new address[](1);
        arbiters[0] = deployer;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100 * 1e18; // 100 USDC Liquidity
        string[] memory descriptions = new string[](1);
        descriptions[0] = "Milestone 1";

        // Create Escrow
        // Note: EscrowHook adds liquidity here using the deposited tokens.
        try OrbitWork(payable(ORBIT_WORK)).createEscrow(
            address(0x1234), 
            arbiters, 
            1, 
            amounts, 
            descriptions, 
            USDC, 
            30 days, 
            "Test Escrow", 
            "Desc"
        ) {
            console.log("Escrow Created and Liquidity Added");
        } catch Error(string memory reason) {
            console.log("Escrow Creation Failed:", reason);
        } catch {
             console.log("Escrow Creation Failed (Unknown)");
        }

        // 2. Deploy Swapper
        RobustSwapper swapper = new RobustSwapper(MANAGER);
        IERC20(USDC).approve(address(swapper), type(uint256).max);
        
        // 3. Swap
        bool zeroForOne = (USDC == token0); 
        console.log("Swapping 10 USDC for ETH...");
        
        IPoolManager.SwapParams memory params = IPoolManager.SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: -10 * 1e18, 
            sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        });
        
        try swapper.swap(key, params) {
            console.log("Swap Complete!");
        } catch Error(string memory reason) {
            console.log("Swap Failed:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("Swap Failed (Bytes)");
            // Cannot easily decode bytes here in script without helper
        }
        
        vm.stopBroadcast();
    }
}
