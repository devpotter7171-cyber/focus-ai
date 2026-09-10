"use client";

import React from "react";
import {
    Home,
    BookOpen,
    LayoutGrid,
    Zap,
    History,
    Network,
    LucideIcon,
    Users,
    BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface SidebarProps {
    className?: string;
}

export function NeuralSidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const { profile } = useAuth();
    const isTeacher = profile?.role === "teacher" || profile?.role === "admin";

    const [courses, setCourses] = React.useState<{ id: string, title: string }[]>([]);
    // We don't use the loading flag in the UI yet, but keep the setter
    // so the fetch effect stays self-contained.
    const [, setLoadingCourses] = React.useState(true);

    React.useEffect(() => {
        // Fetch courses for sidebar
        async function fetchMyCourses() {
            try {
                const { apiFetch } = await import('@/lib/api');
                const data = await apiFetch<{ id: string, title: string }[]>('/courses/');
                if (Array.isArray(data)) {
                    setCourses(data);
                }
            } catch (e) {
                console.error("Sidebar: Failed to fetch courses", e);
            } finally {
                setLoadingCourses(false);
            }
        }
        fetchMyCourses();
    }, []);

    const navItems = isTeacher
        ? [
            { icon: BarChart3, label: "Overview", href: "/teacher/dashboard" },
            { icon: Users, label: "Classes", href: "/teacher/classes" },
            { icon: BookOpen, label: "Curriculum", href: "/teacher/curriculum" },
            { icon: LayoutGrid, label: "ML Monitor", href: "/teacher/ml-monitor" },
            { icon: Zap, label: "Experiments", href: "/teacher/experiments" },
        ]
        : [
            { icon: Home, label: "Home", href: "/dashboard" },
            { icon: BookOpen, label: "Courses", href: "/course" },
            { icon: Users, label: "My Classes", href: "/classes" },
            { icon: Network, label: "Competencies", href: "/competencies" },
            { icon: History, label: "Progress", href: "/progress" },
        ];

    return (
        <div className={cn(
            "fixed left-6 top-6 bottom-6 w-48 flex flex-col py-6 rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 z-50 overflow-y-auto scrollbar-hide",
            className
        )}>
            {/* Logo Area */}
            <div className="mb-0 px-6 w-full flex-shrink-0">
                <h1 className="text-xl font-bold text-slate-800">
                    Focus-AI
                </h1>
                <div className="w-full h-px bg-slate-200 mt-4 mb-6" />
            </div>

            {/* Main Navigation */}
            <div className="flex flex-col gap-2 w-full px-4 flex-shrink-0">
                {navItems.map((item, index) => (
                    <NavIcon
                        key={index}
                        icon={item.icon}
                        label={item.label}
                        active={pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href))}
                        href={item.href}
                    />
                ))}
            </div>

            {/* My Courses Section (students only) */}
            {!isTeacher && courses.length > 0 && (
                <div className="flex flex-col gap-2 w-full px-4 mt-8 flex-shrink-0">
                    <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">My Courses</p>
                    {courses.map((course) => (
                        <Link
                            key={course.id}
                            href={`/course?expand=${course.id}`}
                            className={cn(
                                "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer",
                                "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 text-xs">
                                {course.title.charAt(0)}
                            </div>
                            <span className="font-medium text-xs truncate">{course.title}</span>
                        </Link>
                    ))}
                </div>
            )}

            {/* Bottom Navigation */}
            <div className="flex flex-col gap-2 w-full px-4 mt-auto pb-2 flex-shrink-0">

                {/* User Profile */}
                <Link href="/settings">
                    <div className="mt-4 flex items-center gap-4 px-2 cursor-pointer group hover:bg-slate-100 p-2 rounded-2xl transition-colors">
                        <div className="w-10 h-10 rounded-full bg-slate-900 border-2 border-white/50 shadow-lg overflow-hidden flex items-center justify-center text-white font-medium text-sm group-hover:scale-105 transition-transform">
                            {(profile?.full_name || profile?.email || "U").trim().charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">
                                {profile?.full_name || profile?.email?.split("@")[0] || "Account"}
                            </p>
                            <p className="text-xs text-slate-500 capitalize">
                                {profile?.role || "Student"}
                            </p>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}

function NavIcon({ icon: Icon, label, active, href }: { icon: LucideIcon, label: string, active: boolean, href: string }) {
    return (
        <Link
            href={href}
            className={cn(
                "flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group cursor-pointer",
                active
                    ? "bg-black text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            )}
        >
            <Icon size={22} strokeWidth={active ? 2.5 : 2} />
            <span className="font-semibold text-sm">{label}</span>
        </Link>
    );
}
