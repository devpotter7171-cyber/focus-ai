"use client";

import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { AlertCircle } from "lucide-react";
import { useAccessibility } from "@/hooks/useAccessibility";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { announce } = useAccessibility();

    // Welcome announcement so a blind user lands here and immediately knows
    // what's expected. Voice command "submit form" can finish the flow.
    useEffect(() => {
        announce(
            "Sign in page. Two fields: email and password. Say 'submit form' or press Enter to sign in. Say 'sign up' to create a new account.",
        );
        // run once
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await signInWithEmailAndPassword(auth, email, password);

            // Role-aware redirect. We hit /auth/me ourselves rather than
            // waiting for the AuthContext effect so the navigation is
            // deterministic.
            try {
                const me = await apiFetch<{ role?: string }>('/auth/me');
                if (me?.role === 'teacher' || me?.role === 'admin') {
                    router.push('/teacher/dashboard');
                    return;
                }
            } catch (profileErr) {
                console.warn('Could not fetch role; defaulting to student dashboard.', profileErr);
            }
            router.push("/dashboard");
        } catch (error: any) {
            console.error(error);
            let errorMessage = "Invalid email or password.";

            if (error?.code) {
                switch (error.code) {
                    case 'auth/invalid-credential':
                    case 'auth/user-not-found':
                    case 'auth/wrong-password':
                        errorMessage = "Invalid email or password.";
                        break;
                    case 'auth/too-many-requests':
                        errorMessage = "Too many attempts. Please try again later.";
                        break;
                    case 'auth/user-disabled':
                        errorMessage = "This account has been disabled.";
                        break;
                    default:
                        errorMessage = "Failed to sign in. Please check your connection.";
                }
            }

            setError(errorMessage);
            announce(errorMessage, { assertive: true });
        } finally {
            setLoading(false);
        }
    };

    return (
        <main id="main-content" tabIndex={-1} className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <div className="bg-white/80 backdrop-blur-xl border-2 border-black rounded-2xl p-10">

                    <h1 className="text-3xl font-bold text-slate-900 text-center mb-2 tracking-tight">Welcome back</h1>
                    <p className="text-slate-500 text-center mb-10">Sign in to continue learning.</p>

                    <form onSubmit={handleLogin} className="space-y-5" noValidate>
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-700 font-semibold ml-1">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="Student ID"
                                required
                                value={email}
                                autoComplete="username"
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (error) setError("");
                                }}
                                className="h-12 border border-black bg-slate-50 focus:bg-white focus:!border-black focus:!ring-0 focus:!shadow-none rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-1">
                                <Label htmlFor="password" className="text-slate-700 font-semibold">Password</Label>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                autoComplete="current-password"
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (error) setError("");
                                }}
                                className="h-12 border border-black bg-slate-50 focus:bg-white focus:!border-black focus:!ring-0 focus:!shadow-none rounded-xl"
                            />
                        </div>

                        {error && (
                            <motion.div
                                role="alert"
                                className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-center gap-3"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                {error}
                            </motion.div>
                        )}

                        <NeuralButton
                            type="submit"
                            variant="primary"
                            className="w-full h-14 text-lg bg-black hover:bg-neutral-800 text-white !shadow-none hover:!shadow-none hover:!translate-y-0"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3" />
                                    Authenticating...
                                </>
                            ) : (
                                "Sign in"
                            )}
                        </NeuralButton>
                    </form>

                    <div className="mt-8 text-sm text-slate-500 text-center">
                        Don't have an account?{" "}
                        <Link href="/signup" className="font-bold text-black hover:underline">
                            Create Account
                        </Link>
                    </div>
                </div>
            </motion.div>
        </main>
    );
}
