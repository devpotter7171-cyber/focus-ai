import Link from "next/link";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { Brain, Home, Search } from "lucide-react";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-500/5 rounded-full blur-[128px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-[128px]" />
            </div>

            <div className="max-w-md w-full text-center relative z-10">
                <div className="w-24 h-24 bg-white rounded-[2rem] shadow-soft mx-auto mb-8 flex items-center justify-center border border-slate-100">
                    <Brain className="w-12 h-12 text-slate-300" />
                </div>

                <h1 className="text-8xl font-bold text-slate-900 mb-2 tracking-tighter">404</h1>
                <h2 className="text-xl font-bold text-slate-600 mb-4">Neural Link Severed</h2>

                <p className="text-slate-500 mb-10 leading-relaxed">
                    The learning path you are looking for has not been computed or does not exist in this dimension.
                </p>

                <div className="space-y-3">
                    <Link href="/dashboard" className="block">
                        <NeuralButton variant="primary" className="w-full h-12 shadow-lg shadow-teal-500/20">
                            <Home className="w-4 h-4 mr-2" /> Return to Dashboard
                        </NeuralButton>
                    </Link>

                    <Link href="/course" className="block">
                        <NeuralButton variant="glass" className="w-full h-12 bg-white/50 border border-slate-200">
                            <Search className="w-4 h-4 mr-2" /> Browse Courses
                        </NeuralButton>
                    </Link>
                </div>

                <div className="mt-12 text-xs text-slate-400 font-mono">
                    ERROR_CODE: NEURAL_PATH_NOT_FOUND
                </div>
            </div>
        </div>
    );
}
