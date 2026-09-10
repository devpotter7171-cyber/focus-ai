"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NeuralSidebar as Sidebar } from "@/components/neural/Sidebar";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { Brain, CheckCircle, XCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

interface Question {
    id: string;
    question: string;
    options: string[];
}

export default function AssessmentPage() {
    const router = useRouter();
    const [testType, setTestType] = useState<"pre" | "post" | null>(null);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [answers, setAnswers] = useState<number[]>([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [result, setResult] = useState<{ score: number; total: number } | null>(null);
    const [loading, setLoading] = useState(false);
    const [group] = useState<"adaptive" | "control">("adaptive");
    // Get user ID from auth if available, otherwise use temporary ID
    const { user } = useAuth();
    const userId = user?.uid || `user_${Date.now()}`;

    const fetchQuestions = async (type: "pre" | "post") => {
        setLoading(true);
        try {
            const data = await apiFetch<{ test_type: string; questions: Question[] }>(`/assessment/questions/${type}`, {
                includeAuth: false // Assessment doesn't require auth
            });
            if (data.questions && data.questions.length > 0) {
                setQuestions(data.questions);
                setAnswers(new Array(data.questions.length).fill(-1));
            } else {
                throw new Error("No questions received");
            }
            setTestType(type);
            setCurrentQ(0);
            setResult(null);
        } catch (e) {
            console.error("Failed to fetch questions:", e);
            // Fallback mock data if API fails for demo purposes
            const mockQuestions = [
                { id: 'q1', question: 'What is the primary goal of normalization?', options: ['Redundancy reduction', 'Faster queries', 'Better security', 'More tables'] },
                { id: 'q2', question: 'Which normal form deals with partial dependency?', options: ['1NF', '2NF', '3NF', 'BCNF'] },
                { id: 'q3', question: 'What does ACID stand for?', options: ['Atomicity, Consistency, Isolation, Durability', 'Access, Control, ID, Data', 'Auto, Config, Input, Delete', 'None of the above'] }
            ];
            setQuestions(mockQuestions);
            setAnswers(new Array(mockQuestions.length).fill(-1));
            setTestType(type);
            setCurrentQ(0);
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    const selectAnswer = (optionIndex: number) => {
        const newAnswers = [...answers];
        newAnswers[currentQ] = optionIndex;
        setAnswers(newAnswers);
    };

    const submitTest = async () => {
        setLoading(true);
        try {
            const questionIds = questions.map(q => q.id);
            const response = await apiFetch<{ score: number; total: number; percentage: number; stored: boolean }>('/assessment/submit', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId,
                    test_type: testType,
                    group: group,
                    answers: answers,
                    question_ids: questionIds
                }),
                includeAuth: false // Assessment doesn't require auth
            });
            setResult({ score: response.score, total: response.total });
        } catch (e) {
            console.error("Failed to submit assessment:", e);
            // Fallback: calculate mock score
            const score = answers.filter((a, i) => a === 0).length; // Mock scoring
            setResult({ score: Math.min(score, questions.length), total: questions.length });
        } finally {
            setLoading(false);
        }
    };

    // --- RENDER STATES ---

    // 1. Landing Screen
    if (!testType) {
        return (
            <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
                <Sidebar className="hidden md:flex flex-shrink-0" />
                <main className="flex-1 flex flex-col items-center justify-center p-8">
                    <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-soft border border-slate-100 text-center">
                        <div className="w-20 h-20 bg-teal-50 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm">
                            <Brain className="h-10 w-10 text-teal-600" />
                        </div>
                        <h1 className="text-3xl font-bold text-slate-900 mb-3">Knowledge Check</h1>
                        <p className="text-slate-500 mb-10 leading-relaxed">
                            Verify your understanding before moving to the next module. Adaptive questions based on your profile.
                        </p>

                        <div className="space-y-4">
                            <NeuralButton
                                onClick={() => fetchQuestions("pre")}
                                variant="primary"
                                className="w-full h-14 text-lg bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-500/20"
                                disabled={loading}
                            >
                                Start Pre-Test
                            </NeuralButton>
                            <NeuralButton
                                onClick={() => fetchQuestions("post")}
                                variant="glass"
                                className="w-full h-14 text-lg text-slate-600 border border-slate-200"
                                disabled={loading}
                            >
                                Start Post-Test
                            </NeuralButton>
                        </div>
                        <p className="text-[10px] text-slate-300 mt-8 font-mono">ID: {userId}</p>
                    </div>
                </main>
            </div>
        );
    }

    // 2. Results Screen
    if (result) {
        const passed = result.score >= (result.total / 2);
        return (
            <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
                <Sidebar className="hidden md:flex flex-shrink-0" />
                <main className="flex-1 flex flex-col items-center justify-center p-8">
                    <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-soft border border-slate-100 text-center">
                        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm ${passed ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                            {passed ? <CheckCircle className="h-10 w-10 text-emerald-600" /> : <XCircle className="h-10 w-10 text-amber-600" />}
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 mb-2">
                            {testType === "pre" ? "Pre-Test" : "Post-Test"} Complete
                        </h1>
                        <div className="py-6">
                            <span className="text-6xl font-bold text-slate-900">{result.score}</span>
                            <span className="text-2xl text-slate-400 font-medium"> / {result.total}</span>
                        </div>
                        <p className="text-slate-500 mb-10">
                            {passed ? "Excellent work! You have mastered these concepts." : "Review the material and try again to improve."}
                        </p>
                        <div className="space-y-3">
                            <NeuralButton
                                onClick={() => router.push("/dashboard")}
                                variant="primary"
                                className="w-full h-12 bg-slate-900 text-white"
                            >
                                Return to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                            </NeuralButton>
                            <NeuralButton
                                onClick={() => setTestType(null)}
                                variant="ghost"
                                className="w-full h-12"
                            >
                                Take Another Test
                            </NeuralButton>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    // 3. Question Screen
    const q = questions[currentQ];
    const isLast = currentQ === questions.length - 1;

    return (
        <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
            <Sidebar className="hidden md:flex flex-shrink-0" />
            <main className="flex-1 flex flex-col items-center justify-center p-8">
                <div className="max-w-2xl w-full bg-white rounded-[2.5rem] p-10 shadow-soft border border-slate-100 relative">

                    {/* Progress */}
                    <div className="absolute top-0 left-0 w-full h-2 bg-slate-100 rounded-t-[2.5rem] overflow-hidden">
                        <div
                            className="h-full bg-teal-500 transition-all duration-500"
                            style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }}
                        />
                    </div>

                    <div className="flex items-center justify-between mb-8 mt-2">
                        <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-500 uppercase tracking-wide">
                            {testType === "pre" ? "Pre-Test" : "Post-Test"}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                            Question {currentQ + 1} <span className="text-slate-400">/ {questions.length}</span>
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 mb-8 leading-snug">{q?.question}</h2>

                    <div className="space-y-4 mb-10">
                        {q?.options.map((option, idx) => (
                            <button
                                key={idx}
                                onClick={() => selectAnswer(idx)}
                                className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex items-center group
                                    ${answers[currentQ] === idx
                                        ? "border-teal-500 bg-teal-50 shadow-sm"
                                        : "border-slate-100 bg-slate-50 hover:bg-white hover:border-slate-300"
                                    }`}
                            >
                                <div className={`w-6 h-6 rounded-full border-2 mr-4 flex items-center justify-center transition-colors
                                    ${answers[currentQ] === idx
                                        ? "border-teal-500 bg-teal-500"
                                        : "border-slate-300 group-hover:border-slate-400"
                                    }`}>
                                    {answers[currentQ] === idx && <div className="w-2 h-2 bg-white rounded-full" />}
                                </div>
                                <span className={`font-medium ${answers[currentQ] === idx ? 'text-teal-900' : 'text-slate-700'}`}>
                                    {option}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-4">
                        <NeuralButton
                            variant="ghost"
                            className="flex-1 h-12"
                            onClick={() => setCurrentQ(currentQ - 1)}
                            disabled={currentQ === 0}
                        >
                            <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                        </NeuralButton>

                        {isLast ? (
                            <NeuralButton
                                variant="primary"
                                className="flex-1 h-12 bg-teal-600 hover:bg-teal-700"
                                onClick={submitTest}
                                disabled={answers[currentQ] === -1 || loading}
                            >
                                {loading ? "Submitting..." : "Submit Test"}
                            </NeuralButton>
                        ) : (
                            <NeuralButton
                                variant="primary"
                                className="flex-1 h-12 bg-slate-900 hover:bg-slate-800"
                                onClick={() => setCurrentQ(currentQ + 1)}
                                disabled={answers[currentQ] === -1}
                            >
                                Next Question <ArrowRight className="ml-2 h-4 w-4" />
                            </NeuralButton>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
