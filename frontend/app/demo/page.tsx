"use client";

import Link from "next/link";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { Brain, ArrowRight, GraduationCap, BarChart3 } from "lucide-react";

export default function DemoPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-teal-500/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

            <div className="w-full max-w-2xl">
                {/* Logo */}
                <div className="flex justify-center mb-8">
                    <div className="w-16 h-16 bg-teal-500 rounded-2xl flex items-center justify-center text-white shadow-lg">
                        <Brain className="w-8 h-8" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-gray-900 text-center mb-2">Interactive Demo</h1>
                <p className="text-gray-500 text-center mb-8 max-w-lg mx-auto">
                    Experience how Focus-AI adapts to your learning style. Our contextual bandit algorithm personalizes content in real-time.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                            <GraduationCap className="h-6 w-6 text-teal-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Student View</h2>
                        <p className="text-gray-500 text-sm mb-4">Explore adaptive coursework and quizzes.</p>
                        <Link href="/dashboard" className="block">
                            <NeuralButton variant="primary" className="w-full justify-center">
                                Launch Demo
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </NeuralButton>
                        </Link>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                            <BarChart3 className="h-6 w-6 text-purple-600" />
                        </div>
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Teacher View</h2>
                        <p className="text-gray-500 text-sm mb-4">Monitor class confusion and engagement.</p>
                        <Link href="/teacher/dashboard" className="block">
                            <NeuralButton variant="glass" className="w-full justify-center border-gray-300">
                                Launch Demo
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </NeuralButton>
                        </Link>
                    </div>
                </div>

                <div className="text-center">
                    <Link href="/" className="text-gray-500 hover:text-gray-900 text-sm font-medium transition-colors">
                        ← Back to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}
