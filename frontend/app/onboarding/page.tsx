"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useAccessibility } from "@/hooks/useAccessibility";
import { apiFetch } from "@/lib/api";
import { NeuralButton } from "@/components/neural/NeuralButton";
import {
    GraduationCap,
    BookOpen,
    Rocket,
    Brain,
    ArrowRight,
    Check,
    Sparkles,
    Zap,
} from "lucide-react";

// ─── Diagnostic Questions (5 spanning easy→hard across DBMS topics) ─────────

const DIAGNOSTIC_QUESTIONS = [
    {
        id: "diag_1",
        text: "What is a database?",
        options: [
            "A collection of organized data that can be easily accessed and managed",
            "A programming language for web development",
            "A type of computer hardware",
            "An operating system",
        ],
        correct: 0,
        difficulty: "easy",
        topic: "Fundamentals",
    },
    {
        id: "diag_2",
        text: "Which SQL command is used to retrieve data from a table?",
        options: ["GET", "FETCH", "SELECT", "RETRIEVE"],
        correct: 2,
        difficulty: "easy",
        topic: "SQL Basics",
    },
    {
        id: "diag_3",
        text: "What does a PRIMARY KEY constraint ensure?",
        options: [
            "Values can be NULL",
            "Each row has a unique identifier",
            "The column stores only numbers",
            "The table can have duplicate rows",
        ],
        correct: 1,
        difficulty: "medium",
        topic: "Relational Model",
    },
    {
        id: "diag_4",
        text: "Which normal form eliminates transitive dependencies?",
        options: [
            "First Normal Form (1NF)",
            "Second Normal Form (2NF)",
            "Third Normal Form (3NF)",
            "Boyce-Codd Normal Form (BCNF)",
        ],
        correct: 2,
        difficulty: "hard",
        topic: "Normalization",
    },
    {
        id: "diag_5",
        text: "In a transaction, what does the 'I' in ACID stand for?",
        options: ["Integrity", "Isolation", "Independence", "Indexing"],
        correct: 1,
        difficulty: "hard",
        topic: "Transactions",
    },
];

type Step = "welcome" | "experience" | "quiz" | "result";
type Experience = "beginner" | "intermediate" | "advanced";

function scoreToLevel(score: number, total: number, experience: Experience): number {
    const pct = (score / total) * 100;

    // Combine self-reported experience with diagnostic score
    if (experience === "advanced" && pct >= 80) return 1; // Expert
    if (experience === "advanced" && pct >= 60) return 2; // Detailed
    if (pct >= 80) return 2; // Detailed (even beginners who ace it)
    if (pct >= 60) return 3; // Key Points
    if (pct >= 40) return 4; // Real World
    return 5; // Analogy (simplest)
}

