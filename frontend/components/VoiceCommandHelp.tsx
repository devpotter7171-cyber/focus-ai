"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Mic,
    X,
    Search,
    Compass,
    Volume2,
    MoveVertical,
    HelpCircle,
    BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface VoiceHelpCommand {
    description: string;
    example: string;
    keywords: string[];
    category: string;
}

interface VoiceCommandHelpProps {
    open: boolean;
    onClose: () => void;
    commands: VoiceHelpCommand[];
}

const CATEGORY_META: Record<
    string,
    { icon: React.ComponentType<{ size?: number; className?: string }>; tone: string; order: number }
> = {
    Navigation: { icon: Compass, tone: "text-blue-500", order: 1 },
    Quiz: { icon: BookOpen, tone: "text-emerald-500", order: 2 },
    Reading: { icon: Volume2, tone: "text-purple-500", order: 3 },
    Scrolling: { icon: MoveVertical, tone: "text-amber-500", order: 4 },
    Other: { icon: HelpCircle, tone: "text-slate-500", order: 5 },
};

/**
 * Searchable, categorised voice-command help dialog.
 *
 * Replaces the cramped popover that used to live inside
 * `VoiceCommandButton`. Renders a centred modal with:
 *   • prominent keyboard shortcut hint
 *   • search box that matches across description/example/keywords
 *   • commands grouped by category (Navigation / Quiz / Reading /
 *     Scrolling / Other) with stable order
 *   • a per-command keyword chip list so users can see all the
 *     phrasings the fuzzy matcher accepts
 */
export function VoiceCommandHelp({
    open,
    onClose,
    commands,
}: VoiceCommandHelpProps) {
    const [query, setQuery] = React.useState("");

    React.useEffect(() => {
        if (!open) return;
        // Esc closes the dialog.
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    React.useEffect(() => {
        if (!open) setQuery("");
    }, [open]);

    const grouped = React.useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = q
            ? commands.filter((c) => {
                  const hay = [
                      c.description,
                      c.example,
                      ...(c.keywords ?? []),
                  ]
                      .join(" ")
                      .toLowerCase();
                  return hay.includes(q);
              })
            : commands;

        const map = new Map<string, VoiceHelpCommand[]>();
        for (const c of filtered) {
            const cat = c.category || "Other";
            const arr = map.get(cat) ?? [];
            arr.push(c);
            map.set(cat, arr);
        }
        // Stable section order
        return Array.from(map.entries()).sort(
            (a, b) =>
                (CATEGORY_META[a[0]]?.order ?? 99) -
                (CATEGORY_META[b[0]]?.order ?? 99),
        );
    }, [commands, query]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm"
                        aria-hidden
                    />

                    {/* Dialog */}
                    <motion.div
                        initial={{ opacity: 0, y: 16, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 16, scale: 0.97 }}
                        transition={{ duration: 0.18 }}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Voice commands"
                        className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div className="pointer-events-auto w-full max-w-2xl max-h-[80vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
                            {/* Header */}
                            <header className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                                        <Mic size={16} />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-slate-900 leading-tight">
                                            Voice Commands
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            Press{" "}
                                            <kbd className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-[10px] text-slate-700">
                                                Left Ctrl
                                            </kbd>{" "}
                                            or click the mic, then say one of
                                            these.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                                    aria-label="Close"
                                >
                                    <X size={16} />
                                </button>
                            </header>

                            {/* Search */}
                            <div className="px-6 py-3 border-b border-slate-100">
                                <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-slate-400 transition">
                                    <Search size={14} className="text-slate-400" />
                                    <input
                                        type="text"
                                        autoFocus
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search commands or keywords…"
                                        className="flex-1 bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
                                    />
                                    {query && (
                                        <button
                                            onClick={() => setQuery("")}
                                            className="text-slate-400 hover:text-slate-700"
                                            aria-label="Clear search"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </label>
                            </div>

                            {/* Commands list */}
                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                {grouped.length === 0 ? (
                                    <p className="text-sm text-slate-400 italic text-center py-8">
                                        No commands match{" "}
                                        <strong>&ldquo;{query}&rdquo;</strong>.
                                    </p>
                                ) : (
                                    <div className="space-y-6">
                                        {grouped.map(([cat, cmds]) => {
                                            const meta =
                                                CATEGORY_META[cat] ??
                                                CATEGORY_META.Other!;
                                            const Icon = meta.icon;
                                            return (
                                                <section key={cat}>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Icon
                                                            size={14}
                                                            className={meta.tone}
                                                        />
                                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                                            {cat}
                                                        </h3>
                                                        <span className="text-xs text-slate-300 ml-1">
                                                            {cmds.length}
                                                        </span>
                                                    </div>
                                                    <ul className="space-y-1.5">
                                                        {cmds.map((cmd, i) => (
                                                            <CommandRow
                                                                key={`${cat}-${i}`}
                                                                cmd={cmd}
                                                            />
                                                        ))}
                                                    </ul>
                                                </section>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <footer className="px-6 py-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                                <span>
                                    {commands.length} command
                                    {commands.length === 1 ? "" : "s"} available
                                </span>
                                <span>
                                    Press{" "}
                                    <kbd className="px-1 py-0.5 bg-slate-100 rounded font-mono text-[9px]">
                                        Esc
                                    </kbd>{" "}
                                    to close
                                </span>
                            </footer>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function CommandRow({ cmd }: { cmd: VoiceHelpCommand }) {
    // Show only a handful of keywords (stable order, deduped) so each row
    // stays readable. Drop duplicates of the description verbatim.
    const chips = React.useMemo(() => {
        const desc = cmd.description.toLowerCase();
        const seen = new Set<string>();
        const out: string[] = [];
        for (const k of cmd.keywords) {
            const norm = k.toLowerCase();
            if (norm === desc || seen.has(norm)) continue;
            seen.add(norm);
            out.push(k);
            if (out.length >= 4) break;
        }
        return out;
    }, [cmd]);

    return (
        <li className="px-3 py-2 rounded-xl hover:bg-slate-50 transition">
            <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-semibold text-slate-800">
                    {cmd.description}
                </span>
                <span className="text-xs text-slate-400 italic">
                    e.g. &ldquo;{cmd.example}&rdquo;
                </span>
            </div>
            {chips.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {chips.map((chip) => (
                        <span
                            key={chip}
                            className={cn(
                                "px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px]",
                                "font-mono text-slate-600",
                            )}
                        >
                            {chip}
                        </span>
                    ))}
                </div>
            )}
        </li>
    );
}
