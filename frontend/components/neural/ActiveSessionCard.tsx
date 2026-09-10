"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveSessionCardProps {
    courseId?: string;
    courseTitle?: string;
    unitTitle?: string;
    progress?: number;
    label?: string;
}

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function ActiveSessionCard({
    courseId,
    courseTitle = "Database Normalization",
    unitTitle = "Relational Theory • Unit 3",
    progress = 65,
    label = "Current Module"
}: ActiveSessionCardProps) {

    const card = (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className="group relative overflow-hidden rounded-[2rem] bg-white p-6 border border-slate-200 h-full min-h-[200px] flex flex-col justify-between cursor-pointer hover:border-slate-900/20 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
                        {/* Subtle gradient accent */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-slate-50 to-transparent rounded-bl-[4rem] opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="flex items-start justify-between z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
                                    <BookOpen size={18} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</h4>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                        {progress === 0 ? "Not started" : progress === 100 ? "Completed" : "In Progress"}
                                    </p>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                                <ArrowUpRight size={14} />
                            </div>
                        </div>

                        <div className="mt-5 z-10">
                            <h3 className="text-lg font-bold text-slate-900 leading-tight line-clamp-2">{courseTitle}</h3>
                            <p className="text-sm text-slate-500 mt-1 line-clamp-1">{unitTitle}</p>
                        </div>

                        <div className="mt-auto pt-5 z-10 w-full">
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                <span>Progress</span>
                                <span className="text-slate-700">{progress}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all duration-1000",
                                        progress === 100 ? "bg-emerald-500" : progress > 0 ? "bg-slate-900" : "bg-slate-200"
                                    )}
                                    style={{ width: `${Math.max(2, progress)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{progress > 0 ? `Continue ${courseTitle}` : `Start ${courseTitle}`}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );

    if (courseId) {
        return <Link href={`/course?expand=${courseId}`} className="block h-full">{card}</Link>;
    }
    return card;
}
