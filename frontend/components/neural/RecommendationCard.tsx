"use client";

import React from "react";
import { Sparkles, ArrowRight } from "lucide-react";

export function RecommendationCard() {
    return (
        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-lg shadow-slate-200/50 flex flex-col justify-between group cursor-pointer hover:border-teal-200 transition-colors">
            <div className="flex items-start justify-between">
                <h4 className="font-bold text-slate-800 text-sm">Focus-AI Insight</h4>
                <div className="p-2 -mr-2 -mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={18} className="text-teal-600" />
                </div>
            </div>

            <div className="mt-4 flex gap-4">
                <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
                    <Sparkles size={20} />
                </div>
                <p className="text-slate-600 text-sm leading-relaxed">
                    You seem stuck on <span className="font-medium text-slate-900">Normalization</span>.
                    Try switching to a <span className="text-teal-600 font-medium">Visual Guide</span> to break the cognitive stall?
                </p>
            </div>
        </div>
    );
}
