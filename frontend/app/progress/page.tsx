"use client";

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { NeuralSidebar as Sidebar } from "@/components/neural/Sidebar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { NeuralIconButton } from "@/components/neural/NeuralIconButton";
import { NeuralSkeleton } from "@/components/neural/NeuralSkeleton";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
    Clock,
    Target,
    BookOpen,
    Flame,
    TrendingUp,
    Zap,
    Share2,
    Calendar,
    ArrowUpRight,
    Trophy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface QuizAttempt {
    id?: string;
    score: number;
    total_questions: number;
    percentage: number;
    subtopic_id: string;
    subtopic_title?: string;
    unit_id?: string;
    timestamp?: string;
    metrics?: { total_time_ms?: number; attempts?: number };
}

interface QuizHistoryResponse {
    attempts: QuizAttempt[];
}

interface MasterySnapshot {
    overall_mastery: number;
    by_unit: { unit: string; mastery: number }[];
    weak_skills: { skill: string; score: number; attempts: number }[];
    total_skills_tracked: number;
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const formatTitleFromId = (id: string) =>
    id
        .split(/[-_]/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ');

const formatRelativeDate = (iso?: string): string => {
    if (!iso) return 'Recently';
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return 'Recently';
    const diff = Date.now() - ts;
    const day = 86400000;
    if (diff < day) return 'Today';
    if (diff < day * 2) return 'Yesterday';
    return `${Math.floor(diff / day)} days ago`;
};

const formatDuration = (ms?: number): string => {
    if (!ms) return '—';
    const minutes = Math.round(ms / 60000);
    return minutes < 1 ? '<1 min' : `${minutes} min`;
};

export default function ProgressPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
    const [mastery, setMastery] = useState<MasterySnapshot | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user?.uid) {
            const t = setTimeout(() => setLoading(false), 0);
            return () => clearTimeout(t);
        }

