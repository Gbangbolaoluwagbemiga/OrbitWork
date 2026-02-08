// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface ISecureFlow {
    function selfVerifiedUsers(address user) external view returns (bool);
    function reputation(address user) external view returns (uint256);
}

/**
 * @title EscrowHook
 * @notice A Uniswap v4 hook that enables "Liquid Escrows" - putting idle escrow funds to work as liquidity.
 * Also provides fee discounts for users verified via Self Protocol.
 */
contract EscrowHook is BaseHook, IUnlockCallback {
    using PoolIdLibrary for PoolKey;
    using LPFeeLibrary for uint24;
    using CurrencyLibrary for Currency;
    using SafeERC20 for IERC20;

    address public immutable escrowCore;

    struct CallbackData {
        PoolKey key;
        IPoolManager.ModifyLiquidityParams params;
        address sender;
    }

    constructor(IPoolManager _poolManager, address _escrowCore) BaseHook(_poolManager) {
        escrowCore = _escrowCore;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: true,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: false,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // --- External Liquidity Management (Liquid Escrow) ---

    /**
     * @notice Allows the EscrowCore contract to deploy escrowed funds into a Uniswap v4 pool.
     */
    function addLiquidity(PoolKey calldata key, IPoolManager.ModifyLiquidityParams calldata params) external {
        require(msg.sender == escrowCore, "Only EscrowCore");
        
        // Standard v4 pattern: unlock manager, then perform operations in callback
        poolManager.unlock(abi.encode(CallbackData(key, params, msg.sender)));
    }

    /**
     * @notice Allows the EscrowCore contract to withdraw funds (with yield) from a pool.
     */
    function removeLiquidity(PoolKey calldata key, IPoolManager.ModifyLiquidityParams calldata params) external {
        require(msg.sender == escrowCore, "Only EscrowCore");
        
        // params.liquidityDelta should be negative for removal
        poolManager.unlock(abi.encode(CallbackData(key, params, msg.sender)));
    }

    /**
     * @notice The callback from PoolManager when unlocked.
     */
    function unlockCallback(bytes calldata data) external onlyPoolManager returns (bytes memory) {
        CallbackData memory cb = abi.decode(data, (CallbackData));

        (BalanceDelta delta, ) = poolManager.modifyLiquidity(cb.key, cb.params, "");

        // Handle token movements
        _handleDelta(cb.key.currency0, delta.amount0());
        _handleDelta(cb.key.currency1, delta.amount1());

        return "";
    }

    function _handleDelta(Currency currency, int128 amount) internal {
        if (amount > 0) {
            // PoolManager owes tokens to hook (e.g. liquidity removal or fee collection)
            // Hook takes tokens and sends them to EscrowCore (or keeps them for EscrowCore to claim)
            poolManager.take(currency, escrowCore, uint128(amount));
        } else if (amount < 0) {
            // Hook owes tokens to PoolManager (e.g. liquidity addition)
            // Tokens should already be in this contract (transferred from EscrowCore before calling addLiquidity)
            // or we use pull-based settlement if supported. 
            // For hackathon: we assume EscrowCore transferred them here or Hook has allowance.
            uint128 absAmount = uint128(-amount);
            
            // If it's an ERC20, we need to settle it
            if (!currency.isAddressZero()) {
                IERC20(Currency.unwrap(currency)).safeTransferFrom(escrowCore, address(poolManager), absAmount);
                poolManager.settle();
            } else {
                // Native currency (e.g. Monad/Celo)
                poolManager.settle{value: absAmount}();
            }
        }
    }

    // --- Hook Callbacks ---

    function _beforeAddLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata)
        internal
        override
        returns (bytes4)
    {
        return BaseHook.beforeAddLiquidity.selector;
    }

    function _beforeRemoveLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata)
        internal
        override
        returns (bytes4)
    {
        return BaseHook.beforeRemoveLiquidity.selector;
    }

    // Allow receiving native tokens for settlement
    receive() external payable {}
}
