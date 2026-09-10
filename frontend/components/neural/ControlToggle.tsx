"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Switch } from "@headlessui/react"; // Or use a custom simple switch if headlessui not desired, but we have it.

interface ControlToggleProps {
    icon: LucideIcon;
    label: string;
    subLabel?: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
}

export function ControlToggle({ icon: Icon, label, subLabel, enabled, onChange }: ControlToggleProps) {
    return (
        <div
            onClick={() => onChange(!enabled)}
            className={cn(
                "flex items-center justify-between p-4 rounded-3xl transition-all duration-300 cursor-pointer border border-transparent",
                enabled
                    ? "bg-white shadow-xl shadow-slate-200/50 border-white/50"
                    : "bg-white/40 hover:bg-white/60"
            )}
        >
            <div className="flex items-center gap-4">
                <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                    enabled ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-500"
                )}>
                    <Icon size={20} />
                </div>
                <div className="flex flex-col">
                    <span className={cn("font-semibold text-sm", enabled ? "text-slate-900" : "text-slate-600")}>
                        {label}
                    </span>
                    {subLabel && (
                        <span className="text-xs text-slate-400">{subLabel}</span>
                    )}
                </div>
            </div>

            <div className={cn(
                "w-11 h-6 rounded-full transition-colors relative",
                enabled ? "bg-slate-900" : "bg-slate-300"
            )}>
                <div className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm",
                    enabled ? "left-6" : "left-1"
                )} />
            </div>
        </div>
    );
}
