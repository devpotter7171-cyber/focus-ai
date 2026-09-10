"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { useAccessibility } from "@/hooks/useAccessibility";

interface LessonTutorProps {
    courseId: string;
    unitId: string;
    subtopicId: string;
    /** CSS selector for the lesson body — used to capture highlighted excerpts. */
    lessonSelector?: string;
}

interface TutorResponse {
    answer: string;
    course_title: string;
    lesson_title: string;
    truncated_lesson: boolean;
}

/**
 * Spotlight Tutor.
 *
 * UX:
 *   • Floating "Ask Tutor" button bottom-left.
 *   • While the user has text selected inside the lesson body, a "Spotlight"
 *     mini-button appears above the selection — clicking it pre-fills the
 *     question panel with the highlighted excerpt.
 *   • Single-turn — no chat history. Cheap.
 *
 * Backed by `POST /api/v1/tutor/lesson`.
 */
export function LessonTutor({
    courseId,
    unitId,
    subtopicId,
    lessonSelector = ".prose",
}: LessonTutorProps) {
    const [open, setOpen] = useState(false);
    const [question, setQuestion] = useState("");
    const [excerpt, setExcerpt] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [answer, setAnswer] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { announce } = useAccessibility();

    // Selection-spotlight state
    const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
    const lastSelectionTextRef = useRef<string>("");

    // Track text selection inside the lesson body
    useEffect(() => {
        const root = typeof document !== "undefined"
            ? document.querySelector<HTMLElement>(lessonSelector)
            : null;
        if (!root) return;

        const handler = () => {
            const selection = window.getSelection();
            const text = selection?.toString().trim() || "";

            if (!text || text.length < 3) {
                setSelectionRect(null);
                lastSelectionTextRef.current = "";
                return;
            }

            // Only react if the selection is INSIDE the lesson body
            const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
            if (!range) return;
            const container = range.commonAncestorContainer;
            const containerEl =
                container.nodeType === Node.TEXT_NODE
                    ? container.parentElement
                    : (container as Element);
            if (!containerEl || !root.contains(containerEl)) {
                setSelectionRect(null);
                return;
            }

            lastSelectionTextRef.current = text;
            setSelectionRect(range.getBoundingClientRect());
        };

        document.addEventListener("selectionchange", handler);
        return () => document.removeEventListener("selectionchange", handler);
    }, [lessonSelector]);

    const openWithExcerpt = () => {
        const text = lastSelectionTextRef.current;
        if (text) setExcerpt(text);
        setOpen(true);
        setSelectionRect(null);
    };

    const submit = async () => {
        if (!question.trim() || loading) return;
        setLoading(true);
        setError(null);
        setAnswer(null);
        try {
            const res = await apiFetch<TutorResponse>("/tutor/lesson", {
                method: "POST",
                body: JSON.stringify({
                    course_id: courseId,
                    unit_id: unitId,
                    subtopic_id: subtopicId,
                    question: question.trim(),
                    selected_excerpt: excerpt || undefined,
                }),
            });
            setAnswer(res.answer);
            // Speak the tutor's answer for accessibility
            announce(res.answer.replace(/#{1,6}\s?/g, "").replace(/\*\*/g, "").replace(/`/g, ""));
        } catch (err: any) {
            setError(err?.data?.detail ?? err?.message ?? "Tutor failed.");
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setQuestion("");
        setExcerpt("");
        setAnswer(null);
        setError(null);
    };

    return (
        <>
            {/* Floating spotlight button on text selection */}
            <AnimatePresence>
                {selectionRect && !open && (
                    <motion.button
                        initial={{ opacity: 0, y: 4, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        onMouseDown={(e) => e.preventDefault()} // keep selection
                        onClick={openWithExcerpt}
                        className="fixed z-50 px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-full shadow-xl flex items-center gap-1.5 hover:bg-slate-800"
                        style={{
                            top: Math.max(8, selectionRect.top - 38) + window.scrollY,
                            left: selectionRect.left + selectionRect.width / 2 + window.scrollX,
                            transform: "translateX(-50%)",
                        }}
                    >
                        <Sparkles size={12} />
                        Ask Tutor
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Persistent FAB (bottom-left, paired with the voice mic on right) */}
            <button
                onClick={() => setOpen(true)}
                className="fixed bottom-6 left-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
                title="Ask the AI tutor about this lesson"
                aria-label="Open lesson tutor"
            >
                <Sparkles size={22} />
            </button>

            {/* Dialog */}
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
                        onClick={() => setOpen(false)}
                    >
                        <motion.div
                            initial={{ y: 40, opacity: 0, scale: 0.96 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 40, opacity: 0, scale: 0.96 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
                        >
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                                        <Sparkles size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900">Lesson Tutor</h3>
                                        <p className="text-xs text-slate-500">Ask about anything in this lesson</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setOpen(false)}
                                    className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                                    aria-label="Close"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {excerpt && (
                                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">
                                            Selected Excerpt
                                        </p>
                                        <p className="text-sm text-amber-900 italic leading-snug">
                                            &ldquo;{excerpt.slice(0, 300)}{excerpt.length > 300 ? "…" : ""}&rdquo;
                                        </p>
                                        <button
                                            onClick={() => setExcerpt("")}
                                            className="text-[10px] text-amber-600 hover:text-amber-800 mt-1 font-semibold"
                                        >
                                            Clear excerpt
                                        </button>
                                    </div>
                                )}

                                {answer ? (
                                    <div className="prose prose-sm max-w-none prose-slate prose-p:leading-relaxed">
                                        <ReactMarkdown>{answer}</ReactMarkdown>
                                    </div>
                                ) : error ? (
                                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-sm text-rose-700">
                                        {error}
                                    </div>
                                ) : !loading ? (
                                    <p className="text-sm text-slate-400 italic">
                                        Highlight any text in the lesson and click &ldquo;Ask Tutor&rdquo;,
                                        or type a question below.
                                    </p>
                                ) : null}

                                {loading && (
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <Loader2 size={14} className="animate-spin" />
                                        Thinking…
                                    </div>
                                )}
                            </div>

                            {/* Composer */}
                            <div className="border-t border-slate-100 p-4 space-y-3">
                                <textarea
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    placeholder="What does this part mean? Why does it matter?"
                                    rows={2}
                                    disabled={loading}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            submit();
                                        }
                                    }}
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-colors resize-none"
                                />
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={reset}
                                        className="text-xs text-slate-400 hover:text-slate-700"
                                    >
                                        Clear
                                    </button>
                                    <NeuralButton
                                        variant="primary"
                                        onClick={submit}
                                        disabled={!question.trim() || loading}
                                        className="bg-slate-900 hover:bg-slate-800 text-white"
                                    >
                                        {loading ? (
                                            <Loader2 size={14} className="animate-spin mr-2" />
                                        ) : (
                                            <Send size={14} className="mr-2" />
                                        )}
                                        Ask
                                    </NeuralButton>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
