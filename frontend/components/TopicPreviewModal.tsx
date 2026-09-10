import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Clock, BarChart, BookOpen, Lock } from "lucide-react";
import { NeuralButton } from "@/components/neural/NeuralButton";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface TopicPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    topic: {
        id: string;
        title: string;
        difficulty: number;
        completed: boolean;
    };
    unitId: string;
    courseId: string;
}

export default function TopicPreviewModal({ isOpen, onClose, topic, unitId, courseId }: TopicPreviewModalProps) {
    if (!isOpen) return null;

    const getDifficultyLabel = (diff: number) => {
        if (diff <= 2) return "Beginner";
        if (diff <= 3) return "Intermediate";
        return "Advanced";
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50 px-4"
                    >
                        <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-900/20 overflow-hidden ring-1 ring-slate-900/5">
                            {/* Header Image / Pattern */}
                            <div className="h-32 bg-slate-900 relative overflow-hidden">
                                <button
                                    onClick={onClose}
                                    className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors backdrop-blur-md"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-8 -mt-6 relative bg-white rounded-t-[2rem]">
                                <div className="flex gap-2 mb-6">
                                    <div className="px-3 py-1 bg-slate-100 text-slate-900 rounded-full text-xs font-bold uppercase tracking-wider border border-slate-200">
                                        Unit {unitId.replace('u', '')}
                                    </div>
                                    <div className="px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold uppercase tracking-wider border border-slate-200">
                                        {getDifficultyLabel(topic.difficulty)}
                                    </div>
                                </div>

                                <h2 className="text-3xl font-bold text-slate-900 mb-3 leading-tight">{topic.title}</h2>
                                <p className="text-slate-500 mb-8 leading-relaxed text-lg">
                                    Master the core concepts of this topic through interactive lessons and adaptive quizzes.
                                </p>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-teal-50 border border-teal-100">
                                        <div className="p-3 bg-white rounded-2xl shadow-sm text-teal-600">
                                            <Clock size={20} />
                                        </div>
                                        <div>
                                            <p className="text-xs text-teal-600/70 font-bold uppercase tracking-wide">Est. Time</p>
                                            <p className="text-base font-bold text-slate-900">15 mins</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-amber-50 border border-amber-100">
                                        <div className="p-3 bg-white rounded-2xl shadow-sm text-amber-500">
                                            <BarChart size={20} />
                                        </div>
                                        <div>
                                            <p className="text-xs text-amber-600/70 font-bold uppercase tracking-wide">Difficulty</p>
                                            <p className="text-base font-bold text-slate-900">{topic.difficulty}/5</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <NeuralButton
                                        onClick={onClose}
                                        variant="ghost"
                                        className="flex-1 h-14"
                                    >
                                        Cancel
                                    </NeuralButton>
                                    <Link href={`/course/${courseId}/${unitId}/${topic.id}`} className="flex-1">
                                        <NeuralButton
                                            variant="primary"
                                            className="w-full h-14 text-lg bg-black hover:bg-neutral-800 text-white shadow-none border-none flex items-center justify-center gap-2"
                                        >
                                            <Play size={20} className="fill-current" />
                                            Start Lesson
                                        </NeuralButton>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
