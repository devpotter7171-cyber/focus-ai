"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { Activity, RefreshCw, Zap, DollarSign } from "lucide-react";

interface ModelUsage {
    id: string;
    provider: string;
    tier: number;
    description: string;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    daily_budget: number;
    budget_used_pct: number;
    requests: number;
    failures: number;
    in_cooldown: boolean;
    cooldown_remaining_s: number;
    available: boolean;
    avg_latency_ms: number;
    total_cost_usd: number;
    suitable_for: string[];
}

interface UsageReport {
    day: string;
    totals: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
        requests: number;
        failures: number;
        total_cost_usd: number;
        free_savings_estimate_usd: number;
    };
    models: ModelUsage[];
    openrouter_configured: boolean;
    gemini_configured: boolean;
}

function tierLabel(tier: number): string {
    return tier === 1 ? "Fast" : tier === 2 ? "Balanced" : tier === 3 ? "Premium" : "Paid";
}

function tierColor(tier: number): string {
    return tier === 1
        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
        : tier === 2
            ? "bg-blue-50 text-blue-700 border-blue-100"
            : tier === 3
                ? "bg-purple-50 text-purple-700 border-purple-100"
                : "bg-amber-50 text-amber-700 border-amber-100";
}

export default function LLMUsagePage() {
    const [report, setReport] = useState<UsageReport | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    async function load() {
        try {
            const data = await apiFetch<UsageReport>("/admin/llm-usage");
            setReport(data);
        } catch (err) {
            console.error("Failed to load LLM usage:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function handleRefresh() {
        setRefreshing(true);
        await load();
    }

    if (loading) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="h-8 w-48 bg-slate-200 rounded-xl animate-pulse mb-8" />
                <div className="grid grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-28 bg-white rounded-2xl border border-slate-100 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <div className="p-6 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700">
                    Failed to load LLM usage data. Is the backend running?
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">LLM Usage & Routing</h1>
                    <p className="text-slate-500">
                        Token budgets, model health, and cost tracking for {report.day}
                    </p>
                </div>
                <NeuralButton
                    variant="glass"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-2"
                >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                    Refresh
                </NeuralButton>
            </header>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <Activity size={16} className="text-blue-500" />
                        <span className="text-xs font-bold text-slate-400 uppercase">Requests</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{report.totals.requests.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">{report.totals.failures} failures</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap size={16} className="text-amber-500" />
                        <span className="text-xs font-bold text-slate-400 uppercase">Tokens</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">
                        {(report.totals.total_tokens / 1000).toFixed(1)}K
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {(report.totals.input_tokens / 1000).toFixed(1)}K in / {(report.totals.output_tokens / 1000).toFixed(1)}K out
                    </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <DollarSign size={16} className="text-emerald-500" />
                        <span className="text-xs font-bold text-slate-400 uppercase">Cost</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">${report.totals.total_cost_usd.toFixed(4)}</p>
                    <p className="text-xs text-emerald-600 mt-1 font-semibold">
                        Saved ${report.totals.free_savings_estimate_usd.toFixed(4)} vs all-paid
                    </p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-bold text-slate-400 uppercase">Providers</span>
                    </div>
                    <div className="space-y-1">
                        <p className={`text-sm font-bold ${report.openrouter_configured ? "text-emerald-600" : "text-rose-500"}`}>
                            OpenRouter: {report.openrouter_configured ? "Active" : "Not configured"}
                        </p>
                        <p className={`text-sm font-bold ${report.gemini_configured ? "text-emerald-600" : "text-rose-500"}`}>
                            Gemini: {report.gemini_configured ? "Active" : "Not configured"}
                        </p>
                    </div>
                </div>
            </div>

            {/* Model table */}
            <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                    <h2 className="font-bold text-slate-900">Model Fallback Chain</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Models are tried in order. Failed/exhausted models are skipped automatically.
                    </p>
                </div>
                <div className="divide-y divide-slate-100">
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400 bg-slate-50/50">
                        <div className="col-span-3">Model</div>
                        <div className="col-span-1">Tier</div>
                        <div className="col-span-2">Tokens used</div>
                        <div className="col-span-2">Budget</div>
                        <div className="col-span-1">Latency</div>
                        <div className="col-span-1">Reqs</div>
                        <div className="col-span-1">Cost</div>
                        <div className="col-span-1">Status</div>
                    </div>
                    {report.models.map((m) => (
                        <div key={m.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                            <div className="col-span-3">
                                <p className="font-bold text-slate-900 text-sm">{m.id}</p>
                                <p className="text-[10px] text-slate-400">{m.provider}</p>
                            </div>
                            <div className="col-span-1">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${tierColor(m.tier)}`}>
                                    {tierLabel(m.tier)}
                                </span>
                            </div>
                            <div className="col-span-2">
                                <p className="text-sm font-semibold text-slate-700">
                                    {(m.total_tokens / 1000).toFixed(1)}K
                                </p>
                                <p className="text-[10px] text-slate-400">
                                    {(m.input_tokens / 1000).toFixed(1)}K in / {(m.output_tokens / 1000).toFixed(1)}K out
                                </p>
                            </div>
                            <div className="col-span-2">
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${m.budget_used_pct > 80 ? "bg-rose-500" : m.budget_used_pct > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                                        style={{ width: `${Math.min(100, m.budget_used_pct)}%` }}
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    {m.budget_used_pct.toFixed(1)}% of {(m.daily_budget / 1_000_000).toFixed(0)}M
                                </p>
                            </div>
                            <div className="col-span-1">
                                <p className="text-sm font-mono text-slate-700">
                                    {m.avg_latency_ms > 0 ? `${m.avg_latency_ms.toFixed(0)}ms` : "—"}
                                </p>
                            </div>
                            <div className="col-span-1">
                                <p className="text-sm text-slate-700">{m.requests}</p>
                                {m.failures > 0 && (
                                    <p className="text-[10px] text-rose-500">{m.failures} fail</p>
                                )}
                            </div>
                            <div className="col-span-1">
                                <p className="text-sm font-mono text-slate-700">
                                    ${m.total_cost_usd.toFixed(4)}
                                </p>
                            </div>
                            <div className="col-span-1">
                                {m.in_cooldown ? (
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                                        Cooldown {m.cooldown_remaining_s}s
                                    </span>
                                ) : m.available ? (
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                        Ready
                                    </span>
                                ) : (
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                        Unavail
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}
