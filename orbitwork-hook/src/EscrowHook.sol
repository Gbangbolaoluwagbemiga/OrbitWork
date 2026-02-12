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

    // === Yield Tracking State ===
    struct LPPosition {
        uint128 liquidity;           // Total liquidity in pool
        uint256 reserveAmount;       // Amount kept as reserve (20%)
        uint256 token0FeeGrowthLast; // Last recorded fee growth for token0
        uint256 token1FeeGrowthLast; // Last recorded fee growth for token1
        uint256 yieldAccumulated;    // Total yield accumulated
        bool isActive;               // Whether position is active
    }

    // escrowId => LP position info
    mapping(uint256 => LPPosition) public escrowPositions;
    
    // Total yield distributed
    uint256 public totalYieldDistributed;
    
    // Yield distribution ratios (basis points)
    uint256 public constant FREELANCER_SHARE = 7000; // 70%
    uint256 public constant PLATFORM_SHARE = 3000;   // 30%
    uint256 public constant LP_RATIO = 8000;         // 80% to LP
    uint256 public constant RESERVE_RATIO = 2000;    // 20% reserve

    // Events
    event LiquidityAdded(uint256 indexed escrowId, uint128 liquidity, uint256 reserveAmount);
    event YieldAccumulated(uint256 indexed escrowId, uint256 amount);
    event YieldDistributed(uint256 indexed escrowId, address freelancer, uint256 freelancerAmount, uint256 platformAmount);

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
            afterSwap: true,  // Enable to track fees
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

    // === Escrow Integration Functions ===

    /**
     * @notice Called by EscrowCore when new escrow is created
     * @param escrowId The ID of the escrow
     * @param totalAmount Total amount deposited
     * @param key The pool key to add liquidity to
     */
    function onEscrowCreated(
        uint256 escrowId,
        uint256 totalAmount,
        PoolKey calldata key
    ) external returns (uint256 lpAmount, uint256 reserveAmount) {
        require(msg.sender == escrowCore, "Only EscrowCore");
        require(!escrowPositions[escrowId].isActive, "Escrow already has LP");

        // Calculate split: 80% LP, 20% reserve
        lpAmount = (totalAmount * LP_RATIO) / 10000;
        reserveAmount = totalAmount - lpAmount;

        // Store position info
        escrowPositions[escrowId] = LPPosition({
            liquidity: 0, // Will be set after adding liquidity
            reserveAmount: reserveAmount,
            token0FeeGrowthLast: 0,
            token1FeeGrowthLast: 0,
            yieldAccumulated: 0,
            isActive: true
        });

        emit LiquidityAdded(escrowId, 0, reserveAmount);
        
        return (lpAmount, reserveAmount);
    }

    /**
     * @notice Calculate and distribute yield when milestone is approved
     * @param escrowId The escrow ID
     * @param milestoneAmount The milestone payment amount
     * @param freelancer Address of the freelancer
     * @return payment Total payment (milestone + yield bonus)
     * @return platformYield Platform's share of yield
     */
    function onMilestoneApproved(
        uint256 escrowId,
        uint256 milestoneAmount,
        address freelancer
    ) external returns (uint256 payment, uint256 platformYield) {
        require(msg.sender == escrowCore, "Only EscrowCore");
        
        LPPosition storage position = escrowPositions[escrowId];
        require(position.isActive, "No active LP position");

        // Calculate yield earned since last action
        uint256 yieldEarned = position.yieldAccumulated;

        // Distribute yield: 70% to freelancer, 30% to platform
        uint256 freelancerYield = (yieldEarned * FREELANCER_SHARE) / 10000;
        platformYield = yieldEarned - freelancerYield;

        // Total payment to freelancer = milestone + yield bonus
        payment = milestoneAmount + freelancerYield;

        // Reset accumulated yield
        position.yieldAccumulated = 0;
        totalYieldDistributed += yieldEarned;

        emit YieldDistributed(escrowId, freelancer, freelancerYield, platformYield);

        return (payment, platformYield);
    }

    /**
     * @notice Get current yield for an escrow
     */
    function getEscrowYield(uint256 escrowId) external view returns (uint256) {
        return escrowPositions[escrowId].yieldAccumulated;
    }

    // === Hook Callbacks ===

    /**
     * @notice Hook called after every swap to track fees
     */
    function _afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        // In a full implementation, we'd:
        // 1. Get fee growth from pool
        // 2. Calculate fees earned by each escrow's LP position
        // 3. Update yieldAccumulated
        
        // For hackathon demo: simplified version
        // Real implementation would query pool state for fee growth
        
        return (BaseHook.afterSwap.selector, 0);
    }

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
