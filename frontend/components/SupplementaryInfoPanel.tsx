"use client";

import { motion } from "framer-motion";
import { NeuralBadge } from "@/components/neural/NeuralBadge";
import {
    Image as ImageIcon,
    Lightbulb,
    Link as LinkIcon,
    BookOpen,
    Info,
    Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface SupplementaryItem {
    type: "figure" | "term" | "concept" | "link";
    title: string;
    content: string; // URL for image, definition for term, etc.
    description?: string; // Caption or extra context
}

export function SupplementaryInfoPanel({
    items = [],
    stats
}: {
    items?: SupplementaryItem[];
    stats?: { history: { id: number, score: number, label: string }[], average: number };
}) {
    // Default mock data if no items provided
    const displayItems: SupplementaryItem[] = items.length > 0 ? items : [
        {
            type: "figure",
            title: "DBMS Architecture",
            content: "https://media.geeksforgeeks.org/wp-content/uploads/20230807105825/Approaches-to-Build-DBMS.webp",
            description: "Visual representation of User -> DBMS -> Data interaction."
        },
        {
            type: "term",
            title: "Redundancy",
            content: "The unnecessary repetition of data within a database.",
            description: "Avoided by normalization."
        },
        {
            type: "concept",
            title: "ACID Properties",
            content: "Atomicity, Consistency, Isolation, Durability.",
            description: "Key guarantees for reliable transactions."
        }
    ];
    // Mock performance data if not provided (to be replaced by real prop later)
    const performance = stats || {
        history: [], // Empty by default if no stats
        average: 0
    };

    return (
        <aside className="w-80 border-l border-slate-100 bg-slate-50/50 h-full overflow-y-auto p-6 hidden xl:block">
            {/* Performance Section */}
            {/* Performance Section */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                    <Activity className="h-4 w-4 text-slate-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Your Performance
                    </h3>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-6">
                    <div className="flex items-end justify-between mb-4">
                        <div>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Average Score</p>
                            <p className="text-2xl font-black text-slate-900">
                                {isNaN(performance.average) ? 0 : performance.average}%
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent Quizzes</h4>
                    {performance.history.length === 0 ? (
                        <div className="text-xs text-slate-400 italic text-center py-4">No quizzes taken yet.</div>
                    ) : (
                        performance.history.slice().reverse().map((item, idx) => (
                            <div key={item.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                                <div>
                                    <div className="text-[10px] text-slate-400 mb-0.5">Test #{performance.history.length - idx}</div>
                                    <div className="text-xs font-bold text-slate-700 truncate max-w-[120px]" title={item.label}>
                                        {item.label}
                                    </div>
                                </div>
                                <div className={`px-2 py-1 rounded-md text-xs font-bold ${item.score >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                    item.score >= 60 ? 'bg-amber-100 text-amber-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                    {item.score}%
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* <div className="flex items-center gap-2 mb-6">
                <BookOpen className="h-4 w-4 text-indigo-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Supplementary Info
                </h3>
            </div> */}

            {/* <div className="space-y-6">
                {displayItems.map((item, idx) => (
                   // ... existing item rendering code ...
                ))} 
            </div> */}
        </aside>
    );
}
