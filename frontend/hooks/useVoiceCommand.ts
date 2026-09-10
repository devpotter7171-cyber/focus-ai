"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

// ─── Types ───────────────────────────────────────────────────────────────────

interface VoiceCommand {
    /** Primary keywords that signal this intent. */
    keywords: string[];
    /** Synonyms / loose phrasings (lower weight). */
    synonyms?: string[];
    /** Negative keywords — if present, skip this command. */
    antiKeywords?: string[];
    /** Action to execute when matched. */
    action: () => void;
    /** Spoken confirmation after the action runs. */
    confirm?: string;
    /** Human-readable description shown in the command palette. */
    description: string;
    /** Example phrase shown in help UI. */
    example: string;
    /** Optional grouping for the help dialog. Defaults to "Navigation". */
    category?: "Navigation" | "Reading" | "Scrolling" | "Quiz" | "Other";
}

interface UseVoiceCommandOptions {
    commands?: VoiceCommand[];
    enabled?: boolean;
}

export interface VoiceCommandHandle {
    isListening: boolean;
    isAnalyzing: boolean;
    transcript: string;
    interim: string;
    supported: boolean;
    error: string | null;
    toggle: () => void;
    start: () => void;
    stop: () => void;
    availableCommands: {
        description: string;
        example: string;
        keywords: string[];
        category: string;
    }[];
}

// ─── NLP utilities (lightweight, no deps) ────────────────────────────────────

/** Common English stop words — removed before scoring so noise like
 * "let's continue with my" doesn't drown the actual intent words. */
const STOP_WORDS = new Set([
    "a", "an", "the", "is", "am", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
    "may", "might", "must", "shall", "can",
    "i", "me", "my", "mine", "myself", "we", "us", "our", "ours",
    "you", "your", "yours", "he", "she", "it", "they", "them", "their",
    "this", "that", "these", "those",
    "and", "or", "but", "if", "then", "else", "for", "of", "to", "in", "on",
    "at", "by", "with", "from", "as", "into", "onto", "about",
    "let", "lets", "let's", "want", "wanna", "would-like", "like",
    "go", "going", "goes", "gone", "went",
    "please", "kindly", "okay", "ok", "alright",
    "hey", "hi", "hello", "yo",
    "now", "again", "still", "back",
    "just", "really", "actually",
    "much", "many", "lot", "lots",
    "where", "when", "what", "why", "how",
    "some", "any", "every", "all", "no",
    "be", "get", "make", "take", "give", "show",
]);

function normalize(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")     // strip punctuation
        .replace(/\s+/g, " ")
        .trim();
}

function tokenize(text: string): string[] {
    return normalize(text).split(" ").filter(Boolean);
}

function removeStopWords(tokens: string[]): string[] {
    return tokens.filter((t) => !STOP_WORDS.has(t));
}

/** Levenshtein distance (capped) — for fuzzy matching of mis-recognized words. */
function levenshtein(a: string, b: string, max: number = 2): number {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    const m = a.length;
    const n = b.length;
    // Flat 1D array indexed as i * (n+1) + j to avoid possibly-undefined typing on dp[i][j]
    const dp = new Array<number>((m + 1) * (n + 1)).fill(0);
    const idx = (i: number, j: number) => i * (n + 1) + j;
    for (let i = 0; i <= m; i++) dp[idx(i, 0)] = i;
    for (let j = 0; j <= n; j++) dp[idx(0, j)] = j;
    for (let i = 1; i <= m; i++) {
        let rowMin = Infinity;
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            const v = Math.min(
                (dp[idx(i - 1, j)] ?? 0) + 1,
                (dp[idx(i, j - 1)] ?? 0) + 1,
                (dp[idx(i - 1, j - 1)] ?? 0) + cost,
            );
            dp[idx(i, j)] = v;
            if (v < rowMin) rowMin = v;
        }
        if (rowMin > max) return max + 1;
    }
    return dp[idx(m, n)] ?? max + 1;
}

