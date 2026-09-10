"use client";

import React from "react";
import { Calendar, AlertCircle, Clock, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReviewForecast {
    today: string;
    horizon_days: number;
    total_cards: number;
    overdue: number;
    due_today: number;
    by_day: { date: string; count: number }[];
    by_state: Record<string, number>;
}

interface ReviewForecastHeatmapProps {
    forecast: ReviewForecast | null;
    loading?: boolean;
    className?: string;
}

/**
 * GitHub-style calendar heatmap for the user's spaced-repetition workload.
 *
 * Renders a 7-row × N-column grid where each cell is a calendar day in
 * the upcoming ``horizon_days`` window. Cell intensity scales with the
 * number of cards due that day; the cell tooltip surfaces the date and
 * exact card count.
 *
 * Pure component — relies only on Tailwind classes and the heatmap data
 * returned by /api/v1/flashcards/forecast.
 */
export function ReviewForecastHeatmap({
    forecast,
    loading = false,
    className,
}: ReviewForecastHeatmapProps) {
    const max = React.useMemo(() => {
        if (!forecast) return 0;
        return forecast.by_day.reduce((m, d) => Math.max(m, d.count), 0);
    }, [forecast]);

    if (loading) {
        return (
            <div
                className={cn(
                    "rounded-3xl bg-white p-6 border border-slate-100 shadow-soft",
                    className,
                )}
            >
                <div className="h-6 w-48 bg-slate-100 animate-pulse rounded mb-4" />
                <div className="h-32 bg-slate-50 animate-pulse rounded" />
            </div>
        );
    }

    if (!forecast || forecast.total_cards === 0) {
        return (
            <div
                className={cn(
                    "rounded-3xl bg-white p-6 border border-slate-100 shadow-soft",
                    className,
                )}
            >
                <header className="flex items-center gap-2 mb-3">
                    <Calendar size={18} className="text-teal-500" />
                    <h3 className="font-bold text-slate-900">Review Forecast</h3>
                </header>
                <p className="text-sm text-slate-400 italic">
                    No flashcards spawned yet — they appear automatically after a
                    confused quiz attempt.
                </p>
            </div>
        );
    }

    // Group days into weeks (columns) for the GitHub-style grid.
    const weeks: ({ date: string; count: number } | null)[][] = [];
    let currentWeek: ({ date: string; count: number } | null)[] = [];
    const firstDate = new Date(forecast.by_day[0]?.date ?? forecast.today);
    // Pad with nulls so the first column starts on the correct weekday row.
    const dayOfWeekOffset = firstDate.getDay(); // 0=Sun..6=Sat
    for (let i = 0; i < dayOfWeekOffset; i++) currentWeek.push(null);

    for (const d of forecast.by_day) {
        currentWeek.push(d);
        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    }
    if (currentWeek.length) {
        while (currentWeek.length < 7) currentWeek.push(null);
        weeks.push(currentWeek);
    }

    return (
        <div
            className={cn(
                "rounded-3xl bg-white p-6 border border-slate-100 shadow-soft",
                className,
            )}
        >
            <header className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-teal-500" />
                    <h3 className="font-bold text-slate-900">Review Forecast</h3>
                    <span className="ml-2 text-xs text-slate-400">
                        Next {forecast.horizon_days} days
                    </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                    <Pill
                        icon={<AlertCircle size={12} />}
                        label="Overdue"
                        value={forecast.overdue}
                        tone="rose"
                    />
                    <Pill
                        icon={<Clock size={12} />}
                        label="Today"
                        value={forecast.due_today}
                        tone="amber"
                    />
                    <Pill
                        icon={<Layers size={12} />}
                        label="Total"
                        value={forecast.total_cards}
                        tone="slate"
                    />
                </div>
            </header>

            <div className="flex gap-1 overflow-x-auto pb-2">
                {/* Day-of-week labels */}
                <div className="flex flex-col gap-1 mr-2 pt-3 text-[10px] font-semibold text-slate-400">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                        <div key={i} className="h-3.5 leading-none">
                            {i % 2 === 1 ? d : ""}
                        </div>
                    ))}
                </div>

                {/* Grid */}
                <div className="flex gap-1">
                    {weeks.map((week, wi) => (
                        <div key={wi} className="flex flex-col gap-1">
                            {week.map((day, di) => (
                                <Cell key={di} day={day} max={max} />
                            ))}
                        </div>
                    ))}
                </div>
            </div>

            <Legend max={max} />

            {/* State breakdown */}
            <div className="mt-5 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    By State
                </h4>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(forecast.by_state).map(([state, count]) => (
                        <span
                            key={state}
                            className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-xs font-semibold text-slate-600"
                        >
                            {state}{" "}
                            <span className="text-slate-900 font-bold">{count}</span>
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

function Cell({
    day,
    max,
}: {
    day: { date: string; count: number } | null;
    max: number;
}) {
    if (!day) {
        return <div className="h-3.5 w-3.5 rounded-sm" />;
    }
    const intensity = max === 0 ? 0 : day.count / max;
    const cls =
        day.count === 0
            ? "bg-slate-100"
            : intensity < 0.25
              ? "bg-teal-100"
              : intensity < 0.5
                ? "bg-teal-300"
                : intensity < 0.75
                  ? "bg-teal-500"
                  : "bg-teal-700";
    const formatted = new Date(day.date).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
    return (
        <div
            className={cn(
                "h-3.5 w-3.5 rounded-sm transition-transform hover:scale-150 cursor-pointer",
                cls,
            )}
            title={`${formatted} — ${day.count} card${day.count === 1 ? "" : "s"} due`}
            aria-label={`${formatted}, ${day.count} cards due`}
        />
    );
}

function Pill({
    icon,
    label,
    value,
    tone,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    tone: "rose" | "amber" | "slate";
}) {
    const palette =
        tone === "rose"
            ? "bg-rose-50 text-rose-700 border-rose-100"
            : tone === "amber"
              ? "bg-amber-50 text-amber-700 border-amber-100"
              : "bg-slate-50 text-slate-700 border-slate-200";
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-bold uppercase tracking-wide",
                palette,
            )}
        >
            {icon}
            {label}
            <span className="ml-1 font-bold">{value}</span>
        </span>
    );
}

function Legend({ max }: { max: number }) {
    return (
        <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-400">
            <span>Less</span>
            <span className="h-3 w-3 rounded-sm bg-slate-100" />
            <span className="h-3 w-3 rounded-sm bg-teal-100" />
            <span className="h-3 w-3 rounded-sm bg-teal-300" />
            <span className="h-3 w-3 rounded-sm bg-teal-500" />
            <span className="h-3 w-3 rounded-sm bg-teal-700" />
            <span>More{max > 0 ? ` (max ${max}/day)` : ""}</span>
        </div>
    );
}
