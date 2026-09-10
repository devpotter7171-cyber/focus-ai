"use client";

/**
 * Accessibility / screen-reader mode.
 *
 * Provides a persistent toggle (localStorage-backed) plus a global
 * `announce()` API that pushes text to:
 *   1. An ARIA-live region (always — works for *all* AT users, not just
 *      blind users), and
 *   2. The browser TTS engine (only when screen-reader mode is on, OR the
 *      caller explicitly forces it via `{ speak: true }`).
 *
 * Why both?
 *   - Screen readers (JAWS, NVDA, VoiceOver, TalkBack) already speak the
 *     content of aria-live regions. We don't want to double-narrate them
 *     by also calling `speechSynthesis.speak`.
 *   - For sighted-impaired users *without* a screen reader (low vision,
 *     temporary impairment, hands-free use), screen-reader mode opt-in
 *     drives the browser's own TTS so they get the same affordances.
 *
 * Heuristic: when SR-mode is on we assume the user wants spoken feedback
 * via the browser TTS too (since we can't reliably detect a real screen
 * reader from JS). Sighted screen-reader users can disable SR-mode and
 * still get aria-live updates.
 */

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

type Politeness = "polite" | "assertive";

interface AnnounceOptions {
    /** Force TTS even when SR-mode is off. Default: speak iff SR-mode on. */
    speak?: boolean;
    /** Aria-live politeness (default polite). */
    assertive?: boolean;
    /** TTS rate override. */
    rate?: number;
}

interface AccessibilityContextValue {
    /** Screen-reader / spoken mode on/off. Persisted to localStorage. */
    enabled: boolean;
    setEnabled: (v: boolean) => void;
    toggle: () => void;

    /** Push text to the live region; optionally also TTS. */
    announce: (text: string, opts?: AnnounceOptions) => void;
    /** Cancel any in-flight TTS utterance. */
    silence: () => void;

    /** Live region node refs — used by <AccessibilityAnnouncer />. */
    politeText: string;
    assertiveText: string;
}

const STORAGE_KEY = "focusai.accessibilityMode";

const AccessibilityContext = createContext<AccessibilityContextValue>({
    enabled: false,
    setEnabled: () => {},
    toggle: () => {},
    announce: () => {},
    silence: () => {},
    politeText: "",
    assertiveText: "",
});

export function useAccessibility(): AccessibilityContextValue {
    return useContext(AccessibilityContext);
}

/** Bare TTS that respects an interruption queue. */
function speakText(text: string, rate = 1.0) {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;
    try {
        // Cancel queued utterances so the latest announcement wins —
        // critical for state changes (e.g. quiz feedback over scrolling).
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = rate;
        u.volume = 0.95;
        u.pitch = 1.0;
        window.speechSynthesis.speak(u);
    } catch {
        /* SSR / privacy-mode browsers — silent fallback */
    }
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
    // Lazy initializer reads localStorage once. SSR returns false; the
    // first client render hydrates with the persisted value, avoiding
    // the React 19 "setState-in-effect" warning entirely.
    const [enabled, setEnabledState] = useState<boolean>(() => {
        if (typeof window === "undefined") return false;
        try {
            return window.localStorage.getItem(STORAGE_KEY) === "1";
        } catch {
            return false;
        }
    });
    const [politeText, setPoliteText] = useState("");
    const [assertiveText, setAssertiveText] = useState("");

    // Keep the latest text refs so back-to-back calls with the same string
    // still re-trigger the live region (we toggle a zero-width suffix).
    const politeCounter = useRef(0);
    const assertiveCounter = useRef(0);

    const setEnabled = useCallback((v: boolean) => {
        setEnabledState(v);
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
        } catch {
            /* ignore */
        }
    }, []);

    const announce = useCallback(
        (text: string, opts: AnnounceOptions = {}) => {
            if (!text) return;
            const politeness: Politeness = opts.assertive ? "assertive" : "polite";

            // 1) Live region — always
            // We append a zero-width space when the same text is announced
            // back-to-back so screen readers see it as a *new* mutation and
            // re-narrate. Counter prevents React from coalescing identical
            // string updates.
            const counter =
                politeness === "assertive"
                    ? ++assertiveCounter.current
                    : ++politeCounter.current;
            const stamped = counter % 2 === 0 ? text + "\u200B" : text;
            if (politeness === "assertive") setAssertiveText(stamped);
            else setPoliteText(stamped);

            // 2) Browser TTS — only when SR-mode is on, or caller forces.
            if (opts.speak ?? enabled) {
                speakText(text, opts.rate ?? 1.0);
            }
        },
        [enabled],
    );

    const silence = useCallback(() => {
        if (typeof window === "undefined") return;
        try {
            window.speechSynthesis.cancel();
        } catch {
            /* ignore */
        }
    }, []);

    // Listen for the global "accessibility-toggle" custom event so any
    // module (voice command, keyboard shortcut, button) can flip the flag
    // without prop drilling or re-importing the hook.
    useEffect(() => {
        const onToggle = () => setEnabled(!enabled);
        const onSet = (e: Event) => {
            const detail = (e as CustomEvent<boolean>).detail;
            if (typeof detail === "boolean") setEnabled(detail);
        };
        window.addEventListener("accessibility-toggle", onToggle);
        window.addEventListener("accessibility-set", onSet as EventListener);
        return () => {
            window.removeEventListener("accessibility-toggle", onToggle);
            window.removeEventListener("accessibility-set", onSet as EventListener);
        };
    }, [enabled, setEnabled]);

    // Keyboard shortcut: Alt+A toggles SR-mode (when not in a text field).
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handler = (e: KeyboardEvent) => {
            if (!e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) return;
            if (e.code !== "KeyA") return;
            const t = e.target as HTMLElement | null;
            const tag = t?.tagName?.toLowerCase();
            if (tag === "input" || tag === "textarea" || t?.isContentEditable) return;
            e.preventDefault();
            setEnabled(!enabled);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [enabled, setEnabled]);

    // Announce mode-change itself so the user gets immediate confirmation.
    // Skip the very first effect run so we don't blurt out "off" on every
    // fresh page load for users who never use SR-mode.
    const firstModeRender = useRef(true);
    useEffect(() => {
        if (firstModeRender.current) {
            firstModeRender.current = false;
            return;
        }
        if (typeof window === "undefined") return;
        // We force speak here so the switch is audible even before SR-mode
        // takes effect on subsequent updates.
        speakText(
            enabled
                ? "Screen reader mode on. I'll narrate the page as you go. Press Alt A to turn this off."
                : "Screen reader mode off.",
            1.0,
        );
    }, [enabled]);

    const value = useMemo<AccessibilityContextValue>(
        () => ({
            enabled,
            setEnabled,
            toggle: () => setEnabled(!enabled),
            announce,
            silence,
            politeText,
            assertiveText,
        }),
        [enabled, setEnabled, announce, silence, politeText, assertiveText],
    );

    return (
        <AccessibilityContext.Provider value={value}>
            {children}
        </AccessibilityContext.Provider>
    );
}
