"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
    Users,
    ArrowLeft,
    UserMinus,
    AlertTriangle,
    Copy,
    Check,
} from "lucide-react";
import type { ClassDetail, ClassRoster } from "@/types";

function masteryColor(score: number) {
    if (score >= 70) return "text-emerald-700 bg-emerald-50 border-emerald-100";
    if (score >= 40) return "text-amber-700 bg-amber-50 border-amber-100";
    return "text-rose-700 bg-rose-50 border-rose-100";
}

export default function ClassRosterPage() {
    const params = useParams<{ id: string }>();
    const classId = params?.id;
    const router = useRouter();
    const { profile, loading: authLoading } = useAuth();

    const [meta, setMeta] = useState<ClassDetail | null>(null);
    const [roster, setRoster] = useState<ClassRoster | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [removing, setRemoving] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (authLoading || !profile) return;
        if (!classId) return;
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile, authLoading, classId]);

    async function load() {
        if (!classId) return;
        setLoading(true);
        setError("");
        try {
            const [m, r] = await Promise.all([
                apiFetch<ClassDetail>(`/classes/${classId}`),
                apiFetch<ClassRoster>(`/classes/${classId}/students`),
            ]);
            setMeta(m);
            setRoster(r);
        } catch (err: unknown) {
            console.error(err);
            setError(
                "Could not load this class. You may not be the owner.",
            );
        } finally {
            setLoading(false);
        }
    }

    async function copyCode() {
        if (!meta?.join_code) return;
        try {
            await navigator.clipboard.writeText(meta.join_code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // ignore
        }
    }

    async function handleRemove(uid: string) {
        if (!classId) return;
        setRemoving(uid);
        try {
            await apiFetch(`/classes/${classId}/students/${uid}`, {
                method: "DELETE",
            });
            setRoster((prev) =>
                prev
                    ? {
                        ...prev,
                        students: prev.students.filter((s) => s.user_id !== uid),
                        count: Math.max(0, prev.count - 1),
                    }
                    : prev,
            );
        } catch (err) {
            console.error(err);
        } finally {
            setRemoving(null);
        }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <Link
                href="/teacher/classes"
                className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-6"
            >
                <ArrowLeft className="w-4 h-4" /> All classes
            </Link>

                {loading ? (
                    <div className="space-y-4">
                        <div className="h-16 rounded-2xl bg-white/60 border border-slate-100 animate-pulse" />
                        <div className="h-64 rounded-3xl bg-white/60 border border-slate-100 animate-pulse" />
                    </div>
                ) : error ? (
                    <div className="p-6 rounded-3xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5" /> {error}
                    </div>
                ) : meta && roster ? (
                    <>
                        <header className="flex items-start justify-between mb-8 gap-6 flex-wrap">
                            <div>
                                <h1 className="text-3xl font-bold text-slate-900 mb-1">
                                    {meta.name}
                                </h1>
                                {meta.description ? (
                                    <p className="text-slate-500">{meta.description}</p>
                                ) : null}
                                <div className="flex items-center gap-2 mt-3 text-xs font-bold text-slate-500">
                                    <Users className="w-4 h-4" /> {roster.count} student
                                    {roster.count === 1 ? "" : "s"}
                                </div>
                            </div>
                            {meta.join_code && (
                                <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-900 text-white">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                                            Join code
                                        </p>
                                        <p className="text-xl font-bold font-mono tracking-widest">
                                            {meta.join_code}
                                        </p>
                                    </div>
                                    <button
                                        onClick={copyCode}
                                        className="px-3 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold inline-flex items-center gap-2"
                                    >
                                        {copied ? (
                                            <>
                                                <Check className="w-4 h-4 text-emerald-600" /> Copied
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" /> Copy
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </header>

                        <section className="rounded-3xl bg-white border border-slate-200 overflow-hidden">
                            {roster.students.length === 0 ? (
                                <div className="p-12 text-center text-slate-500">
                                    No students have joined yet. Share the join code above.
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    <div className="grid grid-cols-12 gap-4 px-6 py-3 text-[10px] uppercase tracking-widest font-bold text-slate-400 bg-slate-50">
                                        <div className="col-span-5">Student</div>
                                        <div className="col-span-3">Mastery</div>
                                        <div className="col-span-3">Weak topics</div>
                                        <div className="col-span-1 text-right">Actions</div>
                                    </div>
                                    {roster.students.map((s) => (
                                        <div
                                            key={s.user_id}
                                            className="grid grid-cols-12 gap-4 px-6 py-4 items-center"
                                        >
                                            <div className="col-span-5">
                                                <p className="font-bold text-slate-900">{s.full_name}</p>
                                                <p className="text-xs text-slate-500">
                                                    {s.email || s.user_id}
                                                </p>
                                            </div>
                                            <div className="col-span-3">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${masteryColor(
                                                        s.overall_mastery,
                                                    )}`}
                                                >
                                                    {s.overall_mastery.toFixed(0)}%
                                                </span>
                                            </div>
                                            <div className="col-span-3">
                                                {s.weak_skills.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {s.weak_skills.map((w) => (
                                                            <span
                                                                key={w.skill}
                                                                className="text-[10px] font-mono uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full"
                                                            >
                                                                {w.skill}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </div>
                                            <div className="col-span-1 text-right">
                                                <button
                                                    onClick={() => handleRemove(s.user_id)}
                                                    disabled={removing === s.user_id}
                                                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40"
                                                    title="Remove student"
                                                >
                                                    <UserMinus className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        <div className="mt-8 flex justify-end">
                            <Link href="/teacher/dashboard">
                                <NeuralButton variant="glass">
                                    Open cohort dashboard
                                </NeuralButton>
                            </Link>
                        </div>
                    </>
                ) : null}
        </div>
    );
}
