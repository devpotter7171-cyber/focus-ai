"use client";

import React from "react";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfusionBin {
    lo: number;
    hi: number;
    count: number;
}

export interface ConfusionDistribution {
    horizon_hours: number;
    total_events: number;
    avg_confusion: number;
    bins: ConfusionBin[];
}

interface ConfusionDistributionPanelProps {
    data: ConfusionDistribution | null;
    loading?: boolean;
    className?: string;
}

/**
 * Histogram of recent confusion-event scores for the ML monitor.
 *
 * Helps verify the confusion classifier is still producing a healthy
 * spread (and not stuck near 0 or 1) in production.
 */
export function ConfusionDistributionPanel({
    data,
    loading,
    className,
}: ConfusionDistributionPanelProps) {
    if (loading) {
        return (
            <div
                className={cn(
                    "rounded-3xl bg-white p-6 border border-slate-100 shadow-soft",
                    className,
                )}
            >
                <div className="h-6 w-48 bg-slate-100 animate-pulse rounded mb-4" />
                <div className="h-32 bg-slate-50 animate-pulse rounded-2xl" />
            </div>
        );
    }

    if (!data || data.total_events === 0) {
        return (
            <div
                className={cn(
                    "rounded-3xl bg-white p-6 border border-slate-100 shadow-soft",
                    className,
                )}
            >
                <header className="flex items-center gap-2 mb-3">
                    <Activity size={18} className="text-rose-500" />
                    <h3 className="font-bold text-slate-900">
                        Confusion Distribution
                    </h3>
                </header>
                <p className="text-sm text-slate-400 italic">
                    No confusion events recorded in the last{" "}
                    {data?.horizon_hours ?? 24}h.
                </p>
            </div>
        );
    }

    const max = Math.max(1, ...data.bins.map((b) => b.count));

    return (
        <div
            className={cn(
                "rounded-3xl bg-white p-6 border border-slate-100 shadow-soft space-y-4",
                className,
            )}
        >
            <header className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-rose-500" />
                    <h3 className="font-bold text-slate-900">
                        Confusion Distribution
                    </h3>
                    <span className="text-xs text-slate-400">
                        last {data.horizon_hours}h
                    </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 font-bold uppercase text-slate-700">
                        {data.total_events} events
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-100 font-bold uppercase text-rose-700">
                        avg {Math.round(data.avg_confusion * 100)}%
                    </span>
                </div>
            </header>

            <div className="grid grid-cols-10 gap-1.5 items-end h-28">
                {data.bins.map((b, i) => {
                    const h = (b.count / max) * 100;
                    const tone =
                        b.lo >= 0.7
                            ? "bg-rose-400"
                            : b.lo >= 0.4
                              ? "bg-amber-400"
                              : "bg-emerald-400";
                    return (
                        <div
                            key={i}
                            className="flex flex-col items-center justify-end h-full"
                            title={`${b.lo.toFixed(1)} – ${b.hi.toFixed(1)}: ${b.count}`}
                        >
                            <span className="text-[10px] text-slate-500 mb-1">
                                {b.count > 0 ? b.count : ""}
                            </span>
                            <div
                                className={cn(
                                    "w-full rounded-t-md transition-all",
                                    tone,
                                )}
                                style={{ height: `${Math.max(2, h)}%` }}
                            />
                        </div>
                    );
                })}
            </div>
            <div className="grid grid-cols-10 gap-1.5 text-[10px] text-slate-400 text-center">
                {data.bins.map((b, i) => (
                    <div key={i}>{b.lo.toFixed(1)}</div>
                ))}
            </div>
        </div>
    );
}
