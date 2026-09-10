"use client";

import { useEffect } from "react";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="min-h-screen bg-[#fafbfc] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-soft border border-slate-100 text-center">
                <div className="w-20 h-20 bg-rose-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-sm border border-rose-100">
                    <AlertTriangle className="w-10 h-10 text-rose-500" />
                </div>

                <h2 className="text-2xl font-bold text-slate-900 mb-2">System Malfunction</h2>
                <p className="text-slate-500 mb-8 leading-relaxed">
                    Our neural networks encountered an unexpected anomaly. The issue has been logged for analysis.
                </p>

                <div className="space-y-3">
                    <NeuralButton
                        onClick={reset}
                        variant="primary"
                        className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" /> Reboot Session
                    </NeuralButton>

                    <Link href="/dashboard" className="block">
                        <NeuralButton
                            variant="ghost"
                            className="w-full h-12 text-slate-500 hover:text-slate-900"
                        >
                            <Home className="w-4 h-4 mr-2" /> Emergency Exit
                        </NeuralButton>
                    </Link>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-50 text-[10px] text-slate-300 font-mono break-all">
                    ID: {error.digest || "UNKNOWN_ERROR"}
                </div>
            </div>
        </div>
    );
}
