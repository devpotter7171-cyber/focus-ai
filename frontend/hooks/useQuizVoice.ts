"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * Quiz-aware voice commands.
 *
 * Returns a list of `extraCommands` you can pass to `<VoiceCommandButton extraCommands={...} />`
 * so the global voice assistant understands quiz-specific intents while a
 * question is open:
 *
 *   "Option A"                    → selects option index 0
 *   "B" / "second one"            → selects option index 1
 *   "the answer is normalization" → matches by option text
 *   "submit"                      → submits the selected answer
 *   "next question"               → advances to the next question
 *   "read the question"           → speaks the current question + options
 *   "give me a hint"              → triggers the hint button
 *
 * Pure rule-based fuzzy matching — no API calls, costs $0.
 */

export interface QuizVoiceContext {
    /** Current question text (used for the "read question" command). */
    questionText: string;
    /** Current options as displayed to the user. */
    options: string[];
    /** Whether an option is currently selected (drives "submit" availability). */
    hasSelection: boolean;
    /** Whether the question has already been submitted. */
    isSubmitted: boolean;

    /** Action: select option by 0-based index. */
    onSelectIndex: (index: number) => void;
    /** Action: submit the currently selected answer. */
    onSubmit: () => void;
    /** Optional: advance to the next question. */
    onNext?: () => void;
    /** Optional: trigger a hint. */
    onHint?: () => void;
}

interface VoiceCommand {
    keywords: string[];
    synonyms?: string[];
    antiKeywords?: string[];
    action: () => void;
    confirm?: string;
    description: string;
    example: string;
    category?: "Navigation" | "Reading" | "Scrolling" | "Quiz" | "Other";
}

// Spoken position words → 0-based index
const POSITION_WORDS: Record<string, number> = {
    first: 0, "1st": 0, one: 0, top: 0,
    second: 1, "2nd": 1, two: 1, middle: 1,
    third: 2, "3rd": 2, three: 2,
    fourth: 3, "4th": 3, four: 3, last: 3, bottom: 3,
};

// Letter → 0-based index
const LETTER_INDEX: Record<string, number> = {
    a: 0, b: 1, c: 2, d: 3, e: 4,
};

function normalize(s: string): string {
    return s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Compute longest common subword overlap between transcript and option text. */
function textOverlap(transcript: string, optionText: string): number {
    const tr = normalize(transcript).split(" ").filter((w) => w.length > 2);
    const op = new Set(normalize(optionText).split(" ").filter((w) => w.length > 2));
    if (op.size === 0) return 0;
    let hits = 0;
    for (const t of tr) if (op.has(t)) hits++;
    return hits / Math.max(op.size, 1); // 0..1 score
}

/**
 * Parse "option A" / "B" / "the second one" / "I think it's normalization"
 * out of free-form transcript and return a 0-based option index, or -1.
 */
function parseOptionFromTranscript(transcript: string, options: string[]): number {
    const text = normalize(transcript);
    const tokens = text.split(" ");

    // 1) Explicit letter — "A" / "option B" / "answer is C"
    for (const t of tokens) {
        if (t.length === 1 && t in LETTER_INDEX) {
            const idx = LETTER_INDEX[t]!;
            if (idx < options.length) return idx;
        }
    }

    // 2) Position words — "first", "second one", "last"
    for (const t of tokens) {
        if (t in POSITION_WORDS) {
            const idx = POSITION_WORDS[t]!;
            if (idx < options.length) return idx;
        }
    }

    // 3) "number two" / "option 3"
    const numMatch = text.match(/\b(?:option|number|choice|answer)?\s*([1-4])\b/);
    if (numMatch) {
        const idx = parseInt(numMatch[1]!, 10) - 1;
        if (idx >= 0 && idx < options.length) return idx;
    }

    // 4) Text overlap — "I think it's normalization"
    let bestIdx = -1;
    let bestScore = 0.25; // require ≥25 % keyword overlap
    options.forEach((opt, i) => {
        const score = textOverlap(transcript, opt);
        if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
        }
    });
    return bestIdx;
}

/** Speak a string through the browser TTS. */
function speak(text: string, rate = 0.95) {
    if (typeof window === "undefined") return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = rate;
        u.volume = 0.85;
        window.speechSynthesis.speak(u);
    } catch {
        /* ignore */
    }
}

