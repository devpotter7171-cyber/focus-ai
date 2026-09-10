"use client";

/**
 * Voice Conversation Mode.
 *
 * When the voice system can't match a transcript to a known command, this
 * module intercepts the "unrecognized" fallback and routes the user's
 * speech to the AI tutor as a free-form question — making the voice
 * assistant *conversational* rather than purely command-driven.
 *
 * This is the key upgrade for blind users: instead of needing to memorize
 * exact command phrases, they can just *talk* to the system naturally.
 *
 * Architecture:
 *   1. `useVoiceConversation` subscribes to a custom event
 *      `voice-unrecognized` dispatched by `useVoiceCommand` when no
 *      command matches.
 *   2. It sends the transcript to `POST /api/v1/tutor/lesson` (if on a
 *      lesson page) or to a new lightweight `/api/v1/tutor/general`
 *      endpoint (for non-lesson pages).
 *   3. The AI response is spoken aloud via TTS and pushed to the
 *      accessibility live region.
 *
 * The hook also exposes a `lastAIResponse` ref so other components
 * (like "repeat that" or "explain that" commands) can re-read it.
 */

import { useCallback, useEffect, useRef } from "react";
import { useAccessibility } from "@/hooks/useAccessibility";
import { apiFetch } from "@/lib/api";

interface VoiceConversationOptions {
    /** Current course context (null if not on a lesson page). */
    courseId?: string;
    unitId?: string;
    subtopicId?: string;
    /** Current lesson title for context (avoids DB fetch). */
    lessonTitle?: string;
    /** First ~1500 chars of lesson content (avoids DB fetch). */
    lessonSnippet?: string;
    /** Whether to enable conversational fallback. Default true. */
    enabled?: boolean;
}

interface VoiceTutorResponse {
    answer: string;
    cached?: boolean;
}

/** Speak text via browser TTS. */
function speakText(text: string, rate = 0.95) {
    if (typeof window === "undefined") return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = rate;
        u.volume = 0.95;
        window.speechSynthesis.speak(u);
    } catch {
        /* ignore */
    }
}

/** Strip markdown for TTS. */
function stripMd(md: string): string {
    return md
        .replace(/#{1,6}\s?/g, "")
        .replace(/\*\*/g, "")
        .replace(/\*/g, "")
        .replace(/`/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/>\s?/g, "")
        .replace(/-\s/g, "")
        .replace(/---/g, "")
        .trim();
}

export function useVoiceConversation(options: VoiceConversationOptions = {}) {
    const { courseId, unitId, subtopicId, lessonTitle, lessonSnippet, enabled = true } = options;
    const { announce, enabled: srMode } = useAccessibility();
    const lastAIResponse = useRef<string>("");
    const isProcessing = useRef(false);

    const handleUnrecognized = useCallback(
        async (e: Event) => {
            if (!enabled) return;
            if (isProcessing.current) return;

            const transcript = (e as CustomEvent<string>).detail;
            if (!transcript || transcript.length < 3) return;

            // Don't send very short utterances that are likely noise
            const words = transcript.trim().split(/\s+/);
            if (words.length < 2) return;

            isProcessing.current = true;

            // Announce that we're thinking
            announce("Let me think about that...");
            speakText("Let me think about that.");
            // Show "thinking" in the visual feedback bubble
            window.dispatchEvent(new CustomEvent<string>("voice-response", { detail: "Thinking..." }));

            try {
                // Use the lightweight /tutor/voice endpoint — no Firestore
                // round-trip, minimal tokens, cached responses.
                const res = await apiFetch<VoiceTutorResponse>("/tutor/voice", {
                    method: "POST",
                    body: JSON.stringify({
                        question: transcript.slice(0, 500),
                        lesson_title: lessonTitle || null,
                        lesson_snippet: lessonSnippet?.slice(0, 1500) || null,
                    }),
                });

                const answer = res.answer;

                // Store for "repeat that" command
                lastAIResponse.current = answer;
                document.body.setAttribute("data-last-ai-response", stripMd(answer));

                // Show the response as text on screen
                const spoken = stripMd(answer).slice(0, 1500);
                window.dispatchEvent(new CustomEvent<string>("voice-response", { detail: spoken }));
                announce(spoken);
                speakText(spoken, 0.95);
            } catch (err) {
                const fallback =
                    "I couldn't get an answer right now. Try again, or say 'help' to see what commands are available.";
                window.dispatchEvent(new CustomEvent<string>("voice-response", { detail: fallback }));
                announce(fallback, { assertive: true });
                speakText(fallback);
            } finally {
                isProcessing.current = false;
            }
        },
        [enabled, lessonTitle, lessonSnippet, announce, srMode],
    );

    useEffect(() => {
        if (!enabled) return;
        window.addEventListener("voice-unrecognized", handleUnrecognized);
        return () => window.removeEventListener("voice-unrecognized", handleUnrecognized);
    }, [enabled, handleUnrecognized]);

    return { lastAIResponse };
}
