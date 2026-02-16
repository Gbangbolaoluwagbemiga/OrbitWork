"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Droplet, Coins, Sparkles } from "lucide-react";
import { useWeb3 } from "@/contexts/web3-context";
import { CONTRACTS } from "@/lib/web3/config";
import { ESCROW_HOOK_ABI } from "@/lib/web3/abis";
import { ethers } from "ethers";

interface YieldTrackerProps {
    escrowId: string;
    totalAmount: number;
    tokenSymbol: string;
    daysActive: number;
    tokenDecimals: number;
}

export function YieldTracker({ escrowId, totalAmount, tokenSymbol, daysActive, tokenDecimals }: YieldTrackerProps) {
    const { getContract } = useWeb3();
    const [yieldData, setYieldData] = useState({
        lpAmount: 0,
        reserveAmount: 0,
        yieldAccumulated: 0,
        projectedYield: 0,
        isActive: false,
    });
    const [isExpanded, setIsExpanded] = useState(false);

    // Fetch real yield data
    useEffect(() => {
        let mounted = true;

        const fetchYieldData = async () => {
            try {
                // Calculate 80/20 split (static based on amount)
                const lpAmount = totalAmount * 0.8;
                const reserveAmount = totalAmount * 0.2;

                // Fetch real yield from hook
                const hookContract = getContract(CONTRACTS.ESCROW_HOOK, ESCROW_HOOK_ABI);
                let currentYield = 0;
                let isActive = false;

                if (hookContract) {
                    try {
                        // Use getEscrowYield (view function) - pass args directly, not as array
                        const yieldResult = await hookContract.call("getEscrowYield", escrowId);
                        console.log(`[Escrow ${escrowId}] Yield Result (Raw):`, yieldResult);
                        // Hook now normalizes all yield to 18 decimals for high precision
                        currentYield = Number(ethers.formatUnits(yieldResult, 18));
                        console.log(`[Escrow ${escrowId}] Yield Result (Formatted):`, currentYield);
                        isActive = true;
                    } catch (e) {
                        console.error("Failed to fetch yield data:", e);
                    }
                }

                // If no connection or error, we default to 0 (no simulation)
                // Project yield based on current rate if we have data, or 0
                const projectedYield = currentYield > 0 ? currentYield * 21 : 0;

                if (mounted) {
                    setYieldData({
                        lpAmount,
                        reserveAmount,
                        yieldAccumulated: currentYield,
                        projectedYield,
                        isActive: true, // Always show panel if we have basic data, even if yield is 0
                    });
                }
            } catch (error) {
                // Squelch errors to avoid console spam (real yield is optional/bonus)
                // console.warn("Yield fetch error:", error);
            }
        };

        fetchYieldData();

        // Poll every 30s
        const interval = setInterval(fetchYieldData, 30000);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [totalAmount, daysActive, escrowId, getContract]);

    if (!yieldData.isActive) {
        return null;
    }

    const freelancerYield = yieldData.yieldAccumulated * 0.6;
    const platformYield = yieldData.yieldAccumulated * 0.4;

    return (
        <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-transparent transition-all duration-300">
            <CardHeader className="p-4 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Droplet className="h-4 w-4 text-emerald-500" />
                            Productive Capital
                            <Badge variant="outline" className="ml-2 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] h-5 px-1.5">
                                <Sparkles className="h-2 w-2 mr-1" />
                                Active
                            </Badge>
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                            {isExpanded ? "Your funds are earning yield in Uniswap V4" : `Earning swap fees: +${yieldData.yieldAccumulated.toFixed(6)} ${tokenSymbol}`}
                        </CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        {isExpanded ? (
                            <TrendingUp className="h-4 w-4 text-emerald-500 transform rotate-180 transition-transform" />
                        ) : (
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        )}
                    </Button>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="space-y-4 pt-0 p-4">
                    {/* LP Position */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">LP Position</p>
                            <p className="text-lg font-bold text-emerald-500">
                                {yieldData.lpAmount.toFixed(2)} {tokenSymbol}
                            </p>
                            <p className="text-[10px] text-muted-foreground">80% in liquidity pool</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Reserve</p>
                            <p className="text-lg font-bold">
                                {yieldData.reserveAmount.toFixed(2)} {tokenSymbol}
                            </p>
                            <p className="text-[10px] text-muted-foreground">20% for payouts</p>
                        </div>
                    </div>

                    {/* Yield Stats */}
                    <div className="pt-3 border-t">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-3 w-3 text-emerald-500" />
                                <span className="text-xs font-medium">Yield Earned</span>
                            </div>
                            <span className="text-sm font-bold text-emerald-500">
                                +${yieldData.yieldAccumulated.toFixed(6)} ${tokenSymbol}
                            </span>
                        </div>

                        {/* Distribution Breakdown */}
                        <div className="space-y-1.5 mt-2 p-2 bg-muted/50 rounded-lg">
                            <p className="text-[10px] font-medium text-muted-foreground">Distribution (on milestone approval):</p>
                            <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-1">
                                    <Coins className="h-3 w-3" />
                                    Freelancer (60%)
                                </span>
                                <span className="font-semibold">+${freelancerYield.toFixed(6)} ${tokenSymbol}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Platform (40%)</span>
                                <span>${platformYield.toFixed(6)} ${tokenSymbol}</span>
                            </div>
                        </div>

                        {/* Projected */}
                        <div className="mt-2 p-1.5 bg-emerald-500/5 rounded border border-emerald-500/20">
                            <div className="flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground">Projected Total Yield:</span>
                                <span className="font-semibold text-emerald-500">
                                    ~${yieldData.projectedYield.toFixed(6)} ${tokenSymbol}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Active indicator */}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Earning swap fees for {daysActive} days</span>
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
