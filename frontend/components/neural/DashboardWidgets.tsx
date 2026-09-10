"use client";

import React, { useEffect, useState } from "react";
import { Flame, Target, Clock, Zap, Calendar, Edit, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/* ─── Streak Widget ─────────────────────────────────────────────────────── */

interface QuizAttempt {
    timestamp?: string;
}

function computeStreak(attempts: QuizAttempt[]): { streak: number; weekActivity: boolean[] } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayMs = 86400000;

    // Build a set of active day offsets (0 = today, 1 = yesterday, ...)
    const activeDays = new Set<number>();
    for (const a of attempts) {
        if (!a.timestamp) continue;
        const d = new Date(a.timestamp);
        d.setHours(0, 0, 0, 0);
        const offset = Math.round((today.getTime() - d.getTime()) / dayMs);
        if (offset >= 0 && offset < 30) activeDays.add(offset);
    }

    // Streak: consecutive days starting from today (or yesterday if today not yet active)
    let streak = 0;
    const start = activeDays.has(0) ? 0 : 1;
    for (let i = start; i < 30; i++) {
        if (activeDays.has(i)) streak++;
        else break;
    }

    // Week activity (Mon=0 ... Sun=6) for the current week
    const dayOfWeek = (today.getDay() + 6) % 7; // shift so Mon=0
    const weekActivity: boolean[] = [];
    for (let i = 0; i < 7; i++) {
        const offset = dayOfWeek - i;
        weekActivity.push(offset >= 0 ? activeDays.has(offset) : false);
    }
    return { streak, weekActivity };
}

export function StreakWidget() {
    const { user } = useAuth();
    const [streak, setStreak] = useState(0);
    const [week, setWeek] = useState<boolean[]>(Array(7).fill(false));

    useEffect(() => {
        if (!user?.uid) return;
        apiFetch<{ attempts: QuizAttempt[] }>(`/answers/quiz-history/${user.uid}`)
            .then((res) => {
                const { streak: s, weekActivity } = computeStreak(res.attempts ?? []);
                setStreak(s);
                setWeek(weekActivity);
            })
            .catch(() => { /* non-critical */ });
    }, [user]);

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 cursor-help transition-colors hover:border-orange-200">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                                    <Flame size={20} fill="currentColor" />
                                </div>
                                <span className="font-bold text-slate-700">Daily Streak</span>
                            </div>
                            <span className="text-2xl font-bold text-slate-900">{streak}</span>
                        </div>

                        <div className="flex justify-between items-end h-16 gap-2">
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                                    <div className={cn(
                                        "w-full rounded-full transition-all",
                                        week[i] ? "bg-orange-500 h-10" : "bg-slate-100 h-3"
                                    )} />
                                    <span className="text-[10px] font-bold text-slate-400">{day}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{streak > 0 ? `You're on a ${streak}-day streak! Keep it up!` : "Complete a quiz today to start a streak!"}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/* ─── Daily Goal Widget ─────────────────────────────────────────────────── */

export function DailyGoalWidget() {
    const { user } = useAuth();
    const [minutes, setMinutes] = useState(0);
    const goal = 60; // 60 min daily goal

    useEffect(() => {
        if (!user?.uid) return;
        // Sum today's behavior_log time_ms
        apiFetch<{ attempts: { timestamp?: string; metrics?: { total_time_ms?: number } }[] }>(
            `/answers/quiz-history/${user.uid}`
        )
            .then((res) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                let totalMs = 0;
                for (const a of res.attempts ?? []) {
                    if (!a.timestamp) continue;
                    const d = new Date(a.timestamp);
                    if (d >= today) totalMs += a.metrics?.total_time_ms ?? 0;
                }
                setMinutes(Math.round(totalMs / 60000));
            })
            .catch(() => { });
    }, [user]);

    const pct = Math.min(100, Math.round((minutes / goal) * 100));

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 cursor-help transition-colors hover:border-blue-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                <Target size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800">Daily Goal</h3>
                                <p className="text-xs text-slate-500">{minutes}/{goal} mins today</p>
                            </div>
                        </div>

                        <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="absolute top-0 left-0 h-full bg-blue-600 rounded-full transition-all duration-700"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                        <p className="mt-3 text-xs font-medium text-slate-400 text-center">
                            {pct >= 100 ? "Goal reached! Great work." : pct >= 50 ? "Keep it up! Almost there." : "Start a quiz to build momentum."}
                        </p>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Track your daily learning time goal.</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/* ─── Recent Activity Widget ────────────────────────────────────────────── */

interface ActivityItem {
    title: string;
    time: string;
    color: string;
}

function formatRelative(iso?: string): string {
    if (!iso) return "Recently";
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "Just now";
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d === 1) return "Yesterday";
    return `${d} days ago`;
}

const COLORS = ["bg-emerald-500", "bg-blue-500", "bg-purple-500", "bg-amber-500"];

