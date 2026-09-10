"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, HelpCircle, X, AlertTriangle } from "lucide-react";
import { useVoiceCommand } from "@/hooks/useVoiceCommand";
import { getRegisteredCommands, subscribeRegistry, RegisteredVoiceCommand } from "@/hooks/voiceCommandRegistry";
import { VoiceCommandHelp } from "@/components/VoiceCommandHelp";
import { AccessibilityToggle } from "@/components/AccessibilityToggle";

interface VoiceCommandButtonProps {
    extraCommands?: RegisteredVoiceCommand[];
}

const ERROR_LABEL: Record<string, string> = {
    "not-allowed": "Microphone access denied. Allow it in your browser settings and try again.",
    "service-not-allowed": "Microphone blocked. Use HTTPS or check site permissions.",
    "no-speech": "Didn't hear anything — try speaking louder or closer to the mic.",
    "audio-capture": "No microphone detected on this device.",
    "network": "Speech service is unreachable.",
    "start-failed": "Couldn't start recognition. Refresh the page.",
};

export function VoiceCommandButton({ extraCommands }: VoiceCommandButtonProps) {
    // Subscribe to the global registry so any page can contribute commands.
    const [registered, setRegistered] = useState<RegisteredVoiceCommand[]>(getRegisteredCommands());
    useEffect(() => {
        return subscribeRegistry(() => setRegistered(getRegisteredCommands()));
    }, []);

    const allExtra = [...(extraCommands ?? []), ...registered];

    const { isListening, isAnalyzing, transcript, interim, supported, error, toggle, availableCommands } =
        useVoiceCommand({ commands: allExtra });
    const [showHelp, setShowHelp] = useState(false);

    // Track the last system response for visual feedback
    const [lastResponse, setLastResponse] = useState<string | null>(null);
    const responseTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    // Listen for spoken confirmations (the `confirm` field on matched commands)
    // by intercepting speechSynthesis. We also listen for a custom event that
    // fires when no command matched (fallback to AI).
    useEffect(() => {
        const handleSpeak = (e: Event) => {
            const text = (e as CustomEvent<string>).detail;
            if (text) {
                setLastResponse(text);
                if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
                // Longer text gets more reading time (min 4s, max 15s)
                const displayMs = Math.min(15000, Math.max(4000, text.length * 60));
                responseTimeoutRef.current = setTimeout(() => setLastResponse(null), displayMs);
            }
        };
        window.addEventListener("voice-response", handleSpeak);
        return () => {
            window.removeEventListener("voice-response", handleSpeak);
            if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
        };
    }, []);

    // Keyboard shortcut: "?" toggles the help dialog (when not typing in
    // an input/textarea or contenteditable element).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "?" || e.ctrlKey || e.metaKey || e.altKey) return;
            const target = e.target as HTMLElement | null;
            const tag = target?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
            e.preventDefault();
            setShowHelp((p) => !p);
        };
        window.addEventListener("keydown", onKey);

        // Also listen for the custom event dispatched by the "help" voice command.
        const onVoiceHelp = () => setShowHelp(true);
        window.addEventListener("voice-help-open", onVoiceHelp);

        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("voice-help-open", onVoiceHelp);
        };
    }, []);

    if (!supported) return null;

    const liveText = transcript || interim;
    const showOverlay = isListening || isAnalyzing;

    return (
        <>
            {/* Full-screen overlay while listening or analyzing */}
            <AnimatePresence>
                {showOverlay && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-40 pointer-events-none flex items-end justify-center pb-32"
                    >
                        <div className={`absolute inset-0 bg-gradient-to-t ${isAnalyzing ? "from-cyan-500/10" : "from-rose-500/10"} via-transparent to-transparent`} />

                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className={`relative bg-white/95 backdrop-blur-md border ${isAnalyzing ? "border-cyan-200" : "border-rose-200"} shadow-2xl rounded-3xl px-6 py-5 max-w-md w-[90%] pointer-events-auto`}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                {isAnalyzing ? (
                                    <>
                                        <div className="flex gap-1">
                                            {[0, 1, 2].map((i) => (
                                                <motion.div
                                                    key={i}
                                                    className="w-2 h-2 bg-cyan-500 rounded-full"
                                                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                                                    transition={{
                                                        duration: 0.9,
                                                        repeat: Infinity,
                                                        delay: i * 0.15,
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-xs font-bold text-cyan-600 uppercase tracking-wider">
                                            Analyzing
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex items-end gap-1 h-6">
                                            {[0, 1, 2, 3, 4].map((i) => (
                                                <motion.div
                                                    key={i}
                                                    className="w-1.5 bg-rose-500 rounded-full"
                                                    animate={{ height: ["20%", "100%", "40%", "80%", "20%"] }}
                                                    transition={{
                                                        duration: 0.8,
                                                        repeat: Infinity,
                                                        delay: i * 0.1,
                                                        ease: "easeInOut",
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">
                                            Listening
                                        </span>
                                        <span className="ml-auto text-[10px] text-slate-400 font-mono">
                                            Press Ctrl when done
                                        </span>
                                    </>
                                )}
                            </div>
                            <div className="text-slate-800 font-medium min-h-[2rem]">
                                {liveText ? (
                                    <span>{liveText}</span>
                                ) : isAnalyzing ? (
                                    <span className="text-slate-400 italic">Processing what you said…</span>
                                ) : (
                                    <span className="text-slate-400 italic">Speak now…</span>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating button cluster */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
                {/* Last transcript bubble (after listening ends) */}
                <AnimatePresence>
                    {!isListening && !isAnalyzing && transcript && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                            className="max-w-xs bg-white border border-slate-200 rounded-2xl px-4 py-2 shadow-lg text-sm text-slate-700 font-medium"
                        >
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">
                                Heard:
                            </span>
                            &ldquo;{transcript}&rdquo;
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* System response bubble */}
                <AnimatePresence>
                    {lastResponse && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.9 }}
                            className="max-w-sm bg-slate-900 text-white rounded-2xl px-4 py-3 shadow-lg text-sm font-medium relative group"
                        >
                            <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                                Focus-AI:
                            </span>
                            <p className="leading-relaxed text-slate-100 text-[13px]">{lastResponse}</p>
                            <button
                                onClick={() => {
                                    window.speechSynthesis?.cancel();
                                    setLastResponse(null);
                                }}
                                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Dismiss and stop speaking"
                            >
                                <X size={12} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Error toast */}
                <AnimatePresence>
                    {error && error !== "no-speech" && error !== "aborted" && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="max-w-xs bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 shadow-lg text-xs text-rose-800 flex items-start gap-2"
                        >
                            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                            <span>{ERROR_LABEL[error] ?? `Error: ${error}`}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex items-center gap-2">
                    {/* Accessibility / screen-reader mode toggle */}
                    <AccessibilityToggle />

                    {/* Help toggle */}
                    <button
                        onClick={() => setShowHelp((p) => !p)}
                        className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors"
                        aria-label="Voice command help"
                    >
                        {showHelp ? <X size={16} /> : <HelpCircle size={16} />}
                    </button>

                    {/* Mic button */}
                    <motion.button
                        onClick={toggle}
                        whileTap={{ scale: 0.9 }}
                        className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                            isAnalyzing
                                ? "bg-cyan-500 text-white shadow-cyan-500/30"
                                : isListening
                                    ? "bg-rose-500 text-white shadow-rose-500/30"
                                    : "bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/30"
                        }`}
                        aria-label={isListening ? "Stop listening (Left Ctrl)" : "Start voice command (Left Ctrl)"}
                        title={
                            isAnalyzing
                                ? "Analyzing…"
                                : isListening
                                    ? "Click or press Left Ctrl to finish speaking"
                                    : "Click or press Left Ctrl to speak"
                        }
                    >
                        {isAnalyzing ? (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            >
                                <Mic size={22} />
                            </motion.div>
                        ) : isListening ? (
                            <MicOff size={22} />
                        ) : (
                            <Mic size={22} />
                        )}

                        {isListening && (
                            <span className="absolute inset-0 rounded-full animate-ping bg-rose-400 opacity-30" />
                        )}

                        <span className="absolute -top-1 -left-1 bg-slate-700 text-[8px] text-white font-bold px-1.5 py-0.5 rounded-md shadow-sm">
                            Ctrl
                        </span>
                    </motion.button>
                </div>
            </div>

            {/* Help dialog */}
            <VoiceCommandHelp
                open={showHelp}
                onClose={() => setShowHelp(false)}
                commands={availableCommands}
            />
        </>
    );
}
