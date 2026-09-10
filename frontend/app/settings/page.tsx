"use client";

import { useState, useEffect } from 'react';
import { NeuralSidebar as Sidebar } from "@/components/neural/Sidebar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { NeuralButton } from "@/components/neural/NeuralButton";
import {
    User,
    Zap,
    Bell,
    Shield,
    Check,
    Save,
    LogOut
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

type Pace = 'intense' | 'moderate' | 'relaxed';

// Maps the UI's qualitative pace onto the backend's 1-5 difficulty level.
// Backend constraint: must be int in [1, 5]. Lower = harder.
const PACE_TO_LEVEL: Record<Pace, number> = {
    intense: 1,
    moderate: 3,
    relaxed: 5,
};

const STORAGE_KEY = 'focusai.learningPace';

export default function SettingsPage() {
    const { user, loading, signOut } = useAuth(); // Connect to AuthContext
    const { toast } = useToast();
    const router = useRouter(); // Import useRouter

    // Protect Route
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const [learningPace, setLearningPace] = useState<Pace>('moderate');
    const [saving, setSaving] = useState(false);
    const [notifications, setNotifications] = useState({
        weekly: true,
        security: true,
        adaptive: true,
        reminders: false,
        milestones: true,
    });

    // Restore the user's last choice from localStorage on mount.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const saved = window.localStorage.getItem(STORAGE_KEY) as Pace | null;
        if (saved && saved in PACE_TO_LEVEL) {
            setLearningPace(saved);
        }
    }, []);

    const handleSave = async () => {
        if (!user?.uid) {
            toast({
                title: 'Not signed in',
                description: 'Sign in to save preferences.',
                variant: 'destructive',
            });
            return;
        }

        setSaving(true);
        try {
            await apiFetch('/behavior/preference', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: user.uid,
                    level: PACE_TO_LEVEL[learningPace],
                }),
            });
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(STORAGE_KEY, learningPace);
            }
            toast({
                title: 'Settings Saved',
                description: 'Your learning pace has been updated.',
            });
        } catch (err) {
            console.error('Failed to save preference:', err);
            toast({
                title: 'Save failed',
                description: 'Could not save your preference. Try again.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            router.push('/login');
        } catch (error) {
            console.error("Sign out failed", error);
            toast({
                title: "Error",
                description: "Failed to sign out. Please try again.",
                variant: "destructive"
            });
        }
    };

    const toggleNotification = (key: keyof typeof notifications) => {
        setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // Derived user initials
    const initials = user?.displayName
        ? user.displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
        : user?.email?.substring(0, 2).toUpperCase() || 'U';

    const [firstName, lastName] = user?.displayName ? user.displayName.split(' ') : ['Student', 'User'];

    return (
        <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
            <Sidebar className="hidden md:flex" />

            <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col p-8 md:pl-60 overflow-y-auto">
                {/* Header */}
                <header className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <MobileSidebar />
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 mb-2">Settings</h1>
                            <p className="text-slate-500">Manage your profile and cognitive preferences.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <NeuralButton
                            variant="primary"
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-900/20"
                        >
                            <Save size={16} className="mr-2" />
                            {saving ? 'Saving…' : 'Save Changes'}
                        </NeuralButton>
                    </div>
                </header>

                <div className="max-w-4xl mx-auto w-full space-y-8">

                    {/* Profile Section */}
                    <section className="bg-white rounded-[2rem] p-8 shadow-soft border border-slate-100">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                                <div className="p-2 bg-slate-100 rounded-xl">
                                    <User size={20} className="text-slate-600" />
                                </div>
                                Profile
                            </h2>
                        </div>

                        <div className="flex flex-col md:flex-row items-start gap-8">
                            <div className="relative group cursor-pointer">
                                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-teal-500/30">
                                    {initials}
                                </div>
                                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">
                                    Change
                                </div>
                            </div>

                            <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-500 ml-1">First Name</label>
                                    <input
                                        type="text"
                                        value={firstName}
                                        disabled
                                        className="w-full px-5 py-3 bg-slate-100 border-transparent rounded-2xl text-slate-500 font-medium cursor-not-allowed"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-slate-500 ml-1">Last Name</label>
                                    <input
                                        type="text"
                                        value={lastName || ''}
                                        disabled
                                        className="w-full px-5 py-3 bg-slate-100 border-transparent rounded-2xl text-slate-500 font-medium cursor-not-allowed"
                                    />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm font-semibold text-slate-500 ml-1">Email Address</label>
                                    <input
                                        type="email"
                                        defaultValue={user?.email || ''}
                                        disabled
                                        className="w-full px-5 py-3 bg-slate-100 border-transparent rounded-2xl text-slate-500 font-medium cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Learning Pace */}
                    <section className="bg-white rounded-[2rem] p-8 shadow-soft border border-slate-100">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                                <div className="p-2 bg-amber-50 rounded-xl">
                                    <Zap size={20} className="text-amber-500" />
                                </div>
                                Learning Pace
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { value: 'intense', label: 'Intense', desc: 'Fast-paced, minimal hints', color: 'bg-rose-50 border-rose-100' },
                                { value: 'moderate', label: 'Moderate', desc: 'Balanced approach', color: 'bg-teal-50 border-teal-100' },
                                { value: 'relaxed', label: 'Relaxed', desc: 'Extra help available', color: 'bg-indigo-50 border-indigo-100' },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => setLearningPace(option.value as Pace)}
                                    className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-300 group
                                        ${learningPace === option.value
                                            ? `${option.color} ring-1 ring-offset-2 ring-slate-100`
                                            : 'bg-white border-slate-100 hover:border-slate-200 hover:-translate-y-1'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`font-bold ${learningPace === option.value ? 'text-slate-900' : 'text-slate-600'}`}>
                                            {option.label}
                                        </span>
                                        {learningPace === option.value && (
                                            <div className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center scale-100 transition-transform">
                                                <Check className="h-3 w-3 text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium leading-relaxed">{option.desc}</p>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Notifications */}
                    <section className="bg-white rounded-[2rem] p-8 shadow-soft border border-slate-100">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-3">
                                <div className="p-2 bg-purple-50 rounded-xl">
                                    <Bell size={20} className="text-purple-500" />
                                </div>
                                Notifications
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                            {[
                                { key: 'weekly', label: 'Weekly Reports', desc: 'Summary of your progress' },
                                { key: 'security', label: 'Security Alerts', desc: 'Login attempts & password changes' },
                                { key: 'adaptive', label: 'AI Reach-outs', desc: 'Hints when you are stuck' },
                                { key: 'milestones', label: 'Achievements', desc: 'Badge unlocks & streak alerts' },
                            ].map((item) => (
                                <div key={item.key} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => toggleNotification(item.key as keyof typeof notifications)}>
                                    <div>
                                        <p className="font-bold text-slate-700 text-sm">{item.label}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
                                    </div>
                                    <div className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${notifications[item.key as keyof typeof notifications] ? 'bg-teal-500' : 'bg-slate-200'}`}>
                                        <div className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-300 ${notifications[item.key as keyof typeof notifications] ? 'translate-x-5' : ''}`} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Danger Zone */}
                    <section className="bg-rose-50/50 rounded-[2rem] p-8 border border-rose-100/50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">Data Privacy</h3>
                                    <p className="text-sm text-slate-500">Your learning data is encrypted and never shared with third parties.</p>
                                </div>
                            </div>
                            <NeuralButton
                                variant="ghost"
                                className="text-rose-600 hover:bg-rose-100 hover:text-rose-700"
                                onClick={handleSignOut}
                            >
                                <LogOut size={16} className="mr-2" />
                                Sign Out
                            </NeuralButton>
                        </div>
                    </section>

                </div>
            </main>
        </div>
    );
}
