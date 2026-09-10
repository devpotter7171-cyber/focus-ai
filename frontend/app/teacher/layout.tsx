"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
    BarChart3,
    Users,
    BookOpen,
    Brain,
    FlaskConical,
    Settings,
    LogOut,
    GraduationCap,
    ChevronRight,
    Activity,
    type LucideIcon,
} from "lucide-react";

/**
 * Independent Faculty Layout.
 *
 * This layout wraps ALL /teacher/* routes and provides:
 *   1. Role-based access guard (redirects non-teachers to /dashboard)
 *   2. Dedicated faculty sidebar (separate from student sidebar)
 *   3. Faculty-specific header with role badge
 *   4. Clean separation — no shared components with student app
 *
 * The faculty app is now self-contained: its own navigation, its own
 * visual identity (subtle purple accent), and its own mental model.
 */

interface NavItem {
    icon: LucideIcon;
    label: string;
    href: string;
    description?: string;
}

const FACULTY_NAV: NavItem[] = [
    {
        icon: BarChart3,
        label: "Overview",
        href: "/teacher/dashboard",
        description: "Student metrics & interventions",
    },
    {
        icon: Users,
        label: "Classes",
        href: "/teacher/classes",
        description: "Manage cohorts & join codes",
    },
    {
        icon: BookOpen,
        label: "Curriculum",
        href: "/teacher/curriculum",
        description: "Edit course content",
    },
    {
        icon: Brain,
        label: "ML Monitor",
        href: "/teacher/ml-monitor",
        description: "Model health & inference",
    },
    {
        icon: FlaskConical,
        label: "Experiments",
        href: "/teacher/experiments",
        description: "A/B tests & bandit arms",
    },
    {
        icon: Activity,
        label: "LLM Usage",
        href: "/teacher/llm-usage",
        description: "Token budgets & model routing",
    },
];

export default function TeacherLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { profile, loading, signOut } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    // Role guard — redirect non-teachers
    useEffect(() => {
        if (loading) return;
        if (!profile) {
            router.push("/login");
            return;
        }
        if (profile.role !== "teacher" && profile.role !== "admin") {
            router.push("/dashboard");
        }
    }, [profile, loading, router]);

    // Show nothing while checking auth
    if (loading || !profile) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-3 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                    <p className="text-sm text-slate-500 font-medium">Loading faculty portal…</p>
                </div>
            </div>
        );
    }

    if (profile.role !== "teacher" && profile.role !== "admin") {
        return null; // Will redirect
    }

    const initials = (profile.full_name || profile.email || "F")
        .trim()
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

    return (
        <div className="flex h-screen w-full bg-slate-50 text-slate-800 font-sans overflow-hidden">
            {/* ─── Faculty Sidebar ─────────────────────────────────────── */}
            <aside className="fixed left-0 top-0 bottom-0 w-64 flex flex-col bg-white border-r border-slate-200 z-50 overflow-y-auto">
                {/* Brand */}
                <div className="p-6 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                            <GraduationCap size={18} />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-slate-900">Focus-AI</h1>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-600">
                                Faculty Portal
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1">
                    {FACULTY_NAV.map((item) => {
                        const isActive =
                            pathname === item.href ||
                            (item.href !== "/teacher/dashboard" &&
                                pathname?.startsWith(item.href));
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                                    isActive
                                        ? "bg-purple-50 text-purple-700 border border-purple-100"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent",
                                )}
                            >
                                <item.icon
                                    size={18}
                                    strokeWidth={isActive ? 2.5 : 2}
                                    className={cn(
                                        "shrink-0",
                                        isActive ? "text-purple-600" : "text-slate-400 group-hover:text-slate-600",
                                    )}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className={cn(
                                        "text-sm font-semibold truncate",
                                        isActive ? "text-purple-700" : "",
                                    )}>
                                        {item.label}
                                    </p>
                                    {item.description && (
                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                            {item.description}
                                        </p>
                                    )}
                                </div>
                                {isActive && (
                                    <ChevronRight size={14} className="text-purple-400 shrink-0" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer: Profile + Sign out */}
                <div className="p-4 border-t border-slate-100 space-y-2">
                    <Link
                        href="/settings"
                        className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                        <Settings size={16} />
                        <span className="text-sm font-medium">Settings</span>
                    </Link>
                    <button
                        onClick={async () => {
                            await signOut();
                            router.push("/login");
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    >
                        <LogOut size={16} />
                        <span className="text-sm font-medium">Sign out</span>
                    </button>

                    {/* Profile card */}
                    <div className="mt-3 flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="w-9 h-9 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">
                            {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-800 truncate">
                                {profile.full_name || profile.email?.split("@")[0] || "Faculty"}
                            </p>
                            <p className="text-[10px] text-purple-600 font-bold uppercase tracking-wider">
                                {profile.role === "admin" ? "Administrator" : "Instructor"}
                            </p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ─── Main Content ────────────────────────────────────────── */}
            <main
                id="main-content"
                tabIndex={-1}
                className="flex-1 ml-64 overflow-y-auto"
            >
                {children}
            </main>
        </div>
    );
}
