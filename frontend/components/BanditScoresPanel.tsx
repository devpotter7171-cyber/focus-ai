"use client";

import React from "react";
import { Layers, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BanditArmScore {
    name: string;
    score: number;
    is_selected: boolean;
}

export interface BanditState {
    arms: string[];
    selected: string | null;
    selected_arm_id: number | null;
    all_scores: BanditArmScore[];
    reason: string;
}

interface BanditScoresPanelProps {
    data: BanditState | null;
    loading?: boolean;
    className?: string;
}

/**
 * Live bandit-arm view for the ML monitor.
 *
 * Sorts every arm by its current LinUCB score under a neutral context
 * (confusion=0.5, mastery=0.5, balanced learner) so we can see at a
 * glance which explanation strategy LinUCB is currently favouring.
 */
export function BanditScoresPanel({
    data,
    loading,
    className,
}: BanditScoresPanelProps) {
    if (loading) {
        return (
            <div
                className={cn(
                    "rounded-3xl bg-white p-6 border border-slate-100 shadow-soft",
                    className,
                )}
            >
                <div className="h-6 w-48 bg-slate-100 animate-pulse rounded mb-4" />
                <div className="h-40 bg-slate-50 animate-pulse rounded-2xl" />
            </div>
        );
    }

    if (!data) {
        return null;
    }

    const sorted = [...data.all_scores].sort((a, b) => b.score - a.score);
    const max = Math.max(0.001, ...sorted.map((a) => a.score));

    return (
        <div
            className={cn(
                "rounded-3xl bg-white p-6 border border-slate-100 shadow-soft space-y-4",
                className,
            )}
        >
            <header className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Layers size={18} className="text-blue-500" />
                    <h3 className="font-bold text-slate-900">
                        Bandit Arm Scores
                    </h3>
                    <span className="text-xs text-slate-400">
                        neutral context
                    </span>
                </div>
                {data.selected && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold uppercase">
                        <Sparkles size={12} />
                        {data.selected}
                    </span>
                )}
            </header>

            {sorted.length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                    {data.reason || "No bandit data yet."}
                </p>
            ) : (
                <ul className="space-y-2">
                    {sorted.map((arm) => (
                        <li
                            key={arm.name}
                            className="grid grid-cols-12 gap-2 items-center text-xs"
                        >
                            <span
                                className={cn(
                                    "col-span-3 font-semibold capitalize truncate",
                                    arm.is_selected
                                        ? "text-indigo-700"
                                        : "text-slate-700",
                                )}
                            >
                                {arm.name}
                            </span>
                            <div className="col-span-7 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all",
                                        arm.is_selected
                                            ? "bg-indigo-500"
                                            : "bg-slate-300",
                                    )}
                                    style={{
                                        width: `${Math.max(2, (arm.score / max) * 100)}%`,
                                    }}
                                />
                            </div>
                            <span className="col-span-2 font-mono text-right text-slate-700">
                                {arm.score.toFixed(3)}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {data.reason && (
                <p className="text-xs text-slate-400 italic pt-2 border-t border-slate-100">
                    {data.reason}
                </p>
            )}
        </div>
    );
}
