"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NeuralSidebar as Sidebar } from "@/components/neural/Sidebar";
import { MobileSidebar } from "@/components/layout/MobileSidebar";
import { ActiveSessionCard } from "@/components/neural/ActiveSessionCard";
import { NeuralCardSkeleton, NeuralSkeleton } from "@/components/neural/NeuralSkeleton";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { StreakWidget, DailyGoalWidget, RecentActivityWidget, FocusEnergyWidget, UpcomingDeadlinesWidget } from "@/components/neural/DashboardWidgets";
import { TooltipProvider } from "@/components/ui/tooltip";

interface Course {
    id: string;
    title: string;
    description: string;
    progress?: number;
    lastAccessed?: string;
}

export default function NeuralDashboardPage() {
    const { user, profile, loading } = useAuth();
    const [courses, setCourses] = useState<Course[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    const router = useRouter();

    // Protect Route
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
        // Redirect new users who haven't completed onboarding
        if (!loading && user && profile && profile.onboarding_completed === false) {
            router.push('/onboarding');
        }
    }, [user, loading, router, profile]);

    useEffect(() => {
        async function fetchCoursesAndProgress() {
            try {
                // Artificial delay removed for performance


                const data = await apiFetch<Course[]>('/courses/');
                if (Array.isArray(data) && data.length > 0) {
                    const coursesWithProgress = await Promise.all(data.map(async (c) => {
                        try {
                            // Only fetch progress if user is logged in
                            if (user?.uid) {
                                const progressData = await apiFetch<{ completed_subtopics: string[] }>(`/courses/${c.id}/progress?user_id=${user.uid}`);
                                const completedCount = progressData.completed_subtopics.length;
                                const units = (c as any).units || [];
                                const totalTopics = units.reduce((acc: number, u: any) => acc + (u.subtopics?.length || 0), 0);
                                const progress = totalTopics > 0 ? Math.round((completedCount / totalTopics) * 100) : 0;
                                return { ...c, progress, lastAccessed: "Recently" };
                            } else {
                                return { ...c, progress: 0, lastAccessed: "Recently" };
                            }
                        } catch (e) {
                            return { ...c, progress: 0, lastAccessed: "Recently" };
                        }
                    }));
                    setCourses(coursesWithProgress);
                } else {
                    setCourses([]);
                }
            } catch (error) {
                console.error("Failed to fetch dashboard courses", error);
                setCourses([]);
            } finally {
                setIsLoadingData(false);
            }
        }
        fetchCoursesAndProgress();
    }, [user]);

    // Derived active course (most recent or first) — currently unused but
    // kept for the upcoming "resume last session" widget.
    void courses;

    const handleSeedData = async () => {
        try {
            await apiFetch('/admin/seed', { method: 'POST', includeAuth: true });
            window.location.reload();
        } catch (error) {
            console.error("Failed to seed data:", error);
        }
    };

    if (loading || isLoadingData) {
        return (
            <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
                <Sidebar className="hidden md:flex flex-shrink-0" />
                <main className="flex-1 flex flex-col p-8 md:pl-60 overflow-y-auto">
                    <header className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="md:hidden"><NeuralSkeleton className="w-10 h-10 rounded-xl" /></div>
                            <NeuralSkeleton className="w-32 h-8 rounded-lg" />
                        </div>
                        <div className="flex gap-3">
                            <NeuralSkeleton className="w-10 h-10 rounded-xl" />
                        </div>
                    </header>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <NeuralCardSkeleton />
                        <NeuralCardSkeleton />
                        <NeuralCardSkeleton />
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden relative">
            {/* 1. Left Sidebar (Floating) */}
            <Sidebar className="hidden md:flex" />

            {/* 2. Main Content Area */}
            <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col p-4 md:p-5 md:pl-60 overflow-y-auto scrollbar-hide">
                <TooltipProvider delayDuration={300}>
                    {/* Header */}
                    <header className="flex items-center justify-between mb-6 gap-4">
                        <div className="flex items-center gap-4 md:gap-10">
                            <MobileSidebar />
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">
                                    {(() => {
                                        const h = new Date().getHours();
                                        const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
                                        const name = profile?.full_name?.split(' ')[0];
                                        return name ? `${greeting}, ${name}` : greeting;
                                    })()}
                                </h1>
                                <p className="text-slate-500 text-sm mt-0.5">
                                    {courses.length > 0
                                        ? `${courses.length} course${courses.length > 1 ? 's' : ''} active · Keep the momentum going`
                                        : "Ready to start your learning journey?"
                                    }
                                </p>
                            </div>
                        </div>
                    </header>

                    <div className="flex flex-col xl:flex-row gap-4 h-full">
                        {/* Main Content: Course List & Bottom Widgets */}
                        <div className="flex-1 flex flex-col gap-4">

                            {/* Courses Section */}
                            <div className="flex-1 min-h-0">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg font-bold text-slate-900">My Courses</h3>
                                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                            {courses.length}
                                        </span>
                                    </div>
                                </div>

                                {courses.length > 0 ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {courses.map(course => (
                                            <div key={course.id} className="h-full">
                                                <ActiveSessionCard
                                                    courseId={course.id}
                                                    label="Enrolled"
                                                    courseTitle={course.title}
                                                    unitTitle={course.description}
                                                    progress={course.progress}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-dashed border-slate-300">
                                        <p className="text-slate-500 mb-2 text-sm">No active courses found.</p>
                                        <NeuralButton onClick={handleSeedData}>Seed Demo Data</NeuralButton>
                                    </div>
                                )}
                            </div>

                            {/* Bottom Widgets - Now inside left col for better spacing */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-2">
                                <UpcomingDeadlinesWidget />
                                <RecentActivityWidget />
                            </div>
                        </div>

                        {/* Right Widgets Column */}
                        <div className="w-full xl:w-[380px] grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0 h-min">
                            <div className="md:col-span-2">
                                <FocusEnergyWidget />
                            </div>
                            <StreakWidget />
                            <DailyGoalWidget />
                        </div>
                    </div>
                </TooltipProvider>
            </main>
        </div>
    );
}
