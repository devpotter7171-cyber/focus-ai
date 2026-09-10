"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatPillProps {
    icon: LucideIcon;
    label: string;
    value: string;
    color?: "orange" | "yellow" | "blue" | "green" | "slate";
    active?: boolean;
}

export function StatPill({ icon: Icon, label, value, color = "slate", active = true }: StatPillProps) {
    const colorStyles = {
        orange: "bg-orange-500 text-white shadow-orange-500/30",
        yellow: "bg-yellow-400 text-slate-900 shadow-yellow-400/30",
        blue: "bg-blue-500 text-white shadow-blue-500/30",
        green: "bg-emerald-500 text-white shadow-emerald-500/30",
        slate: "bg-slate-200 text-slate-700",
    };

    const iconBaseClass = "w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105";
    const activeClass = active ? colorStyles[color] : "bg-slate-200 text-slate-400";

    return (
        <div className="flex items-center gap-3 bg-white/60 p-2 pr-6 rounded-full glass border border-white/40 shadow-sm hover:shadow-md transition-all cursor-default">
            <div className={cn(iconBaseClass, activeClass)}>
                <Icon size={20} fill={active && color === 'yellow' ? "currentColor" : "none"} />
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
                <span className="text-sm font-semibold text-slate-800 leading-tight">{value}</span>
            </div>
        </div>
    );
}
