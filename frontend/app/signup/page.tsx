"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { AlertCircle, Check } from "lucide-react";
import { useAccessibility } from "@/hooks/useAccessibility";

export default function SignupPage() {
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const { announce } = useAccessibility();

    useEffect(() => {
        announce(
            "Sign up page. Four fields: full name, email, password, and confirm password. Say 'submit form' or press Enter to create your account. Say 'sign in' if you already have one.",
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            announce("Passwords do not match. Please try again.", { assertive: true });
            return;
        }
        setLoading(true);
        setError("");
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 1. Update Firebase Profile
            await updateProfile(user, {
                displayName: fullName
            });

            // 2. Sync with Backend (Postgres)
            const token = await user.getIdToken();
            await apiFetch('/auth/sync-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id_token: token,
                    full_name: fullName
                })
            });

            router.push("/onboarding");
        } catch (error: any) {
            console.error(error);
            let errorMessage = "Failed to create account.";

            if (error?.code) {
                switch (error.code) {
                    case 'auth/email-already-in-use':
                        errorMessage = "This email is already registered. Please sign in.";
                        break;
                    case 'auth/weak-password':
                        errorMessage = "Password should be at least 6 characters.";
                        break;
                    case 'auth/invalid-email':
                        errorMessage = "Please enter a valid email address.";
                        break;
                    case 'auth/network-request-failed':
                        errorMessage = "Network error. Please check your connection.";
                        break;
                    default:
                        errorMessage = error.message || "Something went wrong. Please try again.";
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


                    <h1 className="text-3xl font-serif font-bold text-slate-900 text-center mb-2 tracking-tight">Create Account</h1>
                    <p className="text-slate-500 text-center mb-10">Join the adaptive learning network.</p>

                    <form onSubmit={handleSignup} className="space-y-4" noValidate>
                        <div className="space-y-2">
                            <Label htmlFor="fullName" className="text-slate-700 font-semibold ml-1">Full Name</Label>
                            <Input
                                id="fullName"
                                type="text"
                                placeholder="John Doe"
                                required
                                value={fullName}
                                autoComplete="name"
                                onChange={(e) => {
                                    setFullName(e.target.value);
                                    if (error) setError("");
                                }}
                                className="h-12 border border-black bg-slate-50 focus:bg-white focus:!border-black focus:!ring-0 focus:!shadow-none rounded-xl"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-slate-700 font-semibold ml-1">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="student@university.edu"
                                required
                                value={email}
                                autoComplete="email"
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (error) setError("");
                                }}
                                className="h-12 border border-black bg-slate-50 focus:bg-white focus:!border-black focus:!ring-0 focus:!shadow-none rounded-xl"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-slate-700 font-semibold ml-1">Password</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                autoComplete="new-password"
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    if (error) setError("");
                                }}
                                className="h-12 border border-black bg-slate-50 focus:bg-white focus:!border-black focus:!ring-0 focus:!shadow-none rounded-xl"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-slate-700 font-semibold ml-1">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                required
                                value={confirmPassword}
                                autoComplete="new-password"
                                onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    if (error) setError("");
                                }}
                                className="h-12 border border-black bg-slate-50 focus:bg-white focus:!border-black focus:!ring-0 focus:!shadow-none rounded-xl"
                            />
                            {password && confirmPassword && (
                                <div className="pl-1">
                                    {password === confirmPassword ? (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex items-center gap-1 text-emerald-600 text-xs font-bold"
                                        >
                                            <Check className="h-3 w-3" />
                                            Passwords match
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="flex items-center gap-1 text-amber-600 text-xs font-bold"
                                        >
                                            <AlertCircle className="h-3 w-3" />
                                            Passwords do not match
                                        </motion.div>
                                    )}
                                </div>
                            )}
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
                            className="w-full h-14 text-lg bg-black hover:bg-neutral-800 text-white !shadow-none hover:!shadow-none hover:!translate-y-0 mt-4"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Creating Account...</span>
                                </div>
                            ) : (
                                "Join Focus-AI"
                            )}
                        </NeuralButton>
                    </form>

                    {/* Divider */}
                    <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-slate-200" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest text-slate-400">
                            <span className="bg-white px-2">OR</span>
                        </div>
                    </div>

                    <div className="mt-4">
                        <Link href="/login" className="w-full">
                            <NeuralButton
                                variant="glass"
                                className="w-full text-xs font-bold h-10 border border-slate-200 text-slate-600 rounded-xl"
                            >
                                Sign In
                            </NeuralButton>
                        </Link>
                    </div>

                </div>
            </motion.div>
        </main>
    );
}
