"use client";

import React from "react";
import { Activity, Radio } from "lucide-react";

export function NeuralMirrorCard() {
    return (
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 text-white p-0 shadow-xl shadow-slate-900/20 col-span-1 lg:col-span-2 min-h-[220px] group flex flex-col">
            {/* Live Badge */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
                <span className="text-xs font-bold tracking-wide uppercase">Live Analysis</span>
            </div>

            {/* Dropdown / Title */}
            <div className="absolute top-4 left-6 z-20 flex items-center gap-2 text-white/90 font-medium bg-black/20 backdrop-blur-md px-3 py-1 rounded-lg">
                <Activity size={16} />
                <span className="text-sm">Cognitive Load #1</span>
            </div>

            {/* Simulated "Camera Feed" content - A real-time looking graph */}
            <div className="absolute inset-0 z-0 bg-slate-800">
                {/* Grid lines */}
                <div className="absolute inset-x-0 top-1/4 h-px bg-white/5" />
                <div className="absolute inset-x-0 top-2/4 h-px bg-white/5" />
                <div className="absolute inset-x-0 top-3/4 h-px bg-white/5" />

                <div className="absolute inset-y-0 left-1/4 w-px bg-white/5" />
                <div className="absolute inset-y-0 left-2/4 w-px bg-white/5" />
                <div className="absolute inset-y-0 left-3/4 w-px bg-white/5" />

                {/* Animated Graph Line (Simulated with CSS) */}
                <svg className="absolute inset-0 w-full h-full opacity-60" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#4ade80" stopOpacity="0.5" />
                            <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d="M0,150 C50,140 100,160 150,120 C200,80 250,100 300,130 C350,160 400,140 450,100 C500,60 550,80 600,110 L600,300 L0,300 Z" fill="url(#gradient)" />
                    <path d="M0,150 C50,140 100,160 150,120 C200,80 250,100 300,130 C350,160 400,140 450,100 C500,60 550,80 600,110" stroke="#4ade80" strokeWidth="3" fill="none" className="graph-path" />
                </svg>

                {/* Real-world Room Overlay Feeling */}
                <div className="absolute inset-0 bg-transparent pointer-events-none" />
            </div>

            {/* Bottom Controls */}
            <div className="mt-auto relative z-20 p-6 flex justify-between items-end">
                <div className="text-white">
                    <h3 className="text-3xl font-light">42%</h3>
                    <p className="text-white/60 text-sm">Focus Capacity</p>
                </div>

                <div className="flex gap-3">
                    <button className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors">
                        <Radio size={18} />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors">
                        <Activity size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
