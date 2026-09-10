"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
    Users,
    Plus,
    Copy,
    Check,
    BookOpen,
    ArrowRight,
    AlertCircle,
} from "lucide-react";
import type { ClassListResponse, ClassSummary } from "@/types";

export default function TeacherClassesPage() {
    const { profile, loading: authLoading } = useAuth();

    const [classes, setClasses] = useState<ClassSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState("");
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading || !profile) return;
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile, authLoading]);

    async function load() {
        setLoading(true);
        try {
            const data = await apiFetch<ClassListResponse>("/classes/me");
            setClasses(data.owned ?? []);
        } catch (err) {
            console.error(err);
            setError("Could not load classes.");
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) return;
        setCreating(true);
        setError("");
        try {
            const created = await apiFetch<ClassSummary>("/classes", {
                method: "POST",
                body: JSON.stringify({ name, description }),
            });
            setClasses((prev) => [created, ...prev]);
            setName("");
            setDescription("");
            setShowCreate(false);
        } catch (err) {
            console.error(err);
            setError("Could not create class. Please try again.");
        } finally {
            setCreating(false);
        }
    }

    async function copyCode(code: string) {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 1500);
        } catch {
            // ignore
        }
    }

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <header className="flex items-center justify-between mb-10">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">My Classes</h1>
                    <p className="text-slate-500">
                        Manage your cohorts and share join codes with students.
                    </p>
                </div>
                <NeuralButton
                    variant="primary"
                    onClick={() => setShowCreate((v) => !v)}
                    className="bg-slate-900 text-white hover:bg-slate-800 inline-flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    {showCreate ? "Cancel" : "New class"}
                </NeuralButton>
            </header>

                {showCreate && (
                    <motion.form
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        onSubmit={handleCreate}
                        className="mb-10 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4"
                    >
                        <div className="space-y-2">
                            <Label htmlFor="cls-name" className="font-semibold">
                                Class name
                            </Label>
                            <Input
                                id="cls-name"
                                placeholder="DBMS - Section A"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cls-desc" className="font-semibold">
                                Description (optional)
                            </Label>
                            <Input
                                id="cls-desc"
                                placeholder="Spring 2026, MWF 10am"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="h-11"
                            />
                        </div>
                        {error && (
                            <div className="text-sm text-rose-600 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" /> {error}
                            </div>
                        )}
                        <div className="flex justify-end gap-3">
                            <NeuralButton
                                type="button"
                                variant="glass"
                                onClick={() => setShowCreate(false)}
                            >
                                Cancel
                            </NeuralButton>
                            <NeuralButton
                                type="submit"
                                variant="primary"
                                disabled={creating}
                                className="bg-slate-900 text-white hover:bg-slate-800"
                            >
                                {creating ? "Creating…" : "Create class"}
                            </NeuralButton>
                        </div>
                    </motion.form>
                )}

                {loading ? (
                    <div className="grid md:grid-cols-2 gap-6">
                        {[1, 2].map((i) => (
                            <div
                                key={i}
                                className="h-44 rounded-3xl bg-white/60 border border-slate-100 animate-pulse"
                            />
                        ))}
                    </div>
                ) : classes.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
                        <Users className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-900 mb-1">
                            No classes yet
                        </h3>
                        <p className="text-slate-500 mb-5">
                            Create your first class and share the join code with students.
                        </p>
                        <NeuralButton
                            variant="primary"
                            onClick={() => setShowCreate(true)}
                            className="bg-slate-900 text-white hover:bg-slate-800 inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> New class
                        </NeuralButton>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                        {classes.map((c) => (
                            <motion.div
                                key={c.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">
                                            {c.name}
                                        </h3>
                                        {c.description ? (
                                            <p className="text-sm text-slate-500 mt-1">
                                                {c.description}
                                            </p>
                                        ) : null}
                                    </div>
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                                        <Users className="w-3 h-3" /> {c.member_count}
                                    </span>
                                </div>

                                {c.join_code && (
                                    <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 mb-4">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                                                Join code
                                            </p>
                                            <p className="text-xl font-bold font-mono tracking-widest text-slate-900">
                                                {c.join_code}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => copyCode(c.join_code!)}
                                            className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-slate-900 text-slate-600 hover:text-slate-900 transition-colors text-xs font-bold inline-flex items-center gap-2"
                                        >
                                            {copiedCode === c.join_code ? (
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

                                <div className="flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                        <BookOpen className="w-3 h-3" />{" "}
                                        {c.course_id || "Generic course"}
                                    </span>
                                    <Link href={`/teacher/classes/${c.id}`}>
                                        <NeuralButton
                                            variant="glass"
                                            className="inline-flex items-center gap-2 text-xs font-bold"
                                        >
                                            Open roster
                                            <ArrowRight className="w-4 h-4" />
                                        </NeuralButton>
                                    </Link>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
        </div>
    );
}