export default function OnboardingPage() {
    const router = useRouter();
    const { user, profile, loading, refreshProfile } = useAuth();
    const { announce } = useAccessibility();

    const [step, setStep] = useState<Step>("welcome");
    const [experience, setExperience] = useState<Experience | null>(null);
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState<number[]>([]);
    const [selected, setSelected] = useState<number | null>(null);
    const [score, setScore] = useState(0);
    const [saving, setSaving] = useState(false);

    // Redirect if already onboarded or not logged in
    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.push("/login");
            return;
        }
        if (profile?.onboarding_completed) {
            router.push("/dashboard");
        }
    }, [user, profile, loading, router]);

    // Announce step changes
    useEffect(() => {
        if (step === "welcome") {
            announce("Welcome to Focus-AI. Let's personalize your learning experience.");
        } else if (step === "experience") {
            announce("How familiar are you with databases? Choose beginner, intermediate, or advanced.");
        } else if (step === "quiz") {
            const q = DIAGNOSTIC_QUESTIONS[currentQ];
            if (q) {
                announce(`Question ${currentQ + 1} of 5. ${q.text}. ${q.options.map((o, i) => `Option ${String.fromCharCode(65 + i)}: ${o}`).join(". ")}`);
            }
        }
    }, [step, currentQ, announce]);

    const handleExperienceSelect = (level: Experience) => {
        setExperience(level);
        setStep("quiz");
    };

    const handleAnswer = () => {
        if (selected === null) return;
        const currentQuestion = DIAGNOSTIC_QUESTIONS[currentQ];
        if (!currentQuestion) return;
        const isCorrect = selected === currentQuestion.correct;
        const newScore = isCorrect ? score + 1 : score;
        setScore(newScore);
        setAnswers([...answers, selected]);

        if (currentQ < DIAGNOSTIC_QUESTIONS.length - 1) {
            setCurrentQ(currentQ + 1);
            setSelected(null);
        } else {
            // Quiz complete
            setStep("result");
        }
    };

    const handleComplete = async () => {
        if (!experience) return;
        setSaving(true);

        const level = scoreToLevel(score, DIAGNOSTIC_QUESTIONS.length, experience);

        try {
            await apiFetch("/auth/complete-onboarding", {
                method: "POST",
                body: JSON.stringify({
                    experience_level: experience,
                    diagnostic_score: score,
                    diagnostic_total: DIAGNOSTIC_QUESTIONS.length,
                    initial_content_level: level,
                }),
            });

            // Refresh the profile so the dashboard doesn't redirect back
            await refreshProfile();

            announce(`All set! Your content starts at level ${level}. Redirecting to your dashboard.`);
            setTimeout(() => router.push("/dashboard"), 1200);
        } catch (err) {
            console.error("Onboarding save failed:", err);
            // Still redirect — don't block the user
            router.push("/dashboard");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="w-8 h-8 border-3 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
            </div>
        );
    }

    const resultLevel = experience ? scoreToLevel(score, DIAGNOSTIC_QUESTIONS.length, experience) : 3;
    const levelNames: Record<number, string> = {
        1: "Expert",
        2: "Detailed",
        3: "Key Points",
        4: "Real World Examples",
        5: "Simple Analogies",
    };

    const currentQuestion = DIAGNOSTIC_QUESTIONS[currentQ]!;

    return (
        <main id="main-content" tabIndex={-1} className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                {/* Progress indicator */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {(["welcome", "experience", "quiz", "result"] as Step[]).map((s, i) => (
                        <div
                            key={s}
                            className={`h-1.5 rounded-full transition-all duration-500 ${
                                step === s
                                    ? "w-12 bg-slate-900"
                                    : i < ["welcome", "experience", "quiz", "result"].indexOf(step)
                                        ? "w-8 bg-slate-400"
                                        : "w-8 bg-slate-200"
                            }`}
                        />
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {/* ─── Step 1: Welcome ─────────────────────────────────── */}
                    {step === "welcome" && (
                        <motion.div
                            key="welcome"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-white rounded-3xl p-10 border border-slate-200 shadow-sm text-center"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-6">
                                <Sparkles size={28} />
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900 mb-3">
                                Welcome to Focus-AI
                            </h1>
                            <p className="text-slate-500 text-lg mb-8 max-w-md mx-auto">
                                Let&apos;s take 2 minutes to personalize your learning experience.
                                We&apos;ll adjust the content difficulty to match your level.
                            </p>
                            <NeuralButton
                                variant="primary"
                                onClick={() => setStep("experience")}
                                className="bg-slate-900 text-white hover:bg-slate-800 h-14 px-8 text-base inline-flex items-center gap-2"
                            >
                                Let&apos;s go <ArrowRight size={18} />
                            </NeuralButton>
                        </motion.div>
                    )}

                    {/* ─── Step 2: Experience Level ────────────────────────── */}
                    {step === "experience" && (
                        <motion.div
                            key="experience"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-white rounded-3xl p-10 border border-slate-200 shadow-sm"
                        >
                            <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
                                How familiar are you with databases?
                            </h2>
                            <p className="text-slate-500 text-center mb-8">
                                This helps us pick the right starting point. No wrong answer here.
                            </p>

                            <div className="grid gap-4">
                                {[
                                    {
                                        level: "beginner" as Experience,
                                        icon: BookOpen,
                                        title: "Beginner",
                                        desc: "I'm new to databases or just starting to learn",
                                        color: "bg-emerald-50 border-emerald-200 hover:border-emerald-400",
                                    },
                                    {
                                        level: "intermediate" as Experience,
                                        icon: Brain,
                                        title: "Intermediate",
                                        desc: "I know basic SQL and understand tables & relationships",
                                        color: "bg-blue-50 border-blue-200 hover:border-blue-400",
                                    },
                                    {
                                        level: "advanced" as Experience,
                                        icon: Rocket,
                                        title: "Advanced",
                                        desc: "I've worked with databases professionally or studied them in depth",
                                        color: "bg-purple-50 border-purple-200 hover:border-purple-400",
                                    },
                                ].map((opt) => (
                                    <button
                                        key={opt.level}
                                        onClick={() => handleExperienceSelect(opt.level)}
                                        className={`flex items-center gap-5 p-5 rounded-2xl border-2 text-left transition-all duration-200 ${opt.color}`}
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm shrink-0">
                                            <opt.icon size={22} className="text-slate-700" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 text-lg">{opt.title}</p>
                                            <p className="text-sm text-slate-500">{opt.desc}</p>
                                        </div>
                                        <ArrowRight size={18} className="ml-auto text-slate-400 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* ─── Step 3: Diagnostic Quiz ─────────────────────────── */}
                    {step === "quiz" && (
                        <motion.div
                            key={`quiz-${currentQ}`}
                            initial={{ opacity: 0, x: 30 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -30 }}
                            className="bg-white rounded-3xl p-10 border border-slate-200 shadow-sm"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    Quick diagnostic
                                </span>
                                <span className="text-sm font-bold text-slate-600">
                                    {currentQ + 1} / {DIAGNOSTIC_QUESTIONS.length}
                                </span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full h-1.5 bg-slate-100 rounded-full mb-8 overflow-hidden">
                                <div
                                    className="h-full bg-slate-900 rounded-full transition-all duration-500"
                                    style={{ width: `${((currentQ + 1) / DIAGNOSTIC_QUESTIONS.length) * 100}%` }}
                                />
                            </div>

                            <div className="mb-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                                    <GraduationCap size={11} />
                                    {currentQuestion.topic}
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-slate-900 mb-6">
                                {currentQuestion.text}
                            </h3>

                            <div className="space-y-3 mb-8">
                                {currentQuestion.options.map((opt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSelected(i)}
                                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200 ${
                                            selected === i
                                                ? "bg-slate-900 border-slate-900 text-white"
                                                : "bg-white border-slate-200 hover:border-slate-400 text-slate-700"
                                        }`}
                                    >
                                        <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${
                                            selected === i
                                                ? "border-white text-white"
                                                : "border-slate-300 text-slate-400"
                                        }`}>
                                            {String.fromCharCode(65 + i)}
                                        </span>
                                        <span className="font-medium text-sm">{opt}</span>
                                    </button>
                                ))}
                            </div>

                            <NeuralButton
                                variant="primary"
                                onClick={handleAnswer}
                                disabled={selected === null}
                                className="w-full bg-slate-900 text-white hover:bg-slate-800 h-13 text-base disabled:bg-slate-200 disabled:text-slate-400"
                            >
                                {currentQ < DIAGNOSTIC_QUESTIONS.length - 1 ? "Next" : "See my results"}
                                <ArrowRight size={16} className="ml-2" />
                            </NeuralButton>
                        </motion.div>
                    )}

                    {/* ─── Step 4: Results ─────────────────────────────────── */}
                    {step === "result" && (
                        <motion.div
                            key="result"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white rounded-3xl p-10 border border-slate-200 shadow-sm text-center"
                        >
                            <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-6">
                                <Check size={36} strokeWidth={3} />
                            </div>

                            <h2 className="text-2xl font-bold text-slate-900 mb-2">
                                You&apos;re all set!
                            </h2>
                            <p className="text-slate-500 mb-8">
                                Based on your answers, we&apos;ll start you at:
                            </p>

                            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 mb-8">
                                <Zap size={20} className="text-amber-500" />
                                <div className="text-left">
                                    <p className="text-sm font-bold text-slate-900">
                                        Level {resultLevel}: {levelNames[resultLevel]}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        Score: {score}/{DIAGNOSTIC_QUESTIONS.length} • {experience}
                                    </p>
                                </div>
                            </div>

                            <p className="text-sm text-slate-400 mb-8 max-w-sm mx-auto">
                                Don&apos;t worry — the system adapts continuously. If content feels too easy or hard, it&apos;ll adjust automatically.
                            </p>

                            <NeuralButton
                                variant="primary"
                                onClick={handleComplete}
                                disabled={saving}
                                className="bg-slate-900 text-white hover:bg-slate-800 h-14 px-10 text-base inline-flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        Start learning <ArrowRight size={18} />
                                    </>
                                )}
                            </NeuralButton>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </main>
    );
}
