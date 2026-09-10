import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NeuralButton } from "@/components/neural/NeuralButton";
import { Check, X, HelpCircle, ArrowRight, Mic } from "lucide-react";
import { useQuizVoice } from "@/hooks/useQuizVoice";
import { useRegisterVoiceCommands } from "@/hooks/voiceCommandRegistry";
import { useAccessibility } from "@/hooks/useAccessibility";
import { HintScaffold } from "@/components/neural/HintScaffold";

interface QuestionProps {
    questionId: string;
    text: string;
    options: string[];
    correctAnswerIndex?: number;
    onWrongOptionHover?: () => void;
    onAnswer: (selected: string) => Promise<boolean | { correct: boolean, feedback?: string }>;
    /** Optional next-question handler; enables the "next" voice command. */
    onNext?: () => void;
    /** Optional hint handler; enables the "hint" voice command. */
    onHint?: () => void;
}

export default function QuestionComponent({ questionId, text, options, correctAnswerIndex, onWrongOptionHover, onAnswer, onNext, onHint }: QuestionProps) {
    const [selected, setSelected] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [showHints, setShowHints] = useState(false);

    const { announce } = useAccessibility();

    // Reset state when the question changes
    useEffect(() => {
        setSelected(null);
        setSubmitted(false);
        setIsSubmitting(false);
        setFeedback(null);
        setIsCorrect(null);
        setShowHints(false);
    }, [questionId]);

    // When a new question loads, narrate it (and the options) for SR-mode
    // users so they don't need to discover the "read the question" command.
    // Always pushes to the live region; only speaks via TTS when SR-mode
    // is on, so we don't disturb sighted users.
    useEffect(() => {
        if (!text) return;
        const optionLines = options
            .map((opt, i) => `Option ${String.fromCharCode(65 + i)}. ${opt}`)
            .join(". ");
        const intro = `New question. ${text}. ${optionLines}. Say A, B, C, or D to choose, or 'submit' when ready.`;
        announce(intro);
        // We intentionally depend only on the question identity so the
        // narration doesn't repeat when the user selects/submits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questionId]);

    // Acknowledge the current selection (live region only — sighted users
    // already see the highlighted option).
    useEffect(() => {
        if (selected === null || submitted) return;
        const idx = options.indexOf(selected);
        if (idx >= 0) {
            announce(`Selected option ${String.fromCharCode(65 + idx)}: ${selected}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, submitted]);

    const handleSubmit = async () => {
        if (!selected) return;
        if (submitted || isSubmitting) return;

        setIsSubmitting(true);
        try {
            const result = await onAnswer(selected);
            setSubmitted(true);

            let correct: boolean;
            let feedbackText: string | null = null;
            if (typeof result === 'object') {
                correct = result.correct;
                if (result.feedback) {
                    setFeedback(result.feedback);
                    feedbackText = result.feedback;
                }
                setIsCorrect(correct);
            } else {
                correct = result;
                setIsCorrect(correct);
            }

            // Speak the verdict + explanation. Use assertive politeness so
            // the screen reader announces it immediately, interrupting any
            // ongoing TTS — submission feedback is the most important
            // event in the quiz flow.
            const verdict = correct
                ? "Correct."
                : `Not quite. The correct answer was needed.`;
            const explanation =
                feedbackText ||
                (correct
                    ? "Great job! You've demonstrated mastery of this concept."
                    : "Don't worry, mistakes help us learn. A hint is now available — say 'hint' to hear it.");
            announce(`${verdict} ${explanation}`, { assertive: true });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Wire up voice commands while this question is mounted.
    const quizCommands = useQuizVoice({
        questionText: text,
        options,
        hasSelection: !!selected,
        isSubmitted: submitted,
        onSelectIndex: (idx) => {
            const opt = options[idx];
            if (opt) setSelected(opt);
        },
        onSubmit: handleSubmit,
        onNext,
        onHint: () => {
            // "Give me a hint" → reveal the hint scaffold (auto-fetches level 1)
            setShowHints(true);
            onHint?.();
        },
    });
    useRegisterVoiceCommands(quizCommands);

    const handleOptionHover = (index: number) => {
        if (!submitted && !isSubmitting && onWrongOptionHover && correctAnswerIndex !== undefined && index !== correctAnswerIndex) {
            onWrongOptionHover();
        }
    }

    return (
        <div className="relative">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-bold text-sm shadow-soft">?</div>
                <h3 className="text-lg font-bold text-black tracking-tight">Practice Question</h3>
                <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 text-[10px] font-bold uppercase tracking-wider border border-cyan-100">
                    <Mic size={11} />
                    Voice ready
                </span>
            </div>

            <p className="font-medium text-xl text-neutral-900 mb-8 leading-relaxed max-w-2xl" id={`question-${questionId}`}>{text}</p>

            <div
                className="space-y-3 mb-8"
                role="radiogroup"
                aria-labelledby={`question-${questionId}`}
            >
                {options.map((opt, i) => (
                    <div
                        key={i}
                        onClick={() => !submitted && !isSubmitting && setSelected(opt)}
                        onKeyDown={(e) => {
                            if (submitted || isSubmitting) return;
                            if (e.key === " " || e.key === "Enter") {
                                e.preventDefault();
                                setSelected(opt);
                            }
                        }}
                        onMouseEnter={() => handleOptionHover(i)}
                        role="radio"
                        aria-checked={selected === opt}
                        aria-label={`Option ${String.fromCharCode(65 + i)}: ${opt}`}
                        tabIndex={submitted ? -1 : 0}
                        className={`group flex items-center p-4 border rounded-[1.25rem] cursor-pointer transition-all duration-300 relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2
                        ${submitted && selected === opt
                                ? (isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200')
                                : selected === opt
                                    ? 'bg-black border-black shadow-md transform -translate-y-0.5'
                                    : 'bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'}
                        `}
                    >
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mr-4 transition-all duration-300
                            ${selected === opt
                                ? (submitted && !isCorrect ? 'border-rose-500' : 'border-white')
                                : 'border-slate-300 group-hover:border-slate-400'}
                        `}>
                            {selected === opt && !submitted && (
                                <div className="w-2.5 h-2.5 rounded-full bg-white" />
                            )}
                            {submitted && selected === opt && (
                                isCorrect
                                    ? <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    : <X className="w-3.5 h-3.5 text-rose-500" />
                            )}
                        </div>

                        {/* Option letter badge — A / B / C / D */}
                        <span className={`text-[11px] font-bold mr-3 px-2 py-0.5 rounded-md uppercase tracking-wider
                            ${selected === opt
                                ? "bg-white/20 text-white"
                                : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"}
                        `}>
                            {String.fromCharCode(65 + i)}
                        </span>

                        <span className={`text-base font-medium transition-colors ${selected === opt ? 'text-white' : 'text-slate-600 group-hover:text-slate-900'} 
                            ${submitted && selected === opt ? (isCorrect ? '!text-emerald-900' : '!text-rose-900') : ''}
                        `}>
                            {opt}
                        </span>
                    </div>
                ))}
            </div>

            <AnimatePresence>
                {!submitted && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <NeuralButton
                            onClick={handleSubmit}
                            disabled={!selected || isSubmitting}
                            variant="primary"
                            className="w-full h-14 text-lg bg-black hover:bg-neutral-800 text-white shadow-none border-none flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Submit Answer</span>
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </NeuralButton>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {submitted && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-6 rounded-[1.5rem] flex items-start gap-4 ${isCorrect ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}
                    >
                        <div className={`mt-1 p-2 rounded-full ${isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                            {isCorrect ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                        </div>
                        <div>
                            <p className={`font-bold text-lg ${isCorrect ? 'text-emerald-900' : 'text-rose-900'}`}>
                                {isCorrect ? "Correct!" : "Not quite right."}
                            </p>
                            <p className="text-slate-600 mt-1 leading-relaxed text-base max-w-lg">
                                {feedback || (isCorrect
                                    ? "Great job! You've demonstrated mastery of this concept."
                                    : "Don't worry, mistakes help us learn. Review the material above and try again.")}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Hint scaffolds — appear when the user explicitly asks for help, OR
                automatically right after an incorrect submission (the OATutor pattern). */}
            {(showHints || (submitted && !isCorrect)) && !isCorrect && (
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-5 rounded-[1.5rem] bg-slate-900 text-slate-100"
                >
                    <HintScaffold questionId={questionId} onHintUsed={onHint} />
                </motion.div>
            )}

            {/* Pre-submission hint trigger — only visible BEFORE answering. */}
            {!submitted && !showHints && (
                <button
                    onClick={() => setShowHints(true)}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-slate-700 transition-colors"
                >
                    <HelpCircle size={12} />
                    Need a hint?
                </button>
            )}
        </div>
    );
}
