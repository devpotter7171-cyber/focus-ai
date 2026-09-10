"use client";

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { CheckCircle2, Loader2, AlertTriangle, FileUp, Sparkles, BookOpen } from "lucide-react";
import { NeuralButton } from "../neural/NeuralButton";
import { NeuralCard } from "../neural/NeuralCard";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

interface ProgressEvent {
    stage: string;
    message: string;
    progress: number;
    payload?: Record<string, any>;
}

interface PersistedSummary {
    course_id: string;
    units: number;
    subtopics: number;
    questions: number;
}

const STAGE_LABEL: Record<string, string> = {
    extract: "Reading PDF",
    outline: "Building Outline",
    subtopics: "Designing Subtopics",
    content: "Writing Content",
    questions: "Drafting Questions",
    persist: "Saving",
    persisted: "Saved",
    done: "Compiled",
    error: "Error",
};

export const CourseGenerator: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [courseName, setCourseName] = useState("");
    const [running, setRunning] = useState(false);
    const [events, setEvents] = useState<ProgressEvent[]>([]);
    const [summary, setSummary] = useState<PersistedSummary | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [publishing, setPublishing] = useState(false);
    const [published, setPublished] = useState(false);

    const abortRef = useRef<AbortController | null>(null);
    const { toast } = useToast();

    const lastEvent = events[events.length - 1];
    const progressPct = Math.round(((lastEvent?.progress ?? 0) * 100));

    const reset = () => {
        setEvents([]);
        setSummary(null);
        setErrorMsg(null);
        setPublished(false);
    };

    const handleUpload = async () => {
        if (!file || !courseName.trim()) {
            toast({
                title: "Missing info",
                description: "Provide both a course name and a PDF.",
                variant: "destructive",
            });
            return;
        }

        reset();
        setRunning(true);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const { auth } = await import("@/lib/firebase");
            const token = await auth.currentUser?.getIdToken();

            const formData = new FormData();
            formData.append("file", file);
            formData.append("course_name", courseName.trim());

            const response = await fetch(`${API_BASE}/admin/upload-pdf`, {
                method: "POST",
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                body: formData,
                signal: controller.signal,
            });

            if (!response.ok || !response.body) {
                throw new Error(`Upload failed (${response.status})`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                // SSE frames are separated by \n\n
                const frames = buffer.split("\n\n");
                buffer = frames.pop() ?? "";

                for (const frame of frames) {
                    const line = frame.split("\n").find((l) => l.startsWith("data:"));
                    if (!line) continue;
                    try {
                        const parsed = JSON.parse(line.slice(5).trim()) as ProgressEvent;
                        setEvents((prev) => [...prev, parsed]);

                        if (parsed.stage === "persisted" && parsed.payload?.summary) {
                            setSummary(parsed.payload.summary as PersistedSummary);
                        }
                        if (parsed.stage === "error") {
                            setErrorMsg(parsed.message);
                        }
                    } catch (err) {
                        console.warn("Bad SSE frame:", line);
                    }
                }
            }
        } catch (err: unknown) {
            if ((err as Error).name === "AbortError") return;
            const msg = (err as Error).message || "Generation failed";
            setErrorMsg(msg);
            toast({ title: "Generation failed", description: msg, variant: "destructive" });
        } finally {
            setRunning(false);
            abortRef.current = null;
        }
    };

    const handleCancel = () => {
        abortRef.current?.abort();
        setRunning(false);
        toast({ title: "Cancelled", description: "Generation was aborted." });
    };

    const handlePublish = async () => {
        if (!summary) return;
        setPublishing(true);
        try {
            await apiFetch(`/admin/courses/${summary.course_id}/publish`, { method: "POST" });
            setPublished(true);
            toast({ title: "Published", description: "Course is now visible to students." });
        } catch (err: unknown) {
            toast({
                title: "Publish failed",
                description: (err as Error).message,
                variant: "destructive",
            });
        } finally {
            setPublishing(false);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto space-y-8">
            <div className="text-center space-y-2">
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">AI Course Architect</h2>
                <p className="text-slate-500">
                    Upload a textbook PDF — Focus-AI will produce units, multi-level lessons, and quizzes.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input column */}
                <NeuralCard className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Course Name</label>
                        <input
                            type="text"
                            value={courseName}
                            onChange={(e) => setCourseName(e.target.value)}
                            placeholder="e.g. Database Systems 101"
                            disabled={running}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 focus:border-cyan-500 outline-none transition-colors disabled:opacity-50"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Material (PDF)</label>
                        <div className="relative border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center hover:border-cyan-400 transition-colors cursor-pointer group">
                            <input
                                type="file"
                                accept="application/pdf,.pdf"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                disabled={running}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <FileUp className="mx-auto mb-2 text-slate-400 group-hover:text-cyan-500 transition-colors" size={28} />
                            <div className="text-sm font-medium text-slate-600 group-hover:text-cyan-600 transition-colors">
                                {file ? file.name : "Click or drag a PDF here"}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Up to 10 MB. Text-based PDFs work best.</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <NeuralButton
                            onClick={handleUpload}
                            disabled={running || !file || !courseName.trim()}
                            className="flex-1 h-12 bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:hover:bg-slate-300"
                        >
                            {running ? (
                                <>
                                    <Loader2 className="animate-spin mr-2" size={16} />
                                    Architecting…
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} className="mr-2" />
                                    Generate Course
                                </>
                            )}
                        </NeuralButton>
                        {running && (
                            <NeuralButton variant="ghost" onClick={handleCancel}>
                                Cancel
                            </NeuralButton>
                        )}
                    </div>
                </NeuralCard>

                {/* Stream + summary column */}
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase">Pipeline Progress</h3>

                    <NeuralCard className="p-6 min-h-[260px]">
                        {events.length === 0 && !errorMsg ? (
                            <div className="text-sm text-slate-400 italic h-full flex items-center justify-center">
                                Waiting for material ingestion…
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                                    <span>{STAGE_LABEL[lastEvent?.stage ?? ""] ?? lastEvent?.stage}</span>
                                    <span>{progressPct}%</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                                    <motion.div
                                        className="h-full bg-cyan-500"
                                        animate={{ width: `${progressPct}%` }}
                                        transition={{ ease: "easeOut", duration: 0.3 }}
                                    />
                                </div>

                                <ul className="text-xs text-slate-500 space-y-1 max-h-40 overflow-auto pr-1">
                                    <AnimatePresence initial={false}>
                                        {events.slice(-8).map((ev, i) => (
                                            <motion.li
                                                key={`${ev.stage}-${i}`}
                                                initial={{ opacity: 0, x: -8 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className={`flex gap-2 items-start ${ev.stage === "error" ? "text-rose-600" : ""}`}
                                            >
                                                <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 min-w-[80px]">
                                                    {STAGE_LABEL[ev.stage] ?? ev.stage}
                                                </span>
                                                <span>{ev.message}</span>
                                            </motion.li>
                                        ))}
                                    </AnimatePresence>
                                </ul>
                            </div>
                        )}
                    </NeuralCard>

                    {errorMsg && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-700 text-sm">
                            <AlertTriangle size={16} />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {summary && (
                        <NeuralCard className="p-6 border-emerald-100 bg-emerald-50/50">
                            <div className="flex items-center gap-2 mb-4">
                                <CheckCircle2 size={20} className="text-emerald-600" />
                                <h4 className="font-bold text-slate-900">Curriculum ready</h4>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <Stat label="Units" value={summary.units} />
                                <Stat label="Subtopics" value={summary.subtopics} />
                                <Stat label="Questions" value={summary.questions} />
                            </div>
                            <p className="text-xs text-slate-500 mb-4">
                                Course id: <span className="font-mono">{summary.course_id}</span>
                            </p>
                            <div className="flex gap-2">
                                {!published ? (
                                    <NeuralButton
                                        onClick={handlePublish}
                                        disabled={publishing}
                                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                                    >
                                        {publishing ? "Publishing…" : "Publish to students"}
                                    </NeuralButton>
                                ) : (
                                    <Link href={`/course`}>
                                        <NeuralButton variant="primary" className="bg-slate-900 text-white">
                                            <BookOpen size={16} className="mr-2" />
                                            View in catalog
                                        </NeuralButton>
                                    </Link>
                                )}
                            </div>
                        </NeuralCard>
                    )}
                </div>
            </div>
        </div>
    );
};

function Stat({ label, value }: { label: string; value: number }) {
    return (
        <div className="text-center p-3 bg-white rounded-xl border border-emerald-100">
            <div className="text-2xl font-bold text-slate-900">{value}</div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
        </div>
    );
}
