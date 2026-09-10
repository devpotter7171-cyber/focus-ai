"use client";

import React from "react";
import { Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RouteLatency {
    route: string;
    samples: number;
    avg_ms: number;
    p50_ms: number;
    p95_ms: number;
    p99_ms: number;
    max_ms: number;
    violations: number;
}

export interface LatencySnapshot {
    budget_ms: number;
    total_requests: number;
    violations: number;
    violation_pct: number;
    global: {
        samples: number;
        avg_ms: number;
        p50_ms: number;
        p95_ms: number;
        p99_ms: number;
        max_ms: number;
    };
    routes: RouteLatency[];
}

interface LatencyMonitorPanelProps {
    data: LatencySnapshot | null;
    loading?: boolean;
    className?: string;
}

/**
 * Live latency dashboard for the /admin/ml-monitor page.
 *
 * Surfaces:
 *   • Headline P50/P95/P99 + violation rate against the 200ms SLA budget
 *   • Worst-15 routes ranked by P95 latency, with a colour-coded bar
 *   • Per-route violation badge so we can spot offenders
 *
 * Pure component — fed straight from /api/v1/ml/metrics/latency.
 */
export function LatencyMonitorPanel({
    data,
    loading,
    className,
}: LatencyMonitorPanelProps) {
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

    if (!data || data.global.samples === 0) {
        return (
            <div
                className={cn(
                    "rounded-3xl bg-white p-6 border border-slate-100 shadow-soft",
                    className,
                )}
            >
                <header className="flex items-center gap-2 mb-3">
                    <Gauge size={18} className="text-purple-500" />
                    <h3 className="font-bold text-slate-900">Live Latency</h3>
                </header>
                <p className="text-sm text-slate-400 italic">
                    No requests recorded yet — start using the app to see live
                    P50/P95/P99 figures here.
                </p>
            </div>
        );
    }

    const top = data.routes.slice(0, 15);
    const violationsRate = data.violation_pct;

    return (
        <div
            className={cn(
                "rounded-3xl bg-white p-6 border border-slate-100 shadow-soft space-y-5",
                className,
            )}
        >
            <header className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <Gauge size={18} className="text-purple-500" />
                    <h3 className="font-bold text-slate-900">Live Latency</h3>
                    <span className="text-xs text-slate-400">
                        budget {data.budget_ms}ms · {data.total_requests} req
                    </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                    <Stat
                        label="P50"
                        value={`${data.global.p50_ms}ms`}
                        tone="emerald"
                    />
                    <Stat
                        label="P95"
                        value={`${data.global.p95_ms}ms`}
                        tone={
                            data.global.p95_ms > data.budget_ms
                                ? "rose"
                                : "amber"
                        }
                    />
                    <Stat
                        label="P99"
                        value={`${data.global.p99_ms}ms`}
                        tone={
                            data.global.p99_ms > data.budget_ms
                                ? "rose"
                                : "slate"
                        }
                    />
                    <Stat
                        label="Violations"
                        value={`${violationsRate}%`}
                        tone={violationsRate > 5 ? "rose" : "slate"}
                    />
                </div>
            </header>

            <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Top routes by P95
                </h4>
                {top.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">
                        No routes yet.
                    </p>
                ) : (
                    <ul className="space-y-1.5">
                        {top.map((r) => (
                            <RouteRow
                                key={r.route}
                                row={r}
                                budget={data.budget_ms}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

function RouteRow({
    row,
    budget,
}: {
    row: RouteLatency;
    budget: number;
}) {
    const pct = Math.min(100, (row.p95_ms / Math.max(budget, 1)) * 100);
    const tone =
        row.p95_ms > budget
            ? "bg-rose-500"
            : row.p95_ms > budget * 0.75
              ? "bg-amber-500"
              : "bg-emerald-500";
    return (
        <li className="grid grid-cols-12 gap-2 items-center text-xs">
            <span
                className="col-span-5 font-mono truncate text-slate-700"
                title={row.route}
            >
                {row.route}
            </span>
            <div className="col-span-4 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={cn("h-full rounded-full", tone)}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="col-span-1 font-mono text-slate-700 text-right">
                {row.p95_ms}
            </span>
            <span className="col-span-1 font-mono text-slate-400 text-right">
                {row.samples}
            </span>
            <span
                className={cn(
                    "col-span-1 text-[10px] font-bold uppercase text-right",
                    row.violations > 0 ? "text-rose-600" : "text-slate-300",
                )}
            >
                {row.violations > 0 ? `${row.violations}!` : "ok"}
            </span>
        </li>
    );
}

function Stat({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone: "rose" | "amber" | "emerald" | "slate";
}) {
    const palette =
        tone === "rose"
            ? "bg-rose-50 text-rose-700 border-rose-100"
            : tone === "amber"
              ? "bg-amber-50 text-amber-700 border-amber-100"
              : tone === "emerald"
                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                : "bg-slate-50 text-slate-700 border-slate-200";
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-bold uppercase tracking-wide",
                palette,
            )}
        >
            {label}
            <span className="ml-1 font-bold normal-case">{value}</span>
        </span>
    );
}