/** Whether two tokens are "fuzzy-equal" — exact, prefix, or close edit distance. */
function fuzzyEq(a: string, b: string): boolean {
    if (a === b) return true;
    if (a.length < 4 || b.length < 4) return false;
    if (a.startsWith(b) || b.startsWith(a)) return true;
    if (Math.abs(a.length - b.length) > 2) return false;
    return levenshtein(a, b, 2) <= 2;
}

// ─── Intent scoring ──────────────────────────────────────────────────────────

/**
 * Score how well a user's transcript matches a command's intent.
 *
 * Scoring rules:
 *  - Each multi-word keyword phrase present in the raw text scores +3
 *  - Each single keyword present (after stop-word removal) scores +2
 *  - Each synonym present scores +1
 *  - Each fuzzy match (typo / mishearing) scores +1
 *  - Each anti-keyword present subtracts -10 (disqualifies)
 */
function scoreIntent(text: string, cmd: VoiceCommand): number {
    const lowered = normalize(text);
    const allTokens = tokenize(text);
    const tokens = removeStopWords(allTokens);
    let score = 0;

    // Anti-keywords first — early out
    if (cmd.antiKeywords) {
        for (const ak of cmd.antiKeywords) {
            if (lowered.includes(ak)) return -10;
        }
    }

    for (const kw of cmd.keywords) {
        if (kw.includes(" ")) {
            // Multi-word phrase
            if (lowered.includes(kw)) score += 3;
            continue;
        }
        // Single word — exact match in stop-word-stripped tokens
        if (tokens.includes(kw)) score += 2;
        else if (allTokens.includes(kw)) score += 1.5;
        else {
            // Fuzzy match against any token
            for (const t of tokens) {
                if (fuzzyEq(t, kw)) {
                    score += 1;
                    break;
                }
            }
        }
    }

    if (cmd.synonyms) {
        for (const syn of cmd.synonyms) {
            if (syn.includes(" ")) {
                if (lowered.includes(syn)) score += 1.5;
            } else if (tokens.includes(syn)) score += 1;
            else if (allTokens.includes(syn)) score += 0.75;
        }
    }

    return score;
}

// ─── Audio helpers (singleton AudioContext) ──────────────────────────────────

let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (_audioCtx) return _audioCtx;
    try {
        _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        return _audioCtx;
    } catch {
        return null;
    }
}

function playTone(freq: number, duration: number = 100, type: OscillatorType = "sine") {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration / 1000);
    } catch {
        /* ignore */
    }
}

