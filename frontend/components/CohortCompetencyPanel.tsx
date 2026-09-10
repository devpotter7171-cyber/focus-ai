"use client";

import React from "react";
import { Flame, Users, AlertTriangle, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { humaniseSubtopicId } from "@/lib/adaptive/pathBranching";

export interface CohortStudent {
    user_id: string;
    overall_mastery: number;
    skill_count: number;
    weak_skills: { skill: string; score: number }[];
}

export interface CohortSkill {
    skill: string;
    avg_mastery: number;
    students: number;
    struggling: number;
    struggling_pct: number;
}

export interface CohortBreakdown {
    total_students: number;
    total_skills_tracked: number;
    students: CohortStudent[];
    skills: CohortSkill[];
    hot_spots: CohortSkill[];
}

interface CohortCompetencyPanelProps {
    data: CohortBreakdown | null;
    loading?: boolean;
    className?: string;
}

/**
 * Teacher-facing cohort competency view.
 *
 * Surfaces three things side-by-side:
 *   • Hot spots — skills where ≥ 30% of the cohort is below 40% mastery
 *   • Skill leaderboard — every tracked skill ranked weakest first
 *   • Student leaderboard — every active student ranked by overall mastery
 *
 * Pure component; takes the response from
 * GET /api/v1/admin/cohort/competencies as-is.
 */
export function CohortCompetencyPanel({
    data,
    loading = false,
    className,
}: CohortCompetencyPanelProps) {
    if (loading) {
        return (
            <div
                className={cn(
                    "rounded-3xl bg-white p-6 border border-slate-100 shadow-soft",
                    className,
                )}
            >
                <div className="h-6 w-48 bg-slate-100 animate-pulse rounded mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="h-48 bg-slate-50 animate-pulse rounded-2xl"
                        />
                    ))}
                </div>
            </div>
        );
    }

    if (!data || data.total_students === 0) {
        return (
            <div
                className={cn(
                    "rounded-3xl bg-white p-6 border border-slate-100 shadow-soft",
                    className,
                )}
            >
                <header className="flex items-center gap-2 mb-3">
                    <Users size={18} className="text-purple-500" />
                    <h3 className="font-bold text-slate-900">Cohort Competency Map</h3>
                </header>
                <p className="text-sm text-slate-400 italic">
                    No mastery data yet — students need to attempt at least one
                    quiz to appear here.
                </p>
            </div>
        );
    }

    return (
        <div className={cn("space-y-6", className)}>
            <div className="rounded-3xl bg-white p-6 border border-slate-100 shadow-soft">
                <header className="flex items-center justify-between flex-wrap gap-3 mb-2">
                    <div className="flex items-center gap-2">
                        <Users size={18} className="text-purple-500" />
                        <h3 className="font-bold text-slate-900">
                            Cohort Competency Map
                        </h3>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>
                            <strong className="text-slate-900">
                                {data.total_students}
                            </strong>{" "}
                            students
                        </span>
                        <span>·</span>
                        <span>
                            <strong className="text-slate-900">
                                {data.total_skills_tracked}
                            </strong>{" "}
                            skills tracked
                        </span>
                    </div>
                </header>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <HotSpotsCard hotSpots={data.hot_spots} />
                <SkillLeaderboard skills={data.skills} />
                <StudentLeaderboard students={data.students} />
            </div>
        </div>
    );
}

function HotSpotsCard({ hotSpots }: { hotSpots: CohortSkill[] }) {
    return (
        <div className="rounded-3xl bg-amber-50 p-6 border border-amber-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <Flame size={18} className="text-amber-600" />
                <h4 className="font-bold text-amber-900">Hot Spots</h4>
                <span className="ml-auto text-xs font-semibold text-amber-700">
                    {hotSpots.length}
                </span>
            </div>
            <p className="text-xs text-amber-800/80 mb-4">
                Skills where 30%+ of the cohort is below 40% mastery.
            </p>
            {hotSpots.length === 0 ? (
                <p className="text-sm text-amber-900 italic">
                    No problematic skills detected — the class is on track.
                </p>
            ) : (
                <ul className="space-y-2">
                    {hotSpots.map((s) => (
                        <li
                            key={s.skill}
                            className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/60 border border-amber-100"
                        >
                            <AlertTriangle
                                size={14}
                                className="text-amber-600 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-amber-900 truncate">
                                    {humaniseSubtopicId(s.skill)}
                                </div>
                                <div className="text-xs text-amber-700">
                                    {s.struggling}/{s.students} struggling ·{" "}
                                    {s.avg_mastery}% avg
                                </div>
                            </div>
                            <div className="text-xs font-bold text-amber-800 flex-shrink-0">
                                {s.struggling_pct}%
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

function SkillLeaderboard({ skills }: { skills: CohortSkill[] }) {
    const top = skills.slice(0, 8);
    return (
        <div className="rounded-3xl bg-white p-6 border border-slate-100 shadow-soft">
            <div className="flex items-center gap-2 mb-4">
                <TrendingDown size={18} className="text-rose-500" />
                <h4 className="font-bold text-slate-900">Weakest Skills</h4>
                <span className="ml-auto text-xs font-semibold text-slate-400">
                    {skills.length}
                </span>
            </div>
            <ul className="space-y-2">
                {top.map((s) => (
                    <li key={s.skill} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 truncate pr-2">
                                {humaniseSubtopicId(s.skill)}
                            </span>
                            <span className="text-slate-500 flex-shrink-0">
                                {s.avg_mastery}% · {s.students} st.
                            </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    "h-full rounded-full",
                                    s.avg_mastery < 40
                                        ? "bg-rose-500"
                                        : s.avg_mastery < 70
                                          ? "bg-amber-500"
                                          : "bg-emerald-500",
                                )}
                                style={{
                                    width: `${Math.max(2, Math.min(100, s.avg_mastery))}%`,
                                }}
                            />
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function StudentLeaderboard({ students }: { students: CohortStudent[] }) {
    const top = students.slice(0, 8);
    return (
        <div className="rounded-3xl bg-white p-6 border border-slate-100 shadow-soft">
            <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-blue-500" />
                <h4 className="font-bold text-slate-900">Students Needing Help</h4>
                <span className="ml-auto text-xs font-semibold text-slate-400">
                    {students.length}
                </span>
            </div>
            <ul className="space-y-3">
                {top.map((st) => (
                    <li key={st.user_id} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                            <span
                                className="text-xs font-mono text-slate-600 truncate"
                                title={st.user_id}
                            >
                                {st.user_id.slice(0, 14)}…
                            </span>
                            <span
                                className={cn(
                                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                                    st.overall_mastery < 40
                                        ? "bg-rose-100 text-rose-700"
                                        : st.overall_mastery < 70
                                          ? "bg-amber-100 text-amber-700"
                                          : "bg-emerald-100 text-emerald-700",
                                )}
                            >
                                {Math.round(st.overall_mastery)}%
                            </span>
                        </div>
                        {st.weak_skills.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {st.weak_skills.slice(0, 3).map((w) => (
                                    <span
                                        key={w.skill}
                                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600"
                                        title={`${humaniseSubtopicId(w.skill)} · ${w.score}%`}
                                    >
                                        {humaniseSubtopicId(w.skill).slice(0, 18)}
                                    </span>
                                ))}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
