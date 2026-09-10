"use client";

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { NeuralSidebar as Sidebar } from "@/components/neural/Sidebar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { NeuralIconButton } from "@/components/neural/NeuralIconButton";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ReviewForecastHeatmap, type ReviewForecast } from "@/components/ReviewForecastHeatmap";
import {
    Brain,
    Clock,
    Zap,
    AlertTriangle,
    TrendingDown,
    PlayCircle,
} from "lucide-react";

interface MasterySnapshot {
    user_id: string;
    overall_mastery: number;
    by_unit: { unit: string; mastery: number }[];
    weak_skills: { skill: string; score: number; attempts: number }[];
    total_skills_tracked: number;
}

interface ConfusionEvent {
    user_id?: string;
    subtopic_id?: string;
    confusion_score?: number;
}

const formatSkill = (skill: string) =>
    skill
        .split(/[_-]/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');

const statusFor = (score: number): 'Critical' | 'Recommended' | 'Good' => {
    if (score < 40) return 'Critical';
    if (score < 60) return 'Recommended';
    return 'Good';
};

const statusColor = (status: string) => {
    switch (status) {
        case 'Critical':
            return 'bg-rose-50 text-rose-600 border-rose-100';
        case 'Recommended':
            return 'bg-amber-50 text-amber-600 border-amber-100';
        case 'Good':
            return 'bg-emerald-50 text-emerald-600 border-emerald-100';
        default:
            return 'bg-slate-50 text-slate-600';
    }
};

export default function ReviewPage() {
    const { user, loading: authLoading } = useAuth();
    const [mastery, setMastery] = useState<MasterySnapshot | null>(null);
    const [confusionCount, setConfusionCount] = useState<number>(0);
    const [forecast, setForecast] = useState<ReviewForecast | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user?.uid) {
            const t = setTimeout(() => setLoading(false), 0);
            return () => clearTimeout(t);
        }

        let cancelled = false;
        Promise.all([
            apiFetch<MasterySnapshot>(`/answers/mastery/${user.uid}`).catch(() => null),
            // Fetch confusion event count via a lightweight quiz history call
            // (FE-only aggregation since /admin/dashboard is admin-scoped).
            apiFetch<{ attempts: { metrics?: { attempts?: number } }[] }>(
                `/answers/quiz-history/${user.uid}`,
            ).catch(() => ({ attempts: [] as ConfusionEvent[] })),
            apiFetch<ReviewForecast>(`/flashcards/forecast?days=30`).catch(() => null),
        ])
            .then(([m, hist, f]) => {
                if (cancelled) return;
                setMastery(m);
                // Approximate "confusion alerts" by counting failed attempts > 1
                const struggles = (hist?.attempts ?? []).filter(
                    (a: any) => (a?.metrics?.attempts ?? 0) > 1,
                ).length;
                setConfusionCount(struggles);
                setForecast(f);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [user, authLoading]);

    const overall = mastery?.overall_mastery ?? 0;
    const weakSkills = useMemo(
        () =>
            (mastery?.weak_skills ?? []).map((s) => ({
                ...s,
                title: formatSkill(s.skill),
                status: statusFor(s.score),
            })),
        [mastery],
    );

    return (
        <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
            <Sidebar className="hidden md:flex flex-shrink-0" />

            <main className="flex-1 flex flex-col p-8 md:pl-60 overflow-y-auto">
                <header className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <MobileSidebar />
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 mb-2">Smart Review</h1>
                            <p className="text-slate-500">AI-targeted practice based on your real performance.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                            <Brain size={14} /> AI Recommended
                        </span>
                        <NeuralIconButton icon={Zap} />
                    </div>
                </header>

                <div className="max-w-5xl mx-auto w-full space-y-8">
                    <ReviewForecastHeatmap forecast={forecast} loading={loading} />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100"
                        >
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-2">Overall Mastery</p>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-bold text-slate-900">{Math.round(overall)}%</span>
                                <span className="text-sm font-semibold text-slate-400 mb-1 flex items-center">
                                    <TrendingDown size={14} className="mr-1" />
                                    BKT estimate
                                </span>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100"
                        >
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-2">Weak Areas</p>
                            <span className="text-4xl font-bold text-slate-900">{weakSkills.length}</span>
                            <span className="text-sm font-medium text-slate-400 ml-2">skills below 50%</span>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-amber-50 rounded-[2rem] p-6 border border-amber-100 relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <AlertTriangle size={80} />
                            </div>
                            <p className="text-sm font-bold text-amber-600 uppercase tracking-wide mb-2">Multi-Attempt Quizzes</p>
                            <span className="text-4xl font-bold text-amber-700">{confusionCount}</span>
                            <span className="text-sm font-medium text-amber-600/80 ml-2">struggle markers</span>
                        </motion.div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <section className="col-span-1 bg-white rounded-[2rem] p-8 shadow-soft border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900 mb-6">Unit Mastery</h3>
                            {(!mastery || mastery.by_unit.length === 0) ? (
                                <p className="text-sm text-slate-400 italic">
                                    Take a quiz to start building your mastery map.
                                </p>
                            ) : (
                                <div className="space-y-6">
                                    {mastery.by_unit.map((data, i) => (
                                        <div key={data.unit}>
                                            <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                                                <span>{data.unit}</span>
                                                <span>{data.mastery}%</span>
                                            </div>
                                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                                <motion.div
                                                    className="h-full bg-teal-500 rounded-full"
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${data.mastery}%` }}
                                                    transition={{ duration: 1, delay: i * 0.1 }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className="col-span-1 lg:col-span-2 space-y-4">
                            <h3 className="text-lg font-bold text-slate-900 mb-2 pl-2">Recommended Practice</h3>

                            {loading ? (
                                [1, 2, 3].map((i) => (
                                    <div key={i} className="h-24 bg-white rounded-[2rem] animate-pulse" />
                                ))
                            ) : weakSkills.length === 0 ? (
                                <div className="bg-white rounded-[2rem] p-8 shadow-soft border border-slate-100 text-center">
                                    <p className="text-slate-500">
                                        No weak skills detected yet. Keep going to surface targeted practice.
                                    </p>
                                </div>
                            ) : (
                                weakSkills.slice(0, 8).map((concept, i) => (
                                    <motion.div
                                        key={concept.skill}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.08 }}
                                        className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100 hover:shadow-lg hover:-translate-y-0.5 transition-all group"
                                    >
                                        <div className="flex items-center gap-6">
                                            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                                                <svg className="w-full h-full transform -rotate-90">
                                                    <circle cx="32" cy="32" r="28" stroke="#f1f5f9" strokeWidth="4" fill="transparent" />
                                                    <circle
                                                        cx="32"
                                                        cy="32"
                                                        r="28"
                                                        stroke={concept.status === 'Critical' ? '#e11d48' : '#0d9488'}
                                                        strokeWidth="4"
                                                        fill="transparent"
                                                        strokeDasharray={175}
                                                        strokeDashoffset={175 - (175 * concept.score) / 100}
                                                        className="transition-all duration-1000"
                                                    />
                                                </svg>
                                                <span className="absolute text-sm font-bold text-slate-900">
                                                    {Math.round(concept.score)}%
                                                </span>
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h4 className="text-lg font-bold text-slate-900 group-hover:text-teal-600 transition-colors">
                                                        {concept.title}
                                                    </h4>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${statusColor(concept.status)}`}>
                                                        {concept.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs font-semibold text-slate-400">
                                                    <span className="font-mono">{concept.skill}</span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={12} /> {concept.attempts} attempts
                                                    </span>
                                                </div>
                                            </div>

                                            <Link href="/course" className="shrink-0">
                                                <NeuralButton variant="primary" className="bg-slate-900 text-white rounded-full px-6">
                                                    <PlayCircle size={16} className="mr-2" /> Practice
                                                </NeuralButton>
                                            </Link>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
