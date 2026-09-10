"use client";

import { useVoiceConversation } from "@/hooks/useVoiceConversation";
import { useEffect, useRef } from "react";

/**
 * Global voice conversation provider.
 *
 * Mounted in the root layout, this enables the conversational AI fallback
 * on every page. When the user is on a lesson page, the CoursePlayer
 * overrides with lesson-scoped context via its own `useVoiceConversation`
 * call (the hook deduplicates via the event listener pattern).
 *
 * Also stores the last AI response in a DOM attribute so the "repeat that"
 * voice command can re-read it without React state coupling.
 */
export function VoiceConversationProvider() {
    const { lastAIResponse } = useVoiceConversation({ enabled: true });

    // Sync the last AI response to a DOM attribute for cross-component access
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        intervalRef.current = setInterval(() => {
            if (lastAIResponse.current) {
                document.body.setAttribute(
                    "data-last-ai-response",
                    lastAIResponse.current,
                );
            }
        }, 500);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [lastAIResponse]);

    return null; // No UI — purely behavioral
}
