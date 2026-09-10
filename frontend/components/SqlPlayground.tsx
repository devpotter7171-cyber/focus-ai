"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, Loader2, Check, X, Database, Sparkles } from "lucide-react";
import {
    SqlResult,
    resultsEqual,
    useSqlSandbox,
} from "@/hooks/useSqlSandbox";
import { NeuralButton } from "@/components/neural/NeuralButton";

export interface SqlChallenge {
    /** Stable id for the challenge. */
    id: string;
    /** Human-readable title shown above the editor. */
    title: string;
    /** Markdown-style prompt explaining the task (plain text accepted). */
    prompt: string;
    /** SQL DDL + INSERTs that seed the in-browser DB before each run. */
    seed: string;
    /** Reference query whose result the learner's answer must match. */
    expectedQuery: string;
    /** Optional starting SQL for the editor. */
    starter?: string;
    /** Optional max-difficulty hint shown when the learner is stuck. */
    hint?: string;
}

interface SqlPlaygroundProps {
    challenge: SqlChallenge;
    onComplete?: (durationMs: number, attempts: number) => void;
}

/**
 * In-browser SQL playground — write a query, run it against a seeded
 * SQLite DB (sql.js / WASM), see the result table, and get auto-graded
 * pass/fail by comparing your result set to the reference query's set.
 *
 * No backend involved. Each learner gets an isolated sandbox.
 */
export function SqlPlayground({ challenge, onComplete }: SqlPlaygroundProps) {
    const sandbox = useSqlSandbox({ seed: challenge.seed });
    const [code, setCode] = useState<string>(challenge.starter ?? "");
    const [graded, setGraded] = useState<{ correct: boolean; expected: SqlResult | null } | null>(null);
    const [showHint, setShowHint] = useState(false);
    const [attempts, setAttempts] = useState(0);
    const [startedAt] = useState<number>(Date.now());

    // Reset per challenge
    useEffect(() => {
        setCode(challenge.starter ?? "");
        setGraded(null);
        setShowHint(false);
        setAttempts(0);
    }, [challenge.id, challenge.starter]);

    const handleRun = async () => {
        if (!code.trim()) return;
        setGraded(null);
        const learner = await sandbox.run(code);
        if (!learner) return;

        // Reseed an isolated DB for the expected query so the learner's
        // statements don't pollute the comparison (they may have INSERTed).
        let expected: SqlResult | null = null;
        try {
            await sandbox.reset();
            expected = await sandbox.run(challenge.expectedQuery);
        } finally {
            // Restore the learner's world so they can keep iterating.
            // We re-run the learner's last query against a fresh seed.
            await sandbox.reset();
            await sandbox.run(code);
        }

        const correct = !!(learner && expected && resultsEqual(learner, expected));
        setGraded({ correct, expected });
        const next = attempts + 1;
        setAttempts(next);
        if (correct) onComplete?.(Date.now() - startedAt, next);
    };

    const handleReset = async () => {
        await sandbox.reset();
        setCode(challenge.starter ?? "");
        setGraded(null);
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <header className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-600 mb-1">
                        <Database size={12} />
                        SQL Challenge
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">{challenge.title}</h3>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">{challenge.prompt}</p>
                </div>
                {graded && (
                    <span
                        className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold border ${
                            graded.correct
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                    >
                        {graded.correct ? <Check size={12} /> : <X size={12} />}
                        {graded.correct ? "Correct" : "Result mismatch"}
                    </span>
                )}
            </header>

            {/* Editor */}
            <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                        <span className="ml-3 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                            query.sql
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleReset}
                            className="text-[10px] font-bold text-slate-400 hover:text-slate-200 flex items-center gap-1"
                        >
                            <RotateCcw size={11} /> Reset
                        </button>
                    </div>
                </div>
                <textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    spellCheck={false}
                    placeholder="-- Write your SQL here&#10;SELECT * FROM employees;"
                    className="w-full min-h-[160px] p-4 bg-transparent text-slate-100 font-mono text-sm leading-relaxed outline-none resize-y placeholder:text-slate-600"
                />
                <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-t border-slate-800">
                    <span className="text-[10px] font-mono text-slate-500">
                        {sandbox.ready ? (
                            <span className="text-emerald-400">SQLite (WASM) ready</span>
                        ) : (
                            <span>Loading SQL engine…</span>
                        )}
                        {attempts > 0 && (
                            <span className="ml-3 text-slate-400">
                                Attempts: {attempts}
                            </span>
                        )}
                    </span>
                    <NeuralButton
                        onClick={handleRun}
                        disabled={!sandbox.ready || sandbox.running || !code.trim()}
                        className="bg-cyan-500 hover:bg-cyan-600 text-white"
                    >
                        {sandbox.running ? (
                            <Loader2 className="animate-spin mr-2" size={14} />
                        ) : (
                            <Play size={14} className="mr-2 fill-current" />
                        )}
                        Run Query
                    </NeuralButton>
                </div>
            </div>

            {/* Error */}
            <AnimatePresence>
                {sandbox.error && (
                    <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs font-mono text-rose-700"
                    >
                        {sandbox.error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Result */}
            <AnimatePresence>
                {sandbox.result && !sandbox.error && (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="rounded-2xl bg-white border border-slate-200 overflow-hidden"
                    >
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                            <span>
                                Result{" "}
                                {sandbox.result.rows.length > 0 && (
                                    <span className="text-slate-400 ml-1">
                                        ({sandbox.result.rows.length} row{sandbox.result.rows.length === 1 ? "" : "s"})
                                    </span>
                                )}
                            </span>
                        </div>
                        {sandbox.result.rows.length === 0 ? (
                            <p className="px-4 py-3 text-xs text-slate-400 italic">
                                No rows returned.
                            </p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            {sandbox.result.columns.map((c) => (
                                                <th
                                                    key={c}
                                                    className="px-3 py-2 text-left font-bold text-slate-700 border-b border-slate-200"
                                                >
                                                    {c}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sandbox.result.rows.slice(0, 50).map((row, i) => (
                                            <tr
                                                key={i}
                                                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                                            >
                                                {row.map((cell, j) => (
                                                    <td key={j} className="px-3 py-2 text-slate-700 font-mono text-xs">
                                                        {cell === null ? <span className="text-slate-400 italic">NULL</span> : String(cell)}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {sandbox.result.rows.length > 50 && (
                                    <p className="px-4 py-2 text-[10px] text-slate-400 italic">
                                        Showing first 50 of {sandbox.result.rows.length} rows.
                                    </p>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hint */}
            {challenge.hint && (
                <div className="flex justify-end">
                    {showHint ? (
                        <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs italic text-slate-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2"
                        >
                            <Sparkles size={11} className="inline mr-1 text-amber-500" />
                            {challenge.hint}
                        </motion.div>
                    ) : (
                        <button
                            onClick={() => setShowHint(true)}
                            className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700"
                        >
                            Need a hint?
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
