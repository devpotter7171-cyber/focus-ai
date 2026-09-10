"use client";

import React from "react";
import { Activity, AlertTriangle, Clock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { humaniseSubtopicId } from "@/lib/adaptive/pathBranching";

export interface TimelineBucket {
    bucket: number;
    ts_start: string;
    samples: number;
    avg_confusion: number;
}

export interface QuestionRow {
    question_id: string;
    avg_confusion: number;
    max_confusion: number;
    samples: number;
    distinct_users: number;
    avg_hesitation_ms: number;
    avg_attempts: number;
}

export interface ConfusionTimeline {
    subtopic_id: string;
    horizon_days: number;
    total_events: number;
    distinct_users: number;
    avg_confusion: number;
    by_question: QuestionRow[];
    hot_questions: QuestionRow[];
    timeline: TimelineBucket[];
}

interface ConfusionTimelinePanelProps {
    data: ConfusionTimeline | null;
    loading?: boolean;
    onSubtopicChange?: (id: string) => void;
    subtopicOptions?: { id: string; title: string }[];
    className?: string;
}

/**
 * Per-subtopic confusion timeline (L4).
 *
 * Surfaces three things at once:
 *   • A pure-SVG sparkline over time showing mean confusion per bucket
 *   • A summary strip (events / users / avg confusion / horizon)
 *   • A list of "hot questions" inside the subtopic where the model
 *     thinks students are getting stuck the most
 */
export function ConfusionTimelinePanel({
    data,
    loading = false,
    onSubtopicChange,
    subtopicOptions,
    className,
}: ConfusionTimelinePanelProps) {
    if (loading) {
        return (
            <div
                className={cn(
                    "rounded-3xl bg-white p-6 border border-slate-100 shadow-soft",
                    className,
                )}
            >
                <div className="h-6 w-64 bg-slate-100 animate-pulse rounded mb-4" />
                <div className="h-32 bg-slate-50 animate-pulse rounded-2xl mb-4" />
                <div className="h-24 bg-slate-50 animate-pulse rounded-2xl" />
            </div>
        );
    }

    return (
        <div
            className={cn(
                "rounded-3xl bg-white p-6 border border-slate-100 shadow-soft space-y-5",
                className,
            )}
        >
            <header className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                    <Activity size={18} className="text-rose-500" />
                    <h3 className="font-bold text-slate-900">
                        Confusion Timeline
                    </h3>
                    {data && (
                        <span className="text-xs text-slate-400">
                            · last {data.horizon_days} days
                        </span>
                    )}
                </div>
                {subtopicOptions && subtopicOptions.length > 0 && (
                    <select
                        value={data?.subtopic_id ?? ""}
                        onChange={(e) => onSubtopicChange?.(e.target.value)}
                        className="text-xs font-medium border border-slate-200 rounded-full px-3 py-1.5 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-200"
                    >
                        {subtopicOptions.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.title}
                            </option>
                        ))}
                    </select>
                )}
            </header>

            {!data || data.total_events === 0 ? (
                <p className="text-sm text-slate-400 italic">
                    No confusion events recorded for{" "}
                    {data
                        ? humaniseSubtopicId(data.subtopic_id)
                        : "this subtopic"}{" "}
                    in the selected window.
                </p>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Stat
                            icon={<Activity size={14} />}
                            label="Events"
                            value={data.total_events}
                            tone="rose"
                        />
                        <Stat
                            icon={<Users size={14} />}
                            label="Distinct Users"
                            value={data.distinct_users}
                            tone="slate"
                        />
                        <Stat
                            icon={<AlertTriangle size={14} />}
                            label="Avg Confusion"
                            value={`${Math.round(data.avg_confusion * 100)}%`}
                            tone={
                                data.avg_confusion >= 0.6
                                    ? "rose"
                                    : data.avg_confusion >= 0.4
                                      ? "amber"
                                      : "emerald"
                            }
                        />
                        <Stat
                            icon={<Clock size={14} />}
                            label="Hot Questions"
                            value={data.hot_questions.length}
                            tone={data.hot_questions.length ? "amber" : "slate"}
                        />
                    </div>

                    <Sparkline timeline={data.timeline} />

                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                            Hot Questions (avg ≥ 50%)
                        </h4>
                        {data.hot_questions.length === 0 ? (
                            <p className="text-sm text-emerald-600">
                                No question is over the confusion threshold —
                                this subtopic is landing well.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {data.hot_questions.map((q) => (
                                    <QuestionRowItem key={q.question_id} q={q} />
                                ))}
                            </ul>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

function Sparkline({ timeline }: { timeline: TimelineBucket[] }) {
    if (timeline.length === 0) return null;
    const W = 600;
    const H = 110;
    const PAD = 8;
    const max = Math.max(0.001, ...timeline.map((b) => b.avg_confusion));
    const sampleMax = Math.max(1, ...timeline.map((b) => b.samples));

    const points = timeline.map((b, i) => {
        const x = PAD + (i / Math.max(1, timeline.length - 1)) * (W - PAD * 2);
        const y =
            PAD +
            (1 - b.avg_confusion / Math.max(0.5, max)) * (H - PAD * 2);
        return { x, y, bucket: b };
    });

    const linePath = points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ");
    const areaPath =
        `${linePath} L ${points[points.length - 1]!.x} ${H - PAD} L ${points[0]!.x} ${H - PAD} Z`;

    return (
        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 mb-2">
                <span>Mean Confusion Over Time</span>
                <span>0.0 → {max.toFixed(2)}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28">
                <defs>
                    <linearGradient
                        id="confusion-area"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                    >
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                    </linearGradient>
                </defs>
                {/* 0.5 threshold line */}
                <line
                    x1={PAD}
                    x2={W - PAD}
                    y1={PAD + (1 - 0.5 / Math.max(0.5, max)) * (H - PAD * 2)}
                    y2={PAD + (1 - 0.5 / Math.max(0.5, max)) * (H - PAD * 2)}
                    stroke="#cbd5e1"
                    strokeDasharray="3 3"
                    strokeWidth={1}
                />
                <path d={areaPath} fill="url(#confusion-area)" />
                <path
                    d={linePath}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {points.map((p, i) => (
                    <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={p.bucket.samples > 0 ? 2.5 : 1.5}
                        fill={p.bucket.samples > 0 ? "#f43f5e" : "#cbd5e1"}
                    >
                        <title>
                            {new Date(p.bucket.ts_start).toLocaleString()} —{" "}
                            {p.bucket.samples} sample
                            {p.bucket.samples === 1 ? "" : "s"} · avg{" "}
                            {(p.bucket.avg_confusion * 100).toFixed(0)}%
                        </title>
                    </circle>
                ))}
            </svg>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>{new Date(timeline[0]!.ts_start).toLocaleDateString()}</span>
                <span>now</span>
            </div>
            <div className="mt-2 text-[10px] text-slate-400">
                Max samples / bucket: {sampleMax}
            </div>
        </div>
    );
}

function QuestionRowItem({ q }: { q: QuestionRow }) {
    const tone =
        q.avg_confusion >= 0.7
            ? "border-rose-200 bg-rose-50"
            : q.avg_confusion >= 0.5
              ? "border-amber-200 bg-amber-50"
              : "border-slate-100 bg-slate-50";
    const text =
        q.avg_confusion >= 0.7
            ? "text-rose-900"
            : q.avg_confusion >= 0.5
              ? "text-amber-900"
              : "text-slate-700";
    return (
        <li
            className={cn(
                "rounded-xl border px-3 py-2 flex items-center gap-3",
                tone,
            )}
        >
            <span
                className={cn(
                    "text-sm font-mono font-bold flex-shrink-0",
                    text,
                )}
            >
                {q.question_id.slice(0, 16)}
            </span>
            <div className="flex-1 min-w-0">
                <div
                    className={cn(
                        "h-1.5 bg-white/70 rounded-full overflow-hidden",
                    )}
                >
                    <div
                        className={cn(
                            "h-full rounded-full",
                            q.avg_confusion >= 0.7
                                ? "bg-rose-500"
                                : q.avg_confusion >= 0.5
                                  ? "bg-amber-500"
                                  : "bg-slate-400",
                        )}
                        style={{
                            width: `${Math.round(q.avg_confusion * 100)}%`,
                        }}
                    />
                </div>
            </div>
            <div className={cn("text-xs flex flex-col items-end", text)}>
                <span className="font-bold">
                    {Math.round(q.avg_confusion * 100)}%
                </span>
                <span className="opacity-75">
                    {q.samples} ev · {q.distinct_users} u
                </span>
            </div>
        </li>
    );
}

function Stat({
    icon,
    label,
    value,
    tone,
}: {
    icon: React.ReactNode;
    label: string;
    value: number | string;
    tone: "rose" | "amber" | "slate" | "emerald";
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
        <div className={cn("rounded-xl border px-3 py-2", palette)}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider opacity-80">
                {icon}
                {label}
            </div>
            <div className="text-2xl font-bold mt-1">{value}</div>
        </div>
    );
}