        let cancelled = false;
        Promise.all([
            apiFetch<QuizHistoryResponse>(`/answers/quiz-history/${user.uid}`).catch(() => ({ attempts: [] })),
            apiFetch<MasterySnapshot>(`/answers/mastery/${user.uid}`).catch(() => null),
        ])
            .then(([hist, m]) => {
                if (cancelled) return;
                setAttempts(hist?.attempts ?? []);
                setMastery(m);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [user, authLoading]);

    const stats = useMemo(() => {
        const totalMs = attempts.reduce((acc, a) => acc + (a.metrics?.total_time_ms ?? 0), 0);
        const hours = (totalMs / 3600000).toFixed(1);

        const masteryPct = mastery ? Math.round(mastery.overall_mastery) : 0;
        const completed = attempts.length;

        // Streak = number of consecutive days with at least one attempt, ending today
        const dayKeys = new Set(
            attempts
                .map((a) => (a.timestamp ? new Date(a.timestamp).toDateString() : null))
                .filter(Boolean) as string[],
        );
        let streak = 0;
        const cursor = new Date();
        while (dayKeys.has(cursor.toDateString())) {
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
        }

        return [
            { label: 'Hours Focused', value: hours, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-50' },
            { label: 'Topics Mastered', value: `${masteryPct}%`, icon: Target, color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { label: 'Quizzes Taken', value: String(completed), icon: BookOpen, color: 'text-purple-500', bg: 'bg-purple-50' },
            { label: 'Day Streak', value: String(streak), icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50' },
        ];
    }, [attempts, mastery]);

    const weeklyActivity = useMemo(() => {
        const buckets = Array(7).fill(0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        attempts.forEach((a) => {
            if (!a.timestamp) return;
            const ts = new Date(a.timestamp).getTime();
            if (Number.isNaN(ts)) return;
            const dayDiff = Math.floor((today.getTime() - ts) / 86400000);
            if (dayDiff < 0 || dayDiff >= 7) return;
            const dayIdx = (today.getDay() - dayDiff + 7) % 7;
            const minutes = (a.metrics?.total_time_ms ?? 0) / 60000;
            buckets[dayIdx] += minutes;
        });
        const max = Math.max(...buckets, 1);
        return buckets.map((m) => ({ minutes: Math.round(m), height: Math.round((m / max) * 100) }));
    }, [attempts]);

    const recentActivity = useMemo(
        () =>
            attempts.slice(0, 6).map((a) => ({
                date: formatRelativeDate(a.timestamp),
                topic: a.subtopic_title || formatTitleFromId(a.subtopic_id || 'topic'),
                duration: formatDuration(a.metrics?.total_time_ms),
                mastery: Math.round(a.percentage ?? 0),
            })),
        [attempts],
    );

    if (loading) {
        return (
            <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
                <Sidebar className="hidden md:flex flex-shrink-0" />
                <main className="flex-1 flex flex-col p-8 md:pl-60 overflow-y-auto">
                    <header className="flex items-center justify-between mb-10">
                        <div className="space-y-2">
                            <NeuralSkeleton className="h-8 w-48 rounded-xl" />
                            <NeuralSkeleton className="h-4 w-64" />
                        </div>
                    </header>
                    <div className="max-w-6xl mx-auto w-full space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            {[1, 2, 3, 4].map((i) => (
                                <NeuralSkeleton key={i} className="h-32 rounded-[2rem]" />
                            ))}
                        </div>
                    </div>
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
                            <h1 className="text-3xl font-bold text-slate-900 mb-2">Neural Analytics</h1>
                            <p className="text-slate-500">Track your cognitive growth and milestones.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <NeuralButton
                            variant="glass"
                            className="bg-white border border-slate-200 text-slate-600 hover:text-slate-900"
                            onClick={() =>
                                toast({
                                    title: '📊 Report',
                                    description: 'Export coming soon — your data is being saved continuously.',
                                })
                            }
                        >
                            <Share2 size={16} className="mr-2" />
                            Export Report
                        </NeuralButton>
                        <NeuralIconButton icon={Calendar} />
                    </div>
                </header>

                <div className="max-w-6xl mx-auto w-full space-y-8">
                    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {stats.map((stat, i) => (
                            <motion.div
                                key={stat.label}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.08 }}
                                className="bg-white rounded-[2rem] p-6 shadow-soft hover:shadow-soft-lg transition-all border border-slate-100 group"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`w-12 h-12 rounded-2xl ${stat.bg} flex items-center justify-center ${stat.color} transition-transform group-hover:scale-110`}>
                                        <stat.icon size={24} />
                                    </div>
                                    <ArrowUpRight size={20} className="text-slate-300 group-hover:text-slate-500" />
                                </div>
                                <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</div>
                                <div className="text-sm text-slate-500 font-medium">{stat.label}</div>
                            </motion.div>
                        ))}
                    </section>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <section className="lg:col-span-2 bg-white rounded-[2rem] p-8 shadow-soft border border-slate-100">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <TrendingUp size={20} className="text-teal-500" />
                                    Weekly Activity
                                </h3>
                                <span className="text-xs font-semibold text-slate-400">Last 7 Days (in minutes)</span>
                            </div>

                            <div className="h-64 flex items-end justify-between gap-4">
                                {weeklyActivity.map((bar, i) => (
                                    <div key={days[i]} className="flex-1 flex flex-col items-center gap-3 h-full justify-end group">
                                        <div className="relative w-full flex justify-center">
                                            <div className="absolute -top-10 bg-slate-800 text-white text-xs py-1 px-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                {bar.minutes} mins
                                            </div>
                                            <motion.div
                                                className="w-full max-w-[40px] bg-slate-100 rounded-t-xl group-hover:bg-teal-500 transition-colors duration-300 relative overflow-hidden"
                                                initial={{ height: 0 }}
                                                animate={{ height: `${bar.height}%` }}
                                                transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                                            >
                                                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
                                            </motion.div>
                                        </div>
                                        <span className="text-xs font-semibold text-slate-400">{days[i]}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="col-span-1 bg-white rounded-[2rem] p-8 shadow-soft border border-slate-100 flex flex-col">
                            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Zap size={20} className="text-amber-500" />
                                Recent Activity
                            </h3>

                            {recentActivity.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">
                                    No quiz attempts yet — finish a topic quiz to see your history here.
                                </p>
                            ) : (
                                <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                                    {recentActivity.map((activity, i) => (
                                        <div
                                            key={`${activity.topic}-${i}`}
                                            className="relative pl-6 pb-6 border-l border-slate-100 last:pb-0 last:border-0"
                                        >
                                            <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-slate-200 ring-4 ring-white" />
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                                                    {activity.date}
                                                </span>
                                                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                    {activity.duration}
                                                </span>
                                            </div>
                                            <h4 className="text-slate-900 font-bold mb-2">{activity.topic}</h4>
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${activity.mastery}%` }} />
                                                </div>
                                                <span className="text-xs font-bold text-teal-600">{activity.mastery}%</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    <section className="bg-white rounded-[2rem] p-8 shadow-soft border border-slate-100">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Trophy size={20} className="text-purple-500" />
                                Skill Mastery
                            </h3>
                            <span className="text-sm font-medium text-slate-500">
                                {mastery?.total_skills_tracked ?? 0} skills tracked
                            </span>
                        </div>

                        {(!mastery || mastery.by_unit.length === 0) ? (
                            <p className="text-sm text-slate-400 italic">
                                Mastery data unlocks after your first quiz attempt.
                            </p>
                        ) : (
                            <div className="space-y-5">
                                {mastery.by_unit.map((u, i) => (
                                    <div key={u.unit}>
                                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                                            <span>{u.unit}</span>
                                            <span>{u.mastery}%</span>
                                        </div>
                                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-teal-500 rounded-full"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${u.mastery}%` }}
                                                transition={{ duration: 0.8, delay: i * 0.1 }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>
    );
}
