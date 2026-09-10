"use client";

import React from "react";
import { Ear, EarOff } from "lucide-react";
import { useAccessibility } from "@/hooks/useAccessibility";

/**
 * Visible toggle for screen-reader / spoken mode. Sits near the global mic
 * button so users who need it (or stumble onto it) can turn it on without
 * digging through settings.
 *
 * Pairs with the keyboard shortcut Alt+A (handled in `useAccessibility`)
 * and the voice command "screen reader on / off".
 */
export function AccessibilityToggle() {
    const { enabled, toggle } = useAccessibility();
    return (
        <button
            onClick={toggle}
            className={`w-10 h-10 rounded-full border shadow-sm flex items-center justify-center transition-colors ${
                enabled
                    ? "bg-amber-500 text-white border-amber-500 shadow-amber-500/30"
                    : "bg-white text-slate-400 border-slate-200 hover:text-slate-700"
            }`}
            aria-label={
                enabled
                    ? "Turn screen reader mode off (Alt A)"
                    : "Turn screen reader mode on (Alt A)"
            }
            aria-pressed={enabled}
            title={
                enabled
                    ? "Screen reader on — Alt+A to disable"
                    : "Screen reader mode (Alt+A)"
            }
        >
            {enabled ? <Ear size={16} /> : <EarOff size={16} />}
        </button>
    );
}