export function RecentActivityWidget() {
    const { user } = useAuth();
    const [items, setItems] = useState<ActivityItem[]>([]);

    useEffect(() => {
        if (!user?.uid) return;
        apiFetch<{ attempts: { subtopic_title?: string; subtopic_id?: string; timestamp?: string }[] }>(
            `/answers/quiz-history/${user.uid}`
        )
            .then((res) => {
                const sorted = (res.attempts ?? [])
                    .filter((a) => a.timestamp)
                    .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime())
                    .slice(0, 4);
                setItems(
                    sorted.map((a, i) => ({
                        title: a.subtopic_title || a.subtopic_id || "Quiz",
                        time: formatRelative(a.timestamp),
                        color: COLORS[i % COLORS.length],
                    })),
                );
            })
            .catch(() => { });
    }, [user]);

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 cursor-help transition-colors hover:border-purple-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                                <Clock size={20} />
                            </div>
                            <h3 className="font-bold text-slate-800">Recent Activity</h3>
                        </div>

                        <div className="space-y-4 relative">
                            <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-100" />
                            {items.length === 0 ? (
                                <p className="text-xs text-slate-400 pl-8">No activity yet. Take a quiz!</p>
                            ) : (
                                items.map((item, i) => (
                                    <div key={i} className="relative flex items-center gap-4">
                                        <div className={cn("w-2.5 h-2.5 rounded-full ring-4 ring-white z-10", item.color)} />
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{item.title}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{item.time}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Your history of engaged topics.</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/* ─── Focus Energy Widget ───────────────────────────────────────────────── */

export function FocusEnergyWidget() {
    const { user } = useAuth();
    const [score, setScore] = useState(0);
    const [bars, setBars] = useState<number[]>(Array(12).fill(10));

    useEffect(() => {
        if (!user?.uid) return;
        apiFetch<{ attempts: { percentage?: number; timestamp?: string }[] }>(
            `/answers/quiz-history/${user.uid}`
        )
            .then((res) => {
                const sorted = (res.attempts ?? [])
                    .filter((a) => a.timestamp)
                    .sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime())
                    .slice(-12);
                if (sorted.length === 0) return;
                const vals = sorted.map((a) => a.percentage ?? 50);
                setBars(vals);
                // Focus score = avg of last 5 quiz percentages
                const recent = vals.slice(-5);
                setScore(Math.round(recent.reduce((s, v) => s + v, 0) / recent.length));
            })
            .catch(() => { });
    }, [user]);

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 cursor-help transition-colors hover:border-amber-200">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-50 text-amber-500 rounded-xl">
                                    <Zap size={20} fill="currentColor" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">Focus Energy</h3>
                                    <p className="text-xs text-slate-500">Recent quiz performance</p>
                                </div>
                            </div>
                            <span className="text-xl font-bold text-slate-900">{score}%</span>
                        </div>

                        <div className="flex items-end justify-between h-24 gap-1">
                            {bars.map((h, i) => (
                                <div key={i} className="relative w-full bg-slate-100 rounded-t-sm overflow-hidden h-full">
                                    <div
                                        className="absolute bottom-0 w-full bg-amber-400 transition-all duration-1000"
                                        style={{ height: `${h}%` }}
                                    />
                                </div>
                            ))}
                        </div>
                        <p className="mt-3 text-[10px] text-slate-400 text-center uppercase tracking-wide font-semibold">
                            {score >= 80 ? "You're in the zone!" : score >= 50 ? "Solid momentum" : "Warming up"}
                        </p>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Estimated focus based on recent quiz accuracy.</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

/* ─── Upcoming Deadlines Widget ─────────────────────────────────────────── */

export function UpcomingDeadlinesWidget() {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="bg-white rounded-3xl p-6 border border-slate-200 cursor-help transition-colors hover:border-rose-200 relative group">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-50 text-rose-500 rounded-xl">
                                    <Calendar size={20} />
                                </div>
                                <h3 className="font-bold text-slate-800">Upcoming Deadlines</h3>
                            </div>

                            <Dialog>
                                <DialogTrigger asChild>
                                    <button
                                        className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Edit size={16} />
                                    </button>
                                </DialogTrigger>
                                <DialogContent onClick={(e) => e.stopPropagation()}>
                                    <DialogHeader>
                                        <DialogTitle>Edit Deadlines</DialogTitle>
                                    </DialogHeader>
                                    <div className="py-4 space-y-4">
                                        <p className="text-sm text-slate-500">Manage your upcoming assignment deadlines.</p>
                                        <div className="space-y-3">
                                            {[
                                                { title: "Quiz 3: Normalization", due: "Tomorrow, 11:59 PM" },
                                                { title: "Project Proposal", due: "Jan 12" },
                                                { title: "Weekly Reflection", due: "Jan 15" },
                                            ].map((item, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        defaultValue={item.title}
                                                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                                                    />
                                                    <input
                                                        type="text"
                                                        defaultValue={item.due}
                                                        className="w-32 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                                                    />
                                                </div>
                                            ))}
                                            <button className="text-xs font-bold text-slate-900 hover:text-slate-700 flex items-center gap-1 mt-2">
                                                <Plus size={14} /> Add Deadline
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <NeuralButton variant="ghost">Cancel</NeuralButton>
                                        <NeuralButton variant="primary" className="bg-slate-900 text-white hover:bg-slate-900 shadow-none border-none">Save Changes</NeuralButton>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <div className="space-y-3">
                            {[
                                { title: "Quiz 3: Normalization", due: "Tomorrow, 11:59 PM", urgency: "high" },
                                { title: "Project Proposal", due: "Jan 12", urgency: "medium" },
                                { title: "Weekly Reflection", due: "Jan 15", urgency: "low" },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-slate-200 transition-colors bg-slate-50/50">
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">{item.title}</p>
                                        <p className="text-[10px] text-slate-500 font-medium">{item.due}</p>
                                    </div>
                                    <div className={cn(
                                        "w-2 h-2 rounded-full",
                                        item.urgency === "high" ? "bg-rose-500" :
                                            item.urgency === "medium" ? "bg-amber-500" : "bg-emerald-500"
                                    )} />
                                </div>
                            ))}
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Your upcoming assignments and quizzes.</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
