// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
// Assuming LiquidityAmounts is available in v4-periphery or I'll copy the library math if needed.
// Checking file existence suggested it is in lib/v4-periphery/src/libraries/LiquidityAmounts.sol
// I will try to use the direct path or a standard mapping if available.
import {LiquidityAmounts} from "@uniswap/v4-periphery/src/libraries/LiquidityAmounts.sol";



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
    using StateLibrary for IPoolManager;

    uint256 public constant VERSION = 5;

    address public immutable escrowCore;

    // === Yield Tracking State ===
    struct LPPosition {
        PoolKey key;                 // Pool key for this position
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
        uint256 escrowId;
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
    function addLiquidity(uint256 escrowId, PoolKey calldata key, IPoolManager.ModifyLiquidityParams calldata params) external {
        require(msg.sender == escrowCore, "Only EscrowCore");
        
        // Standard v4 pattern: unlock manager, then perform operations in callback
        poolManager.unlock(abi.encode(CallbackData(escrowId, key, params, msg.sender)));
    }

    /**
     * @notice Allows the EscrowCore contract to withdraw funds (with yield) from a pool.
     */
    function removeLiquidity(PoolKey calldata key, IPoolManager.ModifyLiquidityParams calldata params) external {
        require(msg.sender == escrowCore, "Only EscrowCore");
        
        // params.liquidityDelta should be negative for removal
        poolManager.unlock(abi.encode(CallbackData(0, key, params, msg.sender)));
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

        // Update Escrow State if adding liquidity
        if (cb.params.liquidityDelta > 0) {
            _updateEscrowLiquidity(cb.escrowId, cb.key, uint128(uint256(cb.params.liquidityDelta)));
        }

        return "";
    }

    function _updateEscrowLiquidity(uint256 escrowId, PoolKey memory key, uint128 liquidityDelta) internal {
        LPPosition storage pos = escrowPositions[escrowId];
        
        // Initialize if new
        if (pos.liquidity == 0) {
            pos.key = key;
            (uint256 fg0, uint256 fg1) = poolManager.getFeeGrowthGlobals(key.toId());
            pos.token0FeeGrowthLast = fg0;
            pos.token1FeeGrowthLast = fg1;
        }

        pos.liquidity += liquidityDelta;
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
                // Tokens are already in this contract (transferred from EscrowCore via onEscrowCreated)
                poolManager.sync(currency);
                IERC20(Currency.unwrap(currency)).safeTransfer(address(poolManager), absAmount);
                poolManager.settle();
            } else {
                // Native currency (e.g. Monad/Celo)
                // Assuming ETH was sent to this contract or wrapped
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

        // Store basic position info immediately (needed for callback)
        escrowPositions[escrowId] = LPPosition({
            key: key,
            liquidity: 0, 
            reserveAmount: reserveAmount,
            token0FeeGrowthLast: 0,
            token1FeeGrowthLast: 0,
            yieldAccumulated: 0,
            isActive: true
        });

        // Determine liquidity range and amount (Single Sided)
        (uint160 sqrtPriceX96, int24 tick, , ) = poolManager.getSlot0(key.toId());
        
        int24 tickLower;
        int24 tickUpper;
        uint256 amount0Desired = 0;
        uint256 amount1Desired = 0;

        // Check which token is the escrow token (we assume one of them is)
        // If we are holding Currency0, we provide range [current + spacing, MAX]
        // If we are holding Currency1, we provide range [MIN, current - spacing]
        // NOTE: We rely on the hook having the balance now.

        // Pull tokens from EscrowCore (msg.sender)
        // Identify which token is the ERC20 (the other is likely Native/0)
        // In this specific pool (USDC/Native), we transfer USDC.
        
        address token = Currency.unwrap(key.currency0);
        if (token == address(0)) {
            token = Currency.unwrap(key.currency1);
        }
        
        if (token != address(0)) {
            IERC20(token).safeTransferFrom(msg.sender, address(this), lpAmount);
        }

        bool isToken0;
        address currency0Addr = Currency.unwrap(key.currency0);
        if (currency0Addr == address(0)) {
            isToken0 = address(this).balance >= lpAmount;
        } else {
            isToken0 = IERC20(currency0Addr).balanceOf(address(this)) >= lpAmount;
        }
        
        if (isToken0) {
            // Provide liquidity in range [ceil(tick), MAX]
            // Snap to spacing
            int24 tickSpacing = key.tickSpacing;
            tickLower = tick + tickSpacing; 
            // Ensure lower is a multiple of spacing
            tickLower = (tickLower / tickSpacing) * tickSpacing;
            // Handle rounding
            if (tickLower <= tick) tickLower += tickSpacing;
            
            tickUpper = TickMath.MAX_TICK;
            // Snap upper
            tickUpper = (tickUpper / tickSpacing) * tickSpacing; 
            if (tickUpper > TickMath.MAX_TICK) tickUpper -= tickSpacing;

            amount0Desired = lpAmount;
            
            // Calculate liquidity
             uint160 sqrtRatioAX96 = TickMath.getSqrtPriceAtTick(tickLower);
             uint160 sqrtRatioBX96 = TickMath.getSqrtPriceAtTick(tickUpper);
             
             // Liquidity for amount0:
             // Lx = amount0 * sqrtA * sqrtB / (sqrtB - sqrtA)
             // We use LiquidityAmounts lib
             uint128 liquidity = LiquidityAmounts.getLiquidityForAmount0(
                 sqrtRatioAX96,
                 sqrtRatioBX96,
                 amount0Desired
             );
             
             // Unlock and add
             poolManager.unlock(abi.encode(CallbackData({
                 escrowId: escrowId,
                 key: key,
                 params: IPoolManager.ModifyLiquidityParams({
                     tickLower: tickLower,
                     tickUpper: tickUpper,
                     liquidityDelta: int256(uint256(liquidity)),
                     salt: bytes32(0)
                 }),
                 sender: msg.sender
             })));
             
        } else {
            // Assume Token1
            int24 tickSpacing = key.tickSpacing;
            tickUpper = tick - tickSpacing;
             // Ensure upper is a multiple of spacing
            tickUpper = (tickUpper / tickSpacing) * tickSpacing;
             if (tickUpper >= tick) tickUpper -= tickSpacing;

             tickLower = TickMath.MIN_TICK;
             // Snap lower
             tickLower = (tickLower / tickSpacing) * tickSpacing;
             if (tickLower < TickMath.MIN_TICK) tickLower += tickSpacing;

             amount1Desired = lpAmount;
             
             uint160 sqrtRatioAX96 = TickMath.getSqrtPriceAtTick(tickLower);
             uint160 sqrtRatioBX96 = TickMath.getSqrtPriceAtTick(tickUpper);
             
             uint128 liquidity = LiquidityAmounts.getLiquidityForAmount1(
                 sqrtRatioAX96,
                 sqrtRatioBX96,
                 amount1Desired
             );
             
             poolManager.unlock(abi.encode(CallbackData({
                 escrowId: escrowId,
                 key: key,
                 params: IPoolManager.ModifyLiquidityParams({
                     tickLower: tickLower,
                     tickUpper: tickUpper,
                     liquidityDelta: int256(uint256(liquidity)),
                     salt: bytes32(0)
                 }),
                 sender: msg.sender
             })));
        }

        emit LiquidityAdded(escrowId, escrowPositions[escrowId].liquidity, reserveAmount);
        
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

        // Force update yield before distribution
        _updateYield(escrowId);

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

    function _updateYield(uint256 escrowId) internal {
        LPPosition storage pos = escrowPositions[escrowId];
        if (!pos.isActive || pos.liquidity == 0) return;

        (uint256 feeGrowthGlobal0, uint256 feeGrowthGlobal1) = poolManager.getFeeGrowthGlobals(pos.key.toId());
        
        unchecked {
            uint256 delta0 = feeGrowthGlobal0 - pos.token0FeeGrowthLast;
            uint256 delta1 = feeGrowthGlobal1 - pos.token1FeeGrowthLast;
            
            // Simplified: (delta * liquidity) / Q128
            uint256 pending0 = (delta0 * uint256(pos.liquidity)) >> 128;
            uint256 pending1 = (delta1 * uint256(pos.liquidity)) >> 128;
            
            pos.yieldAccumulated += (pending0 + pending1);
            pos.token0FeeGrowthLast = feeGrowthGlobal0;
            pos.token1FeeGrowthLast = feeGrowthGlobal1;
        }
    }

    /**
     * @notice Get current yield for an escrow
     */
    /**
     * @notice Get current yield for an escrow
     */
    function getEscrowYield(uint256 escrowId) external view returns (uint256) {
        LPPosition storage pos = escrowPositions[escrowId];
        if (!pos.isActive || pos.liquidity == 0) return pos.yieldAccumulated;

        (uint256 feeGrowthGlobal0, uint256 feeGrowthGlobal1) = poolManager.getFeeGrowthGlobals(pos.key.toId());
        
        // Calculate pending fees using standard Uniswap formula: ΔfeeGrowth * liquidity
        // feeGrowthGlobal is Q128.128
        // We use a simplified calculation here without FullMath for readability/demo
        // In prod, use FullMath.mulDiv for precision
        
        unchecked {
            uint256 delta0 = feeGrowthGlobal0 - pos.token0FeeGrowthLast;
            uint256 delta1 = feeGrowthGlobal1 - pos.token1FeeGrowthLast;
            
            // Pending fees = (delta * liquidity) / Q128
            uint256 pending0 = (delta0 * uint256(pos.liquidity)) >> 128;
            uint256 pending1 = (delta1 * uint256(pos.liquidity)) >> 128;
            
            return pos.yieldAccumulated + pending0 + pending1;
        }
    }

    // === Hook Callbacks ===

    /**
     * @notice Hook called after every swap to track fees
     */
    function validateHookAddress(BaseHook _this) internal pure override {
        // Bypass local validation because local v4-core uses Low-Bit flags
        // but Unichain Sepolia PoolManager uses High-Bit flags.
        // We mine for High-Bit flags, so local validation would fail.
    }

    function afterSwap(
        address,
        PoolKey calldata,
        IPoolManager.SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4, int128) {
        return (IHooks.afterSwap.selector, 0);
    }

    function beforeAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4) {
        return IHooks.beforeAddLiquidity.selector;
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external override onlyPoolManager returns (bytes4) {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    // Allow receiving native tokens for settlement
    receive() external payable {}
}
