"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { apiFetch } from '@/lib/api';
import { NeuralButton } from "@/components/neural/NeuralButton";
import {
    Users,
    AlertTriangle,
    TrendingUp,
    Brain,
    FlaskConical,
    FileText,
    GraduationCap,
    Clock,
    Zap
} from "lucide-react";
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardData } from '@/types';
import { CohortCompetencyPanel, type CohortBreakdown } from '@/components/CohortCompetencyPanel';
import { ConfusionTimelinePanel, type ConfusionTimeline } from '@/components/ConfusionTimelinePanel';
import { DBMS_COMPETENCIES } from '@/lib/competencies';
import { humaniseSubtopicId } from '@/lib/adaptive/pathBranching';

const SUBTOPIC_OPTIONS = DBMS_COMPETENCIES.flatMap((c) =>
    c.subtopicIds.map((id) => ({
        id,
        title: `${c.title} · ${humaniseSubtopicId(id)}`,
    })),
);

export default function TeacherDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [cohort, setCohort] = useState<CohortBreakdown | null>(null);
    const [loading, setLoading] = useState(true);
    const [cohortLoading, setCohortLoading] = useState(true);

    const [timelineSubtopic, setTimelineSubtopic] = useState<string>(
        SUBTOPIC_OPTIONS[0]?.id ?? "intro-to-database-systems",
    );
    const [timeline, setTimeline] = useState<ConfusionTimeline | null>(null);
    const [timelineLoading, setTimelineLoading] = useState(true);

    useEffect(() => {
        apiFetch<DashboardData>('/admin/dashboard')
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));

        apiFetch<CohortBreakdown>('/admin/cohort/competencies')
            .then(setCohort)
            .catch(console.error)
            .finally(() => setCohortLoading(false));
    }, []);

    useEffect(() => {
        let cancelled = false;
        setTimelineLoading(true);
        apiFetch<ConfusionTimeline>(
            `/admin/subtopic/${timelineSubtopic}/confusion-timeline?days=30&bins=20`,
        )
            .then((d) => {
                if (!cancelled) setTimeline(d);
            })
            .catch((err) => {
                console.error(err);
                if (!cancelled) setTimeline(null);
            })
            .finally(() => {
                if (!cancelled) setTimelineLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [timelineSubtopic]);

    const getConfusionColor = (score: number) => {
        if (score > 0.7) return 'bg-rose-100 text-rose-700';
        if (score > 0.4) return 'bg-amber-100 text-amber-700';
        return 'bg-emerald-100 text-emerald-700';
    };

    return (
        <TooltipProvider delayDuration={300}>
            <div className="p-8 max-w-7xl mx-auto">
                {/* Header */}
                <header className="flex items-center justify-between mb-10">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-2">Teacher Overview</h1>
                        <p className="text-slate-500">Monitor student progress and interventions.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                            <GraduationCap size={14} /> Instructor Mode
                        </span>
                        <NeuralButton variant="glass" className="bg-white border text-slate-600 hover:text-slate-900">
                            Export Data
                        </NeuralButton>
                    </div>
                </header>

                <div className="space-y-8">

                        {loading ? (
                            <div className="grid grid-cols-4 gap-6 animate-pulse">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="h-32 rounded-[2rem] bg-white/50" />
                                ))}
                            </div>
                        ) : !data ? (
                            <div className="p-8 rounded-[2rem] bg-rose-50 text-rose-600 border border-rose-100 flex items-center gap-3">
                                <AlertTriangle />
                                Failed to load system data. Is the backend running?
                            </div>
                        ) : (
                            <>
                                {/* Quick Actions */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <Link href="/admin/ml-monitor" className="group">
                                        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100 hover:shadow-lg transition-all h-full">
                                            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <Brain size={24} />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-1">ML Models</h3>
                                            <p className="text-sm text-slate-500">Check inference engine health</p>
                                        </div>
                                    </Link>

                                    <Link href="/admin/experiment" className="group">
                                        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100 hover:shadow-lg transition-all h-full">
                                            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <FlaskConical size={24} />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-1">Experiments</h3>
                                            <p className="text-sm text-slate-500">Manage A/B tests & Bandits</p>
                                        </div>
                                    </Link>

                                    <Link href="/admin/content" className="group">
                                        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100 hover:shadow-lg transition-all h-full">
                                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <FileText size={24} />
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-900 mb-1">Curriculum</h3>
                                            <p className="text-sm text-slate-500">Update course materials</p>
                                        </div>
                                    </Link>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100"
                                    >
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                                                <Users size={20} />
                                            </div>
                                            <span className="text-xs font-bold text-slate-400 uppercase">Enrolled</span>
                                        </div>
                                        <p className="text-4xl font-bold text-slate-900">{data.total_students}</p>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 }}
                                        className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100"
                                    >
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 rounded-xl bg-amber-50 text-amber-500">
                                                <AlertTriangle size={20} />
                                            </div>
                                            <span className="text-xs font-bold text-slate-400 uppercase">Confused</span>
                                        </div>
                                        <p className="text-4xl font-bold text-slate-900">{data.confused_students}</p>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100"
                                    >
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-500">
                                                <TrendingUp size={20} />
                                            </div>
                                            <span className="text-xs font-bold text-slate-400 uppercase">Mastery</span>
                                        </div>
                                        <p className="text-4xl font-bold text-slate-900">{data.avg_mastery}%</p>
                                    </motion.div>

                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.3 }}
                                        className="bg-white rounded-[2rem] p-6 shadow-soft border border-slate-100"
                                    >
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="p-2 rounded-xl bg-blue-50 text-blue-500">
                                                <FlaskConical size={20} />
                                            </div>
                                            <span className="text-xs font-bold text-slate-400 uppercase">Active Tests</span>
                                        </div>
                                        <p className="text-4xl font-bold text-slate-900">{data.active_experiments}</p>
                                    </motion.div>
                                </div>

                                {/* Cohort Competency Map (M4) */}
                                <CohortCompetencyPanel
                                    data={cohort}
                                    loading={cohortLoading}
                                />

                                {/* Per-subtopic confusion timeline (L4) */}
                                <ConfusionTimelinePanel
                                    data={timeline}
                                    loading={timelineLoading}
                                    subtopicOptions={SUBTOPIC_OPTIONS}
                                    onSubtopicChange={setTimelineSubtopic}
                                />

                                {/* Recent Interventions */}
                                <section className="bg-white rounded-[2rem] p-8 shadow-soft border border-slate-100">
                                    <div className="flex items-center gap-3 mb-6">
                                        <Zap className="text-amber-500" size={20} />
                                        <h2 className="text-lg font-bold text-slate-900">Live Intervention Feed</h2>
                                    </div>

                                    <div className="space-y-4">
                                        {data.recent_interventions && data.recent_interventions.length > 0 ? (
                                            data.recent_interventions.slice(0, 5).map((intervention, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-transparent hover:border-slate-200 transition-colors"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs">
                                                            S{i + 1}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-slate-900 text-sm">{intervention.user_id}</p>
                                                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                                                <Clock size={10} /> Just now in <span className="font-semibold text-slate-600">{intervention.subtopic}</span>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="text-right">
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getConfusionColor(intervention.confusion_score)}`}>
                                                            {(intervention.confusion_score * 100).toFixed(0)}% Confused
                                                        </span>
                                                        <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wide font-semibold">
                                                            Action: {intervention.bandit_arm_selected}
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            ))
                                        ) : (
                                            <div className="p-12 text-center text-slate-400 italic">
                                                No interventions recorded yet...
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </>
                        )}
                    </div>
                </div>
        </TooltipProvider>
    );
}
