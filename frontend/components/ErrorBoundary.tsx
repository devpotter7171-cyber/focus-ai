"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-mesh flex items-center justify-center p-6">
                    <div className="max-w-md w-full glass p-8 rounded-[2rem] text-center border border-gray-100 shadow-elevated relative overflow-hidden">
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full blur-3xl -z-10 opacity-50"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -z-10 opacity-50"></div>

                        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                            <AlertTriangle className="h-8 w-8 text-red-500" />
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
                        <p className="text-gray-500 mb-8 leading-relaxed">
                            We encountered an unexpected error. Our team has been notified.
                        </p>

                        <div className="flex flex-col gap-3">
                            <Button
                                size="lg"
                                className="w-full h-12 rounded-xl bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-200"
                                onClick={() => window.location.reload()}
                            >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Try Again
                            </Button>
                            <Button
                                variant="ghost"
                                size="lg"
                                className="w-full h-12 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                asChild
                            >
                                <Link href="/dashboard">
                                    <Home className="mr-2 h-4 w-4" />
                                    Return to Dashboard
                                </Link>
                            </Button>
                        </div>

                        <div className="mt-8 pt-6 border-t border-gray-100">
                            <p className="text-xs text-gray-400 font-mono break-all">
                                {this.state.error?.message || "Unknown error"}
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