/**
 * Build the list of quiz-specific voice commands. Pass the result to
 * `<VoiceCommandButton extraCommands={quizCommands} />` while a question is
 * mounted; remove it (return `undefined` from the hook) when no quiz is open.
 */
export function useQuizVoice(ctx: QuizVoiceContext | null): VoiceCommand[] | undefined {
    // Keep the latest context in a ref so closures stay fresh without
    // re-creating the entire commands array on every render.
    const ctxRef = useRef<QuizVoiceContext | null>(ctx);
    useEffect(() => { ctxRef.current = ctx; }, [ctx]);

    return useMemo<VoiceCommand[] | undefined>(() => {
        if (!ctx) return undefined;

        return [
            // ─── Pick an option ──────────────────────────────────────────
            {
                keywords: ["option", "answer", "choose", "select", "pick", "i think"],
                synonyms: [
                    "a", "b", "c", "d",
                    "first", "second", "third", "fourth", "last",
                    "one", "two", "three", "four",
                ],
                antiKeywords: ["submit", "next", "hint", "skip"],
                action: () => {
                    const c = ctxRef.current;
                    if (!c || c.isSubmitted) return;
                    // Pull the latest transcript that matched this command from
                    // the live recognition. We can't read it directly, so we
                    // rely on the `data-voice-transcript` attribute we'll set
                    // on the body during recognition (see below).
                    const t = (typeof document !== "undefined" &&
                        document.body.getAttribute("data-voice-transcript")) || "";
                    const idx = parseOptionFromTranscript(t, c.options);
                    if (idx >= 0) {
                        c.onSelectIndex(idx);
                        speak(`Selected option ${String.fromCharCode(65 + idx)}`);
                    } else {
                        speak("I couldn't tell which option you meant. Try saying 'A', 'B', 'C', or 'D'.");
                    }
                },
                description: "Pick an answer",
                example: "Option B",
                category: "Quiz",
            },

            // ─── Submit ─────────────────────────────────────────────────
            {
                keywords: ["submit", "confirm", "lock", "final answer", "go with"],
                synonyms: ["done", "finalize", "send"],
                antiKeywords: ["cancel"],
                action: () => {
                    const c = ctxRef.current;
                    if (!c) return;
                    if (c.isSubmitted) {
                        speak("Already submitted");
                        return;
                    }
                    if (!c.hasSelection) {
                        speak("Pick an option first");
                        return;
                    }
                    c.onSubmit();
                },
                confirm: "Submitting your answer",
                description: "Submit answer",
                example: "Submit my answer",
                category: "Quiz",
            },

            // ─── Next question ──────────────────────────────────────────
            {
                keywords: ["next question", "next", "skip", "move on"],
                synonyms: ["forward", "advance", "continue"],
                antiKeywords: ["previous", "back"],
                action: () => {
                    const c = ctxRef.current;
                    if (!c?.onNext) {
                        speak("No next question yet");
                        return;
                    }
                    c.onNext();
                },
                confirm: "Next question",
                description: "Next question",
                example: "Next question",
                category: "Quiz",
            },

            // ─── Hear the question ──────────────────────────────────────
            {
                keywords: ["read the question", "repeat", "say again", "what was the question"],
                synonyms: ["question", "again", "reread"],
                antiKeywords: ["stop"],
                action: () => {
                    const c = ctxRef.current;
                    if (!c) return;
                    const lines = [c.questionText];
                    c.options.forEach((opt, i) => {
                        lines.push(`Option ${String.fromCharCode(65 + i)}. ${opt}`);
                    });
                    speak(lines.join(". "));
                },
                description: "Read question aloud",
                example: "Read the question again",
                category: "Quiz",
            },

            // ─── Hint ───────────────────────────────────────────────────
            {
                keywords: ["hint", "help", "stuck", "clue", "give me a hand"],
                synonyms: ["nudge", "tip"],
                action: () => {
                    const c = ctxRef.current;
                    if (!c?.onHint) {
                        speak("No hint available right now");
                        return;
                    }
                    c.onHint();
                },
                confirm: "Showing a hint",
                description: "Get a hint",
                example: "Give me a hint",
                category: "Quiz",
            },
        ];
        // We intentionally rebuild only when `ctx` identity changes (e.g. new
        // question loaded). The closures read the live ref, so internal state
        // changes don't need to recompute the array.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctx?.questionText, ctx?.options.join("|")]);
}
