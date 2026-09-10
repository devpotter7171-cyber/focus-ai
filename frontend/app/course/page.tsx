"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { NeuralSidebar as Sidebar } from "@/components/neural/Sidebar";
import { NeuralButton } from "@/components/neural/NeuralButton";
import { NeuralSkeleton } from "@/components/neural/NeuralSkeleton";
import {
    ChevronDown,
    Play,
    BookOpen,
    Check,
    Lock,
    ChevronRight,
    Grid
} from "lucide-react";
import { apiFetch, getCourseProgress } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import TopicPreviewModal from '@/components/TopicPreviewModal';

interface Subtopic {
    id: string;
    title: string;
    difficulty: number;
    completed: boolean;
    isConfused?: boolean;
}

interface Unit {
    id: string;
    title: string;
    description?: string;
    progress: number;
    subtopics: Subtopic[];
}

interface Course {
    id: string;
    title: string;
    description: string;
    units: Unit[];
    totalProgress?: number;
}

export default function CourseOverviewPage() {
    const router = useRouter();
    const { user } = useAuth();

    // State to handle multiple courses
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);

    // Manage expanded states. 'expandedCourse' tracks which course is open.
    // 'expandedUnits' tracks which units within a course are open.
    const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
    const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

    // Modal State
    const [selectedTopic, setSelectedTopic] = useState<Subtopic | null>(null);
    const [selectedTopicUnit, setSelectedTopicUnit] = useState<string>("");
    const [selectedTopicCourse, setSelectedTopicCourse] = useState<string>("");
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Protected Route
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    const searchParams = useSearchParams();
    const expandId = searchParams.get('expand');

    useEffect(() => {
        if (expandId && !loading && courses.length > 0) {
            setExpandedCourse(expandId);
        }
    }, [expandId, loading, courses]);

    // Fetch Courses
    useEffect(() => {
        async function fetchCourses() {
            try {
                const fetchedCourses = await apiFetch<Course[]>('/courses/');

                if (!Array.isArray(fetchedCourses)) {
                    console.error("Invalid courses format:", fetchedCourses);
                    setCourses([]);
                    return;
                }

                // For each course, fetch units and progress
                const enrichedCourses = await Promise.all(fetchedCourses.map(async (course) => {
                    let units: Unit[] = [];
                    try {
                        units = await apiFetch<Unit[]>(`/courses/${course.id}/units`);
                    } catch (e) {
                        console.warn(`Could not fetch units for ${course.id}`, e);
                    }

                    let completedSubtopics: string[] = [];
                    let confusedSubtopics: string[] = [];
                    try {
                        if (user?.uid) {
                            const progressData = await getCourseProgress(course.id, user.uid);
                            completedSubtopics = progressData.completed_subtopics || [];
                            confusedSubtopics = progressData.confused_subtopics || [];
                        }
                    } catch (e) {
                        console.warn(`Could not fetch progress for ${course.id}`, e);
                    }

                    const enrichedUnits = units.map((unit) => {
                        const subtopics = (unit.subtopics || []).map((sub) => ({
                            ...sub,
                            difficulty: 3,
                            completed: completedSubtopics.includes(sub.id),
                            isConfused: confusedSubtopics.includes(sub.id)
                        }));

                        const completedCount = subtopics.filter(s => s.completed).length;
                        const progress = subtopics.length > 0 ? (completedCount / subtopics.length) * 100 : 0;

                        return {
                            ...unit,
                            description: unit.description || `Content for ${unit.title}`,
                            progress: Math.round(progress),
                            subtopics
                        };
                    });

                    const overallProgress = enrichedUnits.length > 0
                        ? enrichedUnits.reduce((acc, u) => acc + u.progress, 0) / enrichedUnits.length
                        : 0;

                    return {
                        ...course,
                        units: enrichedUnits,
                        totalProgress: Math.round(overallProgress)
                    };
                }));

                setCourses(enrichedCourses);

            } catch (error) {
                console.error("Failed to fetch courses:", error);
            } finally {
                setLoading(false);
            }
        }

        if (user) {
            fetchCourses();
        }
    }, [user]);

    const handleSeedData = async () => {
        try {
            await apiFetch('/admin/seed', { method: 'POST', includeAuth: true });
            window.location.reload();
        } catch (error) {
            console.error("Failed to seed data:", error);
        }
    };

    const handleTopicClick = (unitId: string, topic: Subtopic, isLocked: boolean, courseId: string) => {
        if (isLocked) return;
        setSelectedTopic(topic);
        setSelectedTopicUnit(unitId);
        setSelectedTopicCourse(courseId);
        setIsPreviewOpen(true);
    };

    const toggleUnit = (unitId: string) => {
        const newSet = new Set(expandedUnits);
        if (newSet.has(unitId)) {
            newSet.delete(unitId);
        } else {
            newSet.add(unitId);
        }
        setExpandedUnits(newSet);
    };

    // Monochrome difficulty labels
    const getDifficultyInfo = (difficulty: number) => {
        if (difficulty <= 2) return { label: 'Easy', color: 'text-slate-500' };
        if (difficulty <= 3) return { label: 'Medium', color: 'text-slate-600' };
        return { label: 'Hard', color: 'text-slate-800' };
    };

    if (loading) {
        return (
            <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
                <Sidebar className="hidden md:flex flex-shrink-0" />
                <main className="flex-1 flex flex-col p-8 md:pl-60 overflow-y-auto">
                    <div className="max-w-5xl mx-auto w-full space-y-8">
                        <NeuralSkeleton className="h-24 w-full rounded-[2rem]" />
                        <NeuralSkeleton className="h-24 w-full rounded-[2rem]" />
                    </div>
                </main>
            </div>
        );
    }

    if (courses.length === 0) {
        return (
            <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
                <Sidebar className="hidden md:flex flex-shrink-0" />
                <main className="flex-1 flex flex-col items-center justify-center p-8">
                    <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-soft border border-slate-100 text-center">
                        <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-6" />
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">No Courses Found</h3>
                        <NeuralButton onClick={handleSeedData} className="w-full mt-4">Seed Data</NeuralButton>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-transparent text-slate-800 font-sans overflow-hidden">
            <Sidebar className="hidden md:flex flex-shrink-0" />

            <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col p-4 md:p-8 md:pl-60 overflow-y-auto">
                <header className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Your Courses</h1>
                </header>

                <div className="max-w-5xl mx-auto w-full space-y-6">
                    {courses.map((course) => {
                        const isExpanded = expandedCourse === course.id;

                        return (
                            <motion.div
                                key={course.id}
                                layout
                                className={`bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden transition-all duration-300`}
                            >
                                {/* Course Header / Card */}
                                <div
                                    className="p-6 md:p-8 cursor-pointer bg-white transition-colors"
                                    onClick={() => setExpandedCourse(isExpanded ? null : course.id)}
                                >
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-6">
                                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-800">
                                                <Grid className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">{course.title}</h2>
                                                <p className="text-slate-500 text-sm">{course.description}</p>

                                                {/* Mini Stats when collapsed */}
                                                {!isExpanded && (
                                                    <div className="flex items-center gap-4 mt-3 text-sm font-medium text-slate-600">
                                                        <span>{course.units.length} Units</span>
                                                        <span>•</span>
                                                        <span>{course.totalProgress}% Complete</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className={`w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                            <ChevronDown className="w-5 h-5 text-slate-600" />
                                        </div>
                                    </div>

                                    {/* Progress Bar for Course */}
                                    <div className="mt-6 w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-slate-900 rounded-full transition-all duration-1000"
                                            style={{ width: `${course.totalProgress}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Expanded Content: Units List */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="border-t border-slate-100 bg-white"
                                        >
                                            <div className="p-6 space-y-4">
                                                {course.units.map((unit, idx) => {
                                                    return (
                                                        <div key={unit.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                                            <button
                                                                onClick={() => toggleUnit(unit.id)}
                                                                className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors text-left"
                                                            >
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm
                                                                        ${unit.progress === 100 ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                                                        {unit.progress === 100 ? <Check size={18} /> : idx + 1}
                                                                    </div>
                                                                    <div>
                                                                        <h3 className="font-bold text-slate-900">{unit.title}</h3>
                                                                        <p className="text-xs text-slate-500">{unit.subtopics.length} topics</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-4">
                                                                    <span className="text-sm font-bold text-slate-900">{unit.progress}%</span>
                                                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${expandedUnits.has(unit.id) ? 'rotate-180' : ''}`} />
                                                                </div>
                                                            </button>

                                                            <AnimatePresence>
                                                                {expandedUnits.has(unit.id) && (
                                                                    <motion.div
                                                                        initial={{ height: 0 }}
                                                                        animate={{ height: 'auto' }}
                                                                        exit={{ height: 0 }}
                                                                        className="border-t border-slate-100"
                                                                    >
                                                                        <div className="p-2 space-y-1">
                                                                            {unit.subtopics.map((topic, tIdx) => {
                                                                                const isNextUp = !topic.completed && (tIdx === 0 || unit.subtopics[tIdx - 1]?.completed);
                                                                                const isLocked = !topic.completed && !isNextUp;

                                                                                const isConfused = topic.isConfused;

                                                                                return (
                                                                                    <div
                                                                                        key={topic.id}
                                                                                        onClick={() => handleTopicClick(unit.id, topic, isLocked, course.id)}
                                                                                        className={`flex items-center gap-4 p-3 rounded-xl transition-all border cursor-pointer
                                                                                            ${topic.completed
                                                                                                ? 'bg-transparent border-transparent hover:bg-slate-50'
                                                                                                : isNextUp
                                                                                                    ? 'bg-white border-slate-200 shadow-sm'
                                                                                                    : 'opacity-50 cursor-not-allowed border-transparent'
                                                                                            }
                                                                                            ${isConfused ? 'ring-2 ring-amber-100 bg-amber-50/50' : ''}`}
                                                                                    >
                                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 relative
                                                                                            ${topic.completed ? 'bg-slate-100 text-slate-800' : isNextUp ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-300'}`}>
                                                                                            {topic.completed ? <Check size={14} /> : isNextUp ? <Play size={12} fill="currentColor" /> : <Lock size={12} />}

                                                                                            {/* Confusion Badge */}
                                                                                            {isConfused && (
                                                                                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white" title="Needs review" />
                                                                                            )}
                                                                                        </div>

                                                                                        <div className="flex-1">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <span className={`text-sm font-bold ${topic.completed ? 'text-slate-500' : 'text-slate-900'}`}>{topic.title}</span>
                                                                                                {isNextUp && <span className="text-[10px] font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded-full border border-slate-200">START</span>}
                                                                                                {isConfused && <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">REVIEW</span>}
                                                                                            </div>
                                                                                            <div className="flex items-center gap-3 mt-0.5">
                                                                                                <span className="text-xs text-slate-400 font-medium">{getDifficultyInfo(topic.difficulty).label}</span>
                                                                                                <span className="text-xs text-slate-400 flex items-center gap-1"><BookOpen size={10} /> Reading</span>
                                                                                            </div>
                                                                                        </div>

                                                                                        {!isLocked && <ChevronRight className="w-4 h-4 text-slate-300" />}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>

                {selectedTopic && (
                    <TopicPreviewModal
                        isOpen={isPreviewOpen}
                        onClose={() => setIsPreviewOpen(false)}
                        topic={selectedTopic}
                        unitId={selectedTopicUnit}
                        courseId={selectedTopicCourse}
                    />
                )}
            </main>
        </div>
    );
}
