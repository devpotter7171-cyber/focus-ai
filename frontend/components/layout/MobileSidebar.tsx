"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { NeuralButton } from "@/components/neural/NeuralButton";
import { NeuralBadge } from "@/components/neural/NeuralBadge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
    Home,
    BookOpen,
    BarChart3,
    Target,
    Settings,
    Brain,
    Sparkles,
    Zap,
    LogOut,
    Menu
} from "lucide-react";
import { useState } from 'react';
import { useAuth } from "@/context/AuthContext";

const navItems = [
    { href: '/dashboard', icon: Home, label: 'Dashboard', badge: null },
    { href: '/course', icon: BookOpen, label: 'Courses', badge: null },
    { href: '/progress', icon: BarChart3, label: 'Progress', badge: null },
    { href: '/review', icon: Target, label: 'Review', badge: null },
    { href: '/settings', icon: Settings, label: 'Settings', badge: null },
];

const adminItems = [
    { href: '/teacher/dashboard', icon: BarChart3, label: 'Teacher View' },
    { href: '/teacher/ml-monitor', icon: Brain, label: 'ML Monitor' },
    { href: '/teacher/experiments', icon: Zap, label: 'Experiments' },
];

export function MobileSidebar() {
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const { profile, signOut } = useAuth();

    const isTeacher = profile?.role === "teacher" || profile?.role === "admin";

    const displayName = profile?.full_name || profile?.email?.split("@")[0] || "User";
    const initials = displayName.charAt(0).toUpperCase();
    const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : "Student";

    const handleSignOut = async () => {
        setOpen(false);
        await signOut();
    };

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <div className="md:hidden">
                    <NeuralButton variant="ghost" className="h-10 w-10" aria-label="Open navigation menu">
                        <Menu className="h-5 w-5" />
                    </NeuralButton>
                </div>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] p-0 border-r border-slate-200 bg-white">
                <div className="h-full flex flex-col">
                    {/* Logo */}
                    <div className="h-20 flex items-center px-6 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-[1rem] bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-900/10 shrink-0">
                                <Brain className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-900 tracking-tight text-lg">Focus-AI</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Adaptive Learning</span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-6 overflow-y-auto space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 mb-3 px-3 uppercase tracking-widest">
                            Menu
                        </p>
                        {navItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                            return (
                                <Link
                                    href={item.href}
                                    key={item.href}
                                    className="block mb-1"
                                    onClick={() => setOpen(false)}
                                >
                                    <div className={`flex items-center h-11 px-3 rounded-xl transition-all duration-200 
                                        ${isActive
                                            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/10'
                                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}
                                    `}>
                                        <item.icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-white' : ''}`} />
                                        <span className="ml-3 font-medium text-sm flex-1">
                                            {item.label}
                                        </span>
                                        {item.badge && (
                                            <NeuralBadge variant="secondary" size="sm" className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none">
                                                {item.badge}
                                            </NeuralBadge>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}

                        {/* Admin Section — only shown for teachers/admins */}
                        {isTeacher && (
                            <div className="pt-6 mt-6 border-t border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 mb-3 px-3 uppercase tracking-widest flex items-center gap-2">
                                    <Sparkles className="w-3 h-3 text-indigo-500" />
                                    Instructor Tools
                                </p>
                                {adminItems.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            href={item.href}
                                            key={item.href}
                                            className="block mb-1"
                                            onClick={() => setOpen(false)}
                                        >
                                            <div className={`flex items-center h-10 px-3 rounded-xl transition-all duration-200 
                                                ${isActive
                                                    ? 'bg-teal-50 text-teal-700 font-medium'
                                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}
                                            `}>
                                                <item.icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-teal-600' : ''}`} />
                                                <span className="ml-3 text-sm flex-1">
                                                    {item.label}
                                                </span>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </nav>

                    {/* Footer */}
                    <div className="px-4 py-4 border-t border-slate-100 bg-slate-50/50">
                        <div className="flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-xs shrink-0 border-2 border-white shadow-sm">
                                {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{displayName}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{roleLabel}</p>
                            </div>
                            <button
                                onClick={handleSignOut}
                                className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                                aria-label="Sign out"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
