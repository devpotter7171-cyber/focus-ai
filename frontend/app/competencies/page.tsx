"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { NeuralSidebar as Sidebar } from "@/components/neural/Sidebar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { NeuralSkeleton } from "@/components/neural/NeuralSkeleton";
import { CompetencyGraph } from "@/components/CompetencyGraph";
import { RemediationPathPanel } from "@/components/RemediationPathPanel";
import {
    DBMS_COMPETENCIES,
    type Competency,
    competencyColor,
} from "@/lib/competencies";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Network, ArrowUpRight, Lock, Sparkles } from "lucide-react";

interface CourseProgress {
    completed_subtopics: string[];
    confused_subtopics: string[];
}

interface MasterySnapshot {
    overall_mastery: number;
    weak_skills: { skill: string; score: number }[];
}

export default function CompetencyPage() {
    const { user, loading: authLoading } = useAuth();
    const [completed, setCompleted] = useState<Set<string>>(new Set());
    const [mastery, setMastery] = useState<MasterySnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Competency | null>(null);

    useEffect(() => {
        if (authLoading) return;
        if (!user?.uid) {
            // Defer the state update so React doesn't flag a synchronous
            // cascading render on the no-user fast path.
            const t = setTimeout(() => setLoading(false), 0);
            return () => clearTimeout(t);
        }
        let cancelled = false;
        Promise.all([
            apiFetch<CourseProgress>(`/courses/dbms/progress?user_id=${user.uid}`).catch(
                () => ({ completed_subtopics: [], confused_subtopics: [] }),
            ),
            apiFetch<MasterySnapshot>(`/answers/mastery/${user.uid}`).catch(() => null),
        ])
            .then(([prog, m]) => {
                if (cancelled) return;
                setCompleted(new Set(prog?.completed_subtopics ?? []));
                setMastery(m);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [user, authLoading]);

    // Build a per-subtopic mastery map (heuristic: use unit-level BKT score
    // for subtopics in that unit, and 1.0 for completed subtopics).
    const masteryBySubtopic = useMemo(() => {
        const out: Record<string, number> = {};
        for (const id of completed) {
            out[id] = Math.max(out[id] ?? 0, 1);
        }
        return out;
    }, [completed]);

    const summary = useMemo(() => {
        const ready: Competency[] = [];
        const next: Competency[] = [];
        const locked: Competency[] = [];
        const progressMap: Record<string, number> = {};
        for (const c of DBMS_COMPETENCIES) {
            const samples = c.subtopicIds.map((id) => masteryBySubtopic[id] ?? 0);
            progressMap[c.id] = samples.length
                ? samples.reduce((a, b) => a + b, 0) / samples.length
                : 0;
        }
        for (const c of DBMS_COMPETENCIES) {
            const p = progressMap[c.id] ?? 0;
            const unlocked = c.prerequisites.every(
                (pre) => (progressMap[pre] ?? 0) >= 0.4,
            );
            if (!unlocked) locked.push(c);
            else if (p >= 0.7) ready.push(c);
            else next.push(c);
        }
        return { ready, next, locked, progressMap };
    }, [masteryBySubtopic]);

    if (loading) {
        return (
            <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
                <Sidebar className="hidden md:flex flex-shrink-0" />
                <main className="flex-1 flex flex-col p-8 md:pl-60 overflow-y-auto">
                    <NeuralSkeleton className="h-8 w-64 rounded-xl mb-8" />
                    <NeuralSkeleton className="h-[500px] rounded-3xl" />
                </main>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
            <Sidebar className="hidden md:flex flex-shrink-0" />
            <main className="flex-1 flex flex-col p-8 md:pl-60 overflow-y-auto">
                <header className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <MobileSidebar />
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                                <Network size={28} className="text-teal-500" />
                                Competency Graph
                            </h1>
                            <p className="text-slate-500">
                                Your DBMS knowledge map — prerequisites flow left to right.
                                Click a node to see its subtopics.
                            </p>
                        </div>
                    </div>
                    {mastery !== null && (
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-soft">
                            <div className="text-xs uppercase font-semibold tracking-wide text-slate-400">
                                Overall Mastery
                            </div>
                            <div className="text-2xl font-bold text-slate-900">
                                {Math.round(mastery.overall_mastery)}%
                            </div>
                        </div>
                    )}
                </header>

                <div className="max-w-7xl mx-auto w-full space-y-8">
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <CompetencyGraph
                            completedSubtopics={completed}
                            masteryBySubtopic={masteryBySubtopic}
                            onSelect={setSelected}
                        />
                    </motion.div>

                    {/* Adaptive next steps — only the challenge half here
                        (no struggle context yet on this page). */}
                    <RemediationPathPanel
                        subtopicId={selected?.subtopicIds[0] ?? "intro-to-database-systems"}
                        masteryBySubtopic={masteryBySubtopic}
                        completed={completed}
                        showChallenge={true}
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <CompetencyDetailCard
                            comp={selected}
                            progress={selected ? (summary.progressMap[selected.id] ?? 0) : 0}
                            completed={completed}
                        />
                        <SummaryCard
                            title="Ready to Master"
                            icon={<Sparkles size={18} className="text-emerald-500" />}
                            items={summary.next}
                            empty="Pick a starting topic from the graph above."
                            progressMap={summary.progressMap}
                            tone="emerald"
                        />
                        <SummaryCard
                            title="Locked (Need Prereqs)"
                            icon={<Lock size={18} className="text-slate-400" />}
                            items={summary.locked}
                            empty="Nothing locked — every concept is reachable."
                            progressMap={summary.progressMap}
                            tone="slate"
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}

function CompetencyDetailCard({
    comp,
    progress,
    completed,
}: {
    comp: Competency | null;
    progress: number;
    completed: Set<string>;
}) {
    if (!comp) {
        return (
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-soft min-h-[220px] flex items-center justify-center text-center">
                <p className="text-sm text-slate-400 italic">
                    Click a node above to see its subtopics and prerequisites.
                </p>
            </div>
        );
    }
    const colour = competencyColor(progress);
    return (
        <div
            className="rounded-3xl p-6 border shadow-soft"
            style={{ background: colour.bg, borderColor: colour.border }}
        >
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-bold" style={{ color: colour.text }}>
                    {comp.title}
                </h3>
                <span
                    className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: colour.text }}
                >
                    {colour.label} · {Math.round(progress * 100)}%
                </span>
            </div>
            <p className="text-sm mb-4" style={{ color: colour.text }}>
                {comp.description}
            </p>
            <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider" style={{ color: colour.text }}>
                    Subtopics
                </div>
                <ul className="space-y-1">
                    {comp.subtopicIds.map((id) => {
                        const done = completed.has(id);
                        return (
                            <li key={id} className="flex items-center gap-2 text-sm">
                                <span
                                    className="inline-block h-2.5 w-2.5 rounded-full"
                                    style={{
                                        background: done ? colour.border : "rgba(15,23,42,0.15)",
                                    }}
                                />
                                <Link
                                    href={`/study?subtopic=${id}`}
                                    className="underline-offset-2 hover:underline"
                                    style={{ color: colour.text }}
                                >
                                    {id.replace(/-/g, " ")}
                                </Link>
                                {done && (
                                    <span
                                        className="ml-auto text-[10px] font-bold uppercase"
                                        style={{ color: colour.text }}
                                    >
                                        Done
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}

function SummaryCard({
    title,
    icon,
    items,
    empty,
    progressMap,
    tone,
}: {
    title: string;
    icon: React.ReactNode;
    items: Competency[];
    empty: string;
    progressMap: Record<string, number>;
    tone: "emerald" | "slate";
}) {
    const toneClasses =
        tone === "emerald"
            ? "border-emerald-100 bg-emerald-50/40"
            : "border-slate-100 bg-white";
    return (
        <div className={`rounded-3xl p-6 border shadow-soft ${toneClasses}`}>
            <div className="flex items-center gap-2 mb-4">
                {icon}
                <h3 className="font-bold text-slate-900">{title}</h3>
                <span className="ml-auto text-xs text-slate-400">{items.length}</span>
            </div>
            {items.length === 0 ? (
                <p className="text-sm text-slate-400 italic">{empty}</p>
            ) : (
                <ul className="space-y-2">
                    {items.map((c) => {
                        const p = progressMap[c.id] ?? 0;
                        return (
                            <li key={c.id}>
                                <Link
                                    href={`/course?expand=${c.unitId ?? "dbms"}`}
                                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl hover:bg-white transition"
                                >
                                    <span className="text-sm font-medium text-slate-700">
                                        {c.title}
                                    </span>
                                    <span className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                        {Math.round(p * 100)}%
                                        <ArrowUpRight size={14} />
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
