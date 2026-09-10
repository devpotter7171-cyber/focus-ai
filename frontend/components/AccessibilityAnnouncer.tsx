"use client";

import React from "react";
import { useAccessibility } from "@/hooks/useAccessibility";

/**
 * Two visually-hidden ARIA-live regions powered by `useAccessibility`.
 *
 * The provider mutates `politeText` / `assertiveText`; we mirror those into
 * regions that screen readers will read out automatically. Polite is for
 * status updates (page changes, confirmations), assertive is reserved for
 * urgent alerts (errors, intervention triggers).
 */
export function AccessibilityAnnouncer() {
    const { politeText, assertiveText } = useAccessibility();
    return (
        <>
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
            >
                {politeText}
            </div>
            <div
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                className="sr-only"
            >
                {assertiveText}
            </div>
        </>
    );
}

/**
 * "Skip to main content" link — first tab stop for keyboard users so they
 * don't have to traverse the sidebar on every page.
 *
 * Pages should render `<main id="main-content" tabIndex={-1}>` for the
 * link target to land in the right place.
 */
export function SkipToMain() {
    return (
        <a
            href="#main-content"
            className="
                sr-only focus:not-sr-only
                focus:fixed focus:top-3 focus:left-3 focus:z-[200]
                focus:px-4 focus:py-2 focus:rounded-xl
                focus:bg-slate-900 focus:text-white focus:shadow-lg
                focus:outline-none focus:ring-2 focus:ring-amber-400
                text-sm font-semibold
            "
        >
            Skip to main content
        </a>
    );
}
