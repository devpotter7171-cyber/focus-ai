"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { NeuralSidebar as Sidebar } from "@/components/neural/Sidebar";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
    Users,
    BookOpen,
    AlertCircle,
    Check,
    Plus,
} from "lucide-react";
import type { ClassListResponse, ClassSummary } from "@/types";

interface JoinResponse {
    joined: boolean;
    class_id: string;
    class_name?: string;
    owner_name?: string;
    already_member?: boolean;
}

export default function StudentClassesPage() {
    const router = useRouter();
    const { profile, loading: authLoading } = useAuth();

    const [classes, setClasses] = useState<ClassSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [code, setCode] = useState("");
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        if (authLoading) return;
        if (!profile) {
            router.push("/login");
            return;
        }
        if (profile.role === "teacher" || profile.role === "admin") {
            router.push("/teacher/classes");
            return;
        }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile, authLoading]);

    async function load() {
        setLoading(true);
        try {
            const data = await apiFetch<ClassListResponse>("/classes/me");
            setClasses(data.joined ?? []);
        } catch (err) {
            console.error(err);
            setError("Could not load your classes.");
        } finally {
            setLoading(false);
        }
    }

    async function handleJoin(e: React.FormEvent) {
        e.preventDefault();
        if (!code.trim()) return;
        setJoining(true);
        setError("");
        setSuccess("");
        try {
            const res = await apiFetch<JoinResponse>("/classes/join", {
                method: "POST",
                body: JSON.stringify({ code: code.trim().toUpperCase() }),
            });
            if (res.already_member) {
                setSuccess("You're already in that class.");
            } else if (res.joined) {
                setSuccess(`Joined ${res.class_name || "class"} ✓`);
            }
            setCode("");
            await load();
        } catch (err: unknown) {
            const message =
                err && typeof err === "object" && "data" in err
                    ? // ApiError shape
                    String((err as { data?: { detail?: string } }).data?.detail ||
                        "Could not join. Check the code and try again.")
                    : "Could not join. Check the code and try again.";
            setError(message);
        } finally {
            setJoining(false);
        }
    }

    return (
        <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
            <Sidebar className="hidden md:flex flex-shrink-0" />

            <main className="flex-1 flex flex-col p-8 md:pl-60 overflow-y-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-1">My Classes</h1>
                    <p className="text-slate-500">
                        Classes you&apos;ve joined. Have a join code? Use it below.
                    </p>
                </header>

                <form
                    onSubmit={handleJoin}
                    className="mb-10 p-6 bg-white rounded-3xl border border-slate-200 shadow-sm"
                >
                    <div className="flex flex-col md:flex-row md:items-end gap-4">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="join-code" className="font-semibold">
                                Join code
                            </Label>
                            <Input
                                id="join-code"
                                placeholder="ABC123"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                className="h-12 font-mono tracking-[0.4em] text-lg uppercase"
                                maxLength={12}
                                autoCapitalize="characters"
                                autoComplete="off"
                            />
                        </div>
                        <NeuralButton
                            type="submit"
                            variant="primary"
                            disabled={joining || !code.trim()}
                            className="bg-slate-900 text-white hover:bg-slate-800 h-12 inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            {joining ? "Joining…" : "Join class"}
                        </NeuralButton>
                    </div>
                    {error && (
                        <div className="mt-4 text-sm text-rose-600 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}
                    {success && (
                        <div className="mt-4 text-sm text-emerald-600 flex items-center gap-2">
                            <Check className="w-4 h-4" /> {success}
                        </div>
                    )}
                </form>

                {loading ? (
                    <div className="grid md:grid-cols-2 gap-6">
                        {[1, 2].map((i) => (
                            <div
                                key={i}
                                className="h-32 rounded-3xl bg-white/60 border border-slate-100 animate-pulse"
                            />
                        ))}
                    </div>
                ) : classes.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
                        <Users className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-slate-900 mb-1">
                            You&apos;re not in any classes yet
                        </h3>
                        <p className="text-slate-500">
                            Ask your instructor for a join code and enter it above.
                        </p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                        {classes.map((c) => (
                            <motion.div
                                key={c.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">
                                            {c.name}
                                        </h3>
                                        {c.owner_name ? (
                                            <p className="text-sm text-slate-500">
                                                Taught by {c.owner_name}
                                            </p>
                                        ) : null}
                                    </div>
                                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                                        <Users className="w-3 h-3" /> {c.member_count}
                                    </span>
                                </div>
                                {c.description ? (
                                    <p className="text-sm text-slate-500 mb-3">
                                        {c.description}
                                    </p>
                                ) : null}
                                <div className="text-xs text-slate-500 inline-flex items-center gap-1">
                                    <BookOpen className="w-3 h-3" />{" "}
                                    {c.course_id || "Generic course"}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