function speak(text: string, rate = 1.05) {
    if (typeof window === "undefined") return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = rate;
        u.volume = 0.85;
        window.speechSynthesis.speak(u);
        // Dispatch visual feedback event so the UI shows what was spoken
        window.dispatchEvent(new CustomEvent<string>("voice-response", { detail: text }));
    } catch {
        /* ignore */
    }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVoiceCommand(options: UseVoiceCommandOptions = {}): VoiceCommandHandle {
    const { commands: extraCommands = [], enabled = true } = options;
    const router = useRouter();

    const [isListening, setIsListening] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [interim, setInterim] = useState("");
    const [supported, setSupported] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const recognitionRef = useRef<any>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wantListeningRef = useRef(false);
    const userStoppedRef = useRef(false);

    const commandsRef = useRef<VoiceCommand[]>([]);
    commandsRef.current = [
        // ─── Sign-in / sign-up (works on the landing page so a screen-
        //     reader user can get past the front door without a mouse) ───
        {
            keywords: ["log in", "sign in", "login"],
            synonyms: ["enter", "authenticate"],
            antiKeywords: ["sign up", "register", "out"],
            action: () => router.push("/login"),
            confirm: "Opening sign in",
            description: "Sign in",
            example: "Log in",
        },
        {
            keywords: ["sign up", "register", "create account"],
            synonyms: ["join", "new account"],
            action: () => router.push("/signup"),
            confirm: "Opening sign up",
            description: "Sign up",
            example: "Create an account",
        },
        {
            keywords: ["sign out", "log out", "logout"],
            synonyms: ["leave", "exit"],
            action: () => {
                window.dispatchEvent(new CustomEvent("voice-sign-out"));
            },
            confirm: "Signing you out",
            description: "Sign out",
            example: "Sign me out",
        },

        // ─── Continue learning (the example you asked for) ───────────────
        {
            keywords: ["continue", "resume", "keep going", "pick up"],
            synonyms: ["learning", "studying", "where", "left", "off", "last"],
            antiKeywords: ["stop", "back"],
            action: () => router.push("/dashboard"),
            confirm: "Picking up where you left off",
            description: "Continue learning",
            example: "Let's continue with my DBMS course",
        },
        {
            keywords: ["dashboard", "home"],
            synonyms: ["main", "start"],
            antiKeywords: ["teacher", "admin"],
            action: () => router.push("/dashboard"),
            confirm: "Opening dashboard",
            description: "Go to Dashboard",
            example: "Take me home",
        },
        {
            keywords: ["course", "courses", "lesson", "lessons"],
            synonyms: ["subject", "subjects", "catalog", "browse", "topic"],
            antiKeywords: ["quiz"],
            action: () => router.push("/course"),
            confirm: "Opening courses",
            description: "Go to Courses",
            example: "Show my courses",
        },
        // ─── Open a specific course by name ──────────────────────────────
        {
            keywords: ["open", "go to", "take me to", "start"],
            synonyms: ["dbms", "database", "data structures", "operating systems",
                       "computer networks", "networking", "oops", "oop",
                       "object oriented", "software engineering"],
            antiKeywords: ["quiz", "settings", "admin", "sign", "log", "help"],
            action: async () => {
                const transcript = document.body.getAttribute("data-voice-transcript") || "";
                const lowered = transcript.toLowerCase();

                // Known course name mappings — ordered longest-first so
                // "database management" matches before "database"
                const courseAliases: [string, string][] = [
                    ["database management", "dbms"],
                    ["data structures", "dsa"],
                    ["operating systems", "os"],
                    ["operating system", "os"],
                    ["computer networks", "cn"],
                    ["object oriented", "oop"],
                    ["software engineering", "se"],
                    ["networking", "cn"],
                    ["networks", "cn"],
                    ["algorithms", "dsa"],
                    ["database", "dbms"],
                    ["software", "se"],
                    ["dbms", "dbms"],
                    ["dsa", "dsa"],
                    ["oops", "oop"],
                    ["oop", "oop"],
                ];

                try {
                    // Dynamically import apiFetch to avoid circular deps
                    const { apiFetch } = await import("@/lib/api");
                    const courses = await apiFetch<{ id: string; title: string }[]>("/courses/");

                    if (!Array.isArray(courses) || courses.length === 0) {
                        speak("No courses found. Try enrolling in a course first.");
                        return;
                    }

                    // Try to match spoken name against known aliases first
                    let matched: { id: string; title: string } | null = null;

                    for (const [alias, courseId] of courseAliases) {
                        if (lowered.includes(alias)) {
                            matched = courses.find(c => c.id === courseId) || null;
                            if (matched) break;
                        }
                    }

                    // Second: fuzzy match against course titles directly
                    if (!matched) {
                        // Exclude common command words from fuzzy matching
                        const skipWords = new Set(["open", "start", "take", "show", "the", "course", "lesson", "please", "can", "you"]);
                        const words = lowered.split(/\s+/).filter(w => w.length > 2 && !skipWords.has(w));
                        let bestMatch: { id: string; title: string } | null = null;
                        let bestCount = 0;
                        for (const course of courses) {
                            const titleLow = course.title.toLowerCase();
                            const idLow = course.id.toLowerCase();
                            let count = 0;
                            for (const w of words) {
                                if (titleLow.includes(w) || idLow.includes(w)) count++;
                            }
                            if (count > bestCount) {
                                bestCount = count;
                                bestMatch = course;
                            }
                        }
                        // Require at least 1 meaningful word match
                        if (bestCount >= 1) matched = bestMatch;
                    }

                    if (matched) {
                        speak(`Opening ${matched.title}`);
                        router.push(`/course?expand=${matched.id}`);
                    } else {
                        // Fall back to course listing
                        speak("Opening courses. Say the course name to open it.");
                        router.push("/course");
                    }
                } catch (err) {
                    speak("Opening courses");
                    router.push("/course");
                }
            },
            description: "Open a specific course by name",
            example: "Open DBMS",
            category: "Navigation",
        },
        {
            keywords: ["progress", "analytics", "stats", "statistics"],
            synonyms: ["doing", "performance", "achievements", "score", "scores", "history"],
            action: () => router.push("/progress"),
            confirm: "Opening your progress",
            description: "View Progress",
            example: "How am I doing",
        },
        {
            keywords: ["review", "weak", "practice", "struggling"],
            synonyms: ["improve", "areas", "topics", "sharpen", "polish", "drill"],
            action: () => router.push("/review"),
            confirm: "Opening smart review",
            description: "Smart Review",
            example: "What should I practice",
        },
        {
            keywords: ["settings", "preferences", "profile", "account"],
            synonyms: ["change", "configure", "customize", "options"],
            action: () => router.push("/settings"),
            confirm: "Opening settings",
            description: "Settings",
            example: "Open settings",
        },
        {
            keywords: ["study", "flashcard", "flashcards", "deck", "cards"],
            synonyms: ["memorize", "spaced", "repetition", "drill"],
            action: () => router.push("/study"),
            confirm: "Starting flashcards",
            description: "Flashcards",
            example: "Start flashcards",
        },
        {
            keywords: ["admin", "upload", "generate"],
            synonyms: ["create", "new course", "pdf", "import"],
            action: () => router.push("/admin"),
            confirm: "Opening admin",
            description: "Admin Panel",
            example: "Upload a course",
        },
        {
            keywords: ["assessment", "test", "exam"],
            synonyms: ["evaluate", "evaluation", "checkup"],
            antiKeywords: ["quiz"],
            action: () => router.push("/assessment"),
            confirm: "Opening assessment",
            description: "Assessment",
            example: "Take the test",
        },
        {
            keywords: ["teacher", "instructor"],
            synonyms: ["monitor", "students", "class"],
            action: () => router.push("/teacher/dashboard"),
            confirm: "Opening teacher view",
            description: "Teacher Dashboard",
            example: "Show teacher view",
        },
        {
            keywords: ["competency", "competencies", "graph", "knowledge map"],
            synonyms: ["prerequisites", "prereqs", "skills", "skill tree"],
            action: () => router.push("/competencies"),
            confirm: "Opening competency graph",
            description: "Competency Graph",
            example: "Show my knowledge map",
        },
        {
            keywords: ["help", "commands", "what can i say"],
            synonyms: ["voice", "options", "list commands"],
            action: () => {
                // Dispatch a custom event that VoiceCommandButton listens for.
                window.dispatchEvent(new CustomEvent("voice-help-open"));
            },
            confirm: "Here are the available commands",
            description: "Show voice help",
            example: "What can I say",
            category: "Other",
        },
        {
            keywords: ["back", "previous", "return"],
            synonyms: ["earlier", "before"],
            action: () => router.back(),
            confirm: "Going back",
            description: "Go Back",
            example: "Go back",
        },
        {
            keywords: ["read", "narrate", "speak"],
            synonyms: ["aloud", "listen", "tts", "voice"],
            antiKeywords: ["stop"],
            action: () => {
                const prose = document.querySelector(".prose");
                const txt = (prose?.textContent || "").slice(0, 5000);
                if (txt) speak(txt, 0.95);
                else speak("Nothing to read on this page");
            },
            description: "Read aloud",
            example: "Read this to me",
            category: "Reading",
        },
        {
            keywords: ["stop", "silence", "quiet", "shut", "pause", "cancel"],
            action: () => window.speechSynthesis.cancel(),
            confirm: "Stopped",
            description: "Stop reading",
            example: "Stop reading",
            category: "Reading",
        },
        {
            keywords: ["scroll down", "down"],
            synonyms: ["more", "below"],
            antiKeywords: ["scroll up", "top"],
            action: () => window.scrollBy({ top: 400, behavior: "smooth" }),
            confirm: "Scrolling down",
            description: "Scroll down",
            example: "Scroll down",
            category: "Scrolling",
        },
        {
            keywords: ["scroll up", "up"],
            synonyms: ["above"],
            action: () => window.scrollBy({ top: -400, behavior: "smooth" }),
            confirm: "Scrolling up",
            description: "Scroll up",
            example: "Scroll up",
            category: "Scrolling",
        },
        {
            keywords: ["top", "beginning"],
            action: () => window.scrollTo({ top: 0, behavior: "smooth" }),
            confirm: "Going to top",
            description: "Scroll to top",
            example: "Go to top",
            category: "Scrolling",
        },

        // ─── Accessibility ───────────────────────────────────────────────
        {
            keywords: ["screen reader on", "accessibility on", "narrate"],
            synonyms: ["narrator", "blind", "spoken", "voice over", "voiceover"],
            antiKeywords: ["off", "stop", "disable"],
            action: () => {
                window.dispatchEvent(
                    new CustomEvent<boolean>("accessibility-set", { detail: true }),
                );
            },
            description: "Turn screen reader mode on",
            example: "Turn on the narrator",
            category: "Other",
        },
        {
            keywords: ["screen reader off", "accessibility off", "stop narrating"],
            synonyms: ["disable narration", "disable narrator", "quiet"],
            action: () => {
                window.dispatchEvent(
                    new CustomEvent<boolean>("accessibility-set", { detail: false }),
                );
            },
            description: "Turn screen reader mode off",
            example: "Turn off the narrator",
            category: "Other",
        },
        {
            keywords: ["where am i", "describe page", "what page", "page description"],
            synonyms: ["orient", "context", "tell me where"],
            action: () => {
                // Build a short description from the current page: title +
                // active landmarks. This works on every route because we
                // don't depend on app-specific state.
                const titleEl =
                    document.querySelector("h1") ||
                    document.querySelector("[role='heading']");
                const pageTitle =
                    (titleEl?.textContent || document.title || "this page").trim();
                const path = window.location.pathname.replace(/\//g, " ").trim() || "home";
                const main = document.querySelector("main, [role='main']");
                const firstParagraph = main?.querySelector("p")?.textContent?.trim() ?? "";

                let summary = `You are on ${pageTitle}.`;
                if (path) summary += ` Route: ${path}.`;
                if (firstParagraph) {
                    const snippet = firstParagraph.length > 240
                        ? firstParagraph.slice(0, 240) + "…"
                        : firstParagraph;
                    summary += ` ${snippet}`;
                }
                summary += " Say 'help' to hear available commands.";
                speak(summary, 1.0);
            },
            description: "Describe the current page",
            example: "Where am I",
            category: "Reading",
        },
        {
            keywords: ["list links", "links on page", "what can i click"],
            synonyms: ["interactive", "buttons", "actions"],
            action: () => {
                const main = document.querySelector("main, [role='main']") || document;
                const els = Array.from(
                    main.querySelectorAll<HTMLElement>(
                        "a[href], button:not([disabled]), [role='button']",
                    ),
                );
                const labels = els
                    .map((el) => (el.getAttribute("aria-label") || el.textContent || "").trim())
                    .filter((s) => s && s.length < 60)
                    .slice(0, 8);
                if (labels.length === 0) {
                    speak("I couldn't find any obvious actions on this page.");
                    return;
                }
                speak(
                    `Available actions: ${labels.join(", ")}. Say one to activate it.`,
                    0.95,
                );
            },
            description: "List available actions",
            example: "What can I click",
            category: "Reading",
        },
        {
            keywords: ["submit", "submit form", "send"],
            synonyms: ["go", "confirm"],
            antiKeywords: ["answer", "quiz", "cancel"],
            action: () => {
                // Find the closest visible form's primary submit button. On
                // login/signup this lets a blind user finish the auth flow
                // entirely by voice.
                const btn = document.querySelector<HTMLButtonElement>(
                    "form button[type='submit']:not([disabled])",
                );
                if (btn) {
                    btn.click();
                } else {
                    speak("No form to submit on this page.");
                }
            },
            confirm: "Submitting the form",
            description: "Submit the form on screen",
            example: "Submit form",
            category: "Other",
        },
        {
            keywords: ["repeat", "say that again", "repeat that"],
            synonyms: ["again", "what did you say", "pardon"],
            antiKeywords: ["question", "stop"],
            action: () => {
                // Re-speak the last AI response stored in the body attribute
                const last = document.body.getAttribute("data-last-ai-response") || "";
                if (last) {
                    speak(last, 0.95);
                } else {
                    speak("I haven't said anything yet. Try asking me a question.");
                }
            },
            description: "Repeat the last AI response",
            example: "Repeat that",
            category: "Reading",
        },
        {
            keywords: ["ask tutor", "explain", "what is", "what are", "how does", "why"],
            synonyms: ["tell me about", "teach me", "clarify", "define"],
            antiKeywords: ["stop", "cancel", "back"],
            action: () => {
                // This is a catch-all for conversational queries that start
                // with question words. We dispatch to the conversational AI.
                const transcript = document.body.getAttribute("data-voice-transcript") || "";
                if (transcript.length > 3) {
                    window.dispatchEvent(
                        new CustomEvent<string>("voice-unrecognized", { detail: transcript }),
                    );
                } else {
                    speak("What would you like me to explain? Try saying 'explain normalization' or 'what is a primary key'.");
                }
            },
            description: "Ask the AI tutor a question",
            example: "Explain normalization",
            category: "Other",
        },
        ...extraCommands,
    ];

    // ─── Match transcript against commands (intent-based) ────────────────
    const matchCommand = useCallback((text: string): VoiceCommand | null => {
        let best: VoiceCommand | null = null;
        let bestScore = 0;
        for (const cmd of commandsRef.current) {
            const s = scoreIntent(text, cmd);
            if (s > bestScore) {
                bestScore = s;
                best = cmd;
            }
        }
        // Lower threshold for natural language — even one solid keyword wins
        return best && bestScore >= 1 ? best : null;
    }, []);

    // ─── Initialize recognition (once) ───────────────────────────────────
    useEffect(() => {
        if (typeof window === "undefined") return;

        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) {
            setSupported(false);
            return;
        }
        setSupported(true);

        const recognition = new SR();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
            setIsAnalyzing(false);
            setError(null);
            userStoppedRef.current = false;
        };

        recognition.onresult = (event: any) => {
            let interimText = "";
            let finalText = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const r = event.results[i];
                if (r.isFinal) finalText += r[0].transcript;
                else interimText += r[0].transcript;
            }
            if (interimText) setInterim(interimText);
            if (finalText) {
                setTranscript(finalText);
                setInterim("");
                // Expose the latest transcript so page-specific commands
                // (e.g. quiz voice) can read it before they fire.
                if (typeof document !== "undefined") {
                    document.body.setAttribute("data-voice-transcript", finalText);
                }
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            setInterim("");

            queueMicrotask(() => {
                setTranscript((current) => {
                    const text = (current || "").trim();
                    if (!text) {
                        setIsAnalyzing(false);
                        if (userStoppedRef.current) {
                            speak("I didn't hear anything. Try again.");
                        }
                        return current;
                    }

                    setIsAnalyzing(true);
                    const match = matchCommand(text);

                    setTimeout(() => {
                        if (match) {
                            try { match.action(); } catch (err) { console.error(err); }
                            if (match.confirm) setTimeout(() => speak(match.confirm!), 80);
                            setIsAnalyzing(false);
                            if (timeoutRef.current) clearTimeout(timeoutRef.current);
                            timeoutRef.current = setTimeout(() => setTranscript(""), 1800);
                        } else {
                            // No command matched — dispatch to conversational AI
                            // so blind users can ask free-form questions. The
                            // `useVoiceConversation` hook listens for this event.
                            window.dispatchEvent(
                                new CustomEvent<string>("voice-unrecognized", { detail: text }),
                            );
                            setIsAnalyzing(false);
                            if (timeoutRef.current) clearTimeout(timeoutRef.current);
                            timeoutRef.current = setTimeout(() => {
                                setTranscript("");
                                if (wantListeningRef.current) {
                                    try { recognition.start(); } catch {}
                                }
                            }, 1800);
                        }
                    }, 350);

                    return current;
                });
            });
        };

        recognition.onerror = (event: any) => {
            const code = event.error || "unknown";
            setError(code);
            setIsListening(false);
            setIsAnalyzing(false);
            setInterim("");
            if (code === "not-allowed" || code === "service-not-allowed") {
                speak("Microphone access denied. Please allow access in browser settings.");
            } else if (code === "no-speech") {
                playTone(220, 80, "triangle");
            } else if (code !== "aborted") {
                console.warn("Speech recognition error:", code);
            }
        };

        recognitionRef.current = recognition;

        return () => {
            try { recognition.abort(); } catch {}
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [matchCommand]);

    // ─── Controls ────────────────────────────────────────────────────────
    const start = useCallback(() => {
        if (!recognitionRef.current || !enabled) return;
        if (isListening) return;

        const ctx = getAudioCtx();
        if (ctx?.state === "suspended") ctx.resume().catch(() => {});

        playTone(880, 100);
        setTimeout(() => playTone(1100, 100), 110);

        wantListeningRef.current = true;
        userStoppedRef.current = false;
        setError(null);
        setTranscript("");
        setInterim("");

        try {
            recognitionRef.current.start();
        } catch (e: any) {
            if ((e?.message || "").includes("already started")) {
                try {
                    recognitionRef.current.abort();
                    setTimeout(() => {
                        try { recognitionRef.current.start(); } catch {}
                    }, 50);
                } catch {}
            } else {
                console.error("Failed to start recognition:", e);
                setError("start-failed");
            }
        }
    }, [enabled, isListening]);

    const stop = useCallback(() => {
        wantListeningRef.current = false;
        userStoppedRef.current = true;
        if (!recognitionRef.current) return;
        try { recognitionRef.current.stop(); } catch {}
        playTone(660, 80);
        setTimeout(() => playTone(440, 80), 90);
    }, []);

    const toggle = useCallback(() => {
        if (isListening || isAnalyzing) stop();
        else start();
    }, [isListening, isAnalyzing, start, stop]);

    // ─── Keyboard shortcut: Left Ctrl to toggle ──────────────────────────
    useEffect(() => {
        if (typeof window === "undefined" || !supported) return;

        let pressedRecently = false;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code !== "ControlLeft") return;
            if (e.repeat) return;
            if (e.shiftKey || e.altKey || e.metaKey) return;
            const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
            if (tag === "input" || tag === "textarea" || (e.target as HTMLElement)?.isContentEditable) {
                return;
            }
            if (pressedRecently) return;
            pressedRecently = true;
            setTimeout(() => { pressedRecently = false; }, 400);

            e.preventDefault();
            toggle();
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [toggle, supported]);

    return {
        isListening,
        isAnalyzing,
        transcript,
        interim,
        supported,
        error,
        toggle,
        start,
        stop,
        availableCommands: commandsRef.current.map((c) => ({
            description: c.description,
            example: c.example,
            keywords: [...c.keywords, ...(c.synonyms ?? [])],
            category: c.category ?? "Navigation",
        })),
    };
}
