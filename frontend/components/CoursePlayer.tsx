"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { useBehavior } from '@/hooks/useBehavior';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import QuestionComponent from './QuestionComponent';
import { ConfusionIndicator, ConfusionData, AdaptationToast } from './ConfusionIndicator';
import { AdaptiveInsightsPanel, AdaptiveDecision } from './AdaptiveInsightsPanel';
import { SupplementaryInfoPanel } from "./SupplementaryInfoPanel";
import ConceptExplainerModal from "./ConceptExplainerModal";
import { LessonTutor } from "./LessonTutor";
import { StruggleTracker } from "@/lib/adaptive/struggleDetection";
import { SqlPlayground } from "./SqlPlayground";
import { getSqlChallenge } from "@/lib/sqlChallenges";
import { RemediationPathPanel } from "./RemediationPathPanel";
import { apiFetch, markSubtopicComplete } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useAccessibility } from '@/hooks/useAccessibility';
import { useRegisterVoiceCommands } from '@/hooks/voiceCommandRegistry';
import { useVoiceConversation } from '@/hooks/useVoiceConversation';
import { NeuralButton } from '@/components/neural/NeuralButton';
import { NeuralIconButton } from '@/components/neural/NeuralIconButton';
import { TooltipProvider } from "@/components/ui/tooltip";
import { Question } from '@/types';
import { useParams, useSearchParams } from 'next/navigation';
import {
    Brain, Zap,
    Check,
    Type,
    Volume2,
    Activity,
    X as XIcon,
    ChevronLeft,
    BrainCircuit,
    Sparkles,
    ChevronRight,
    ArrowRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface CoursePlayerProps {
    courseId: string;
    unitId: string;
    subtopicId: string;
    userId?: string;
}

// Interface for the behavior API response with ML decisions
interface BehaviorResponse {
    status: string;
    confusion?: ConfusionData;
    recommendation?: AdaptiveDecision;
    intervention_triggered: boolean;
    intervention_type?: string;
}

interface SubtopicContent {
    id: string;
    title: string;
    unit_title?: string;
    content: string;
    adaptation?: string;
    next_subtopic?: { id: string; title: string };
    subtopics?: { id: string; title: string }[];
}

// Global cache for subtopic content to enable instant navigation
const SUBTOPIC_CACHE: Record<string, SubtopicContent> = {};

export default function CoursePlayer({ courseId, unitId, subtopicId, userId }: CoursePlayerProps) {
    const { user } = useAuth();
    const { announce } = useAccessibility();

    const [struggledQuestions, setStruggledQuestions] = useState<{
        id: string;
        text: string;
        reason: string;
        userSelected?: string;
        correctAnswer?: string;
        isCorrect?: boolean;
    }[]>([]);

    // Helper to get demo explanations (since we don't have them in DB yet)
    const getDemoExplanation = useCallback((qText: string, userSelected: string | undefined): string => {
        if (!userSelected) return "Review this concept.";

        const lowerQ = qText.toLowerCase();
        const lowerSel = userSelected.toLowerCase();

        if (lowerQ.includes("primary key")) {
            if (lowerSel.includes("foreign")) return "Foreign keys are for linking tables, not identifying records in the current table.";
            if (lowerSel.includes("numeric")) return "Primary keys don't have to be numeric, they just have to be unique.";
            return "A Primary Key must UNIQUELY identify each row.";
        }
        if (lowerQ.includes("atomic")) {
            if (lowerSel.includes("duplicate")) return "Atomic means 'indivisible', single values. Duplicates are a different issue.";
            return "In the Relational Model, every cell must hold a single, atomic value (1NF).";
        }
        return "Review the section on this topic to clarify your understanding.";
    }, []);

    const [content, setContent] = useState("Loading...");
    const [title, setTitle] = useState(subtopicId);
    const [unitTitle, setUnitTitle] = useState(unitId);
    const [completedSubtopics, setCompletedSubtopics] = useState<string[]>([]);
    const [masteryBySubtopic, setMasteryBySubtopic] = useState<Record<string, number>>({});
    const [previousScore, setPreviousScore] = useState<{ score: number, total: number } | null>(null);
    const [nextSubtopic, setNextSubtopic] = useState<{ id: string; title: string } | null>(null);
    const [unitSubtopics, setUnitSubtopics] = useState<{ id: string; title: string }[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [quizStarted, setQuizStarted] = useState(false);
    const [quizCompleted, setQuizCompleted] = useState(false);
    const [score, setScore] = useState(0);
    const [showNextButton, setShowNextButton] = useState(false);

    // Enable lesson-scoped conversational AI so free-form voice questions
    // get the current lesson as context for smarter answers.
    useVoiceConversation({
        courseId,
        unitId,
        subtopicId,
        lessonTitle: title !== subtopicId ? title : undefined,
        lessonSnippet: content !== "Loading..." ? content.slice(0, 1500) : undefined,
        enabled: true,
    });

    /** Sliding-window struggle detector — populated as the user answers questions. */
    const struggleTrackerRef = React.useRef<StruggleTracker>(new StruggleTracker(50));

    // ML Decision State (adaptive engine visibility)
    const [confusionData, setConfusionData] = useState<ConfusionData | null>(null);
    const [adaptiveDecision, setAdaptiveDecision] = useState<AdaptiveDecision | null>(null);
    const [showAdaptationToast, setShowAdaptationToast] = useState(false);
    const params = useParams();

    // New State: Metrics for Sidebar
    const [quizHistory, setQuizHistory] = useState<{ id: number, score: number, label: string, unitId: string, subtopicId: string }[]>([]);

    // Accessibility State
    const [accessibility, setAccessibility] = useState({
        bionic: false,
        focusMode: false,
        dyslexic: false,
        tts: false
    });

    const [isSpeaking, setIsSpeaking] = useState(false);

    // Explainer Modal State
    const [showExplainerModal, setShowExplainerModal] = useState(false);
    const [explainerContent, setExplainerContent] = useState("");
    const [explainerTitle, setExplainerTitle] = useState("");
    const [explainerLoading, setExplainerLoading] = useState(false);

    // Helper to strip markdown symbols for TTS and Bionic Reader
    const stripMarkdown = (md: string) => {
        if (!md) return "";
        return md
            .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
            .replace(/#{1,6}\s?/g, '')       // Remove headers
            .replace(/\*\*/g, '')            // Remove bold
            .replace(/\*/g, '')              // Remove italics
            .replace(/`/g, '')               // Remove code ticks
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
            .replace(/>\s?/g, '')            // Remove blockquotes
            .replace(/-\s/g, '')             // Remove list dashes
            .replace(/---/g, '');            // Remove horizontal rules
    };

    // TTS Logic
    const toggleTTS = () => {
        if (isSpeaking) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        } else {
            const textToSpeak = stripMarkdown(content);
            const utterance = new SpeechSynthesisUtterance(textToSpeak);
            utterance.onend = () => setIsSpeaking(false);
            window.speechSynthesis.speak(utterance);
            setIsSpeaking(true);
        }
    };

    // Cancel any in-flight speech synthesis when the component unmounts
    // (e.g. user navigates away mid-narration).
    useEffect(() => {
        return () => {
            window.speechSynthesis?.cancel();
        };
    }, []);

    // Bionic Reading transform — bolds the first ~40% of each word inside a
    // string. Applied as a markdown component override below so we keep the
    // ReactMarkdown renderer (and the original sans-serif font) intact.
    const bionicifyString = useCallback((text: string): React.ReactNode[] => {
        return text.split(/(\s+)/).map((token, i) => {
            if (/^\s+$/.test(token) || token.length < 3) {
                return <React.Fragment key={i}>{token}</React.Fragment>;
            }
            const splitIndex = Math.ceil(token.length * 0.4);
            return (
                <React.Fragment key={i}>
                    <strong className="font-semibold text-slate-900">{token.slice(0, splitIndex)}</strong>
                    {token.slice(splitIndex)}
                </React.Fragment>
            );
        });
    }, []);

    const renderBionic = useCallback((children: React.ReactNode): React.ReactNode => {
        if (!accessibility.bionic) return children;
        return React.Children.map(children, (child, idx) => {
            if (typeof child === 'string') {
                return <React.Fragment key={idx}>{bionicifyString(child)}</React.Fragment>;
            }
            return child;
        });
    }, [accessibility.bionic, bionicifyString]);
    const [interventionType, setInterventionType] = useState<string | null>(null);
    const [difficultyLevel, setDifficultyLevel] = useState("1"); // Default to Expert
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleConfusionUpdate = useCallback((score: number) => {
        // This will be called from the behavior hook when confusion is detected
    }, []);

    // Initialize behavior tracking — but only enable while the quiz dialog is open.
    // Reading the lesson body should not slam /behavior with confusion ML calls.
    const behavior = useBehavior({
        userId: userId || user?.uid || "anonymous",
        contextId: `${unitId}_${subtopicId}`,
        onConfusion: handleConfusionUpdate,
        enabled: quizStarted && !quizCompleted,
    });

    // Reset the per-question timing baseline whenever the active question changes.
    useEffect(() => {
        if (quizStarted && !quizCompleted) {
            behavior.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentQuestionIndex, quizStarted, quizCompleted]);

    // Load existing progress on mount (read-only — completion is recorded
    // when the quiz is finished, not when the page is opened).
    useEffect(() => {
        const effectiveUserId = userId || user?.uid;
        if (!effectiveUserId) return;
        apiFetch<{ completed_subtopics: string[] }>(
            `/courses/${courseId}/progress?user_id=${effectiveUserId}`
        )
            .then((data) => {
                if (data && data.completed_subtopics) {
                    setCompletedSubtopics(data.completed_subtopics);
                }
            })
            .catch((err) => console.error("Failed to load progress:", err));

        // Pull the BKT mastery snapshot so the adaptive remediation panel
        // can compute weakest-prereq paths. Failure is non-fatal — we just
        // fall back to "completed-only" estimates.
        apiFetch<{ weak_skills: { skill: string; score: number }[] }>(
            `/answers/mastery/${effectiveUserId}`,
        )
            .then((m) => {
                if (!m?.weak_skills) return;
                const map: Record<string, number> = {};
                for (const s of m.weak_skills) {
                    // weak_skills score is 0..100; normalise to 0..1.
                    map[s.skill] = Math.max(0, Math.min(1, (s.score ?? 0) / 100));
                }
                setMasteryBySubtopic(map);
            })
            .catch(() => {
                /* tolerate — remediation falls back to completion-only */
            });
    }, [userId, user]);



    // Define fetchContent for initial load AND re-load on intervention
    const fetchContent = useCallback(async (adaptationType?: string, fetchHistory: boolean = true) => {
        if (!unitId || !subtopicId) return;

        const effectiveUserId = userId || user?.uid || "anonymous";
        const cacheKey = `${unitId}_${subtopicId}_${adaptationType || 'default'}`;

        // 1. CACHE CHECK: If we have content in memory, use it INSTANTLY
        if (SUBTOPIC_CACHE[cacheKey]) {
            const cached = SUBTOPIC_CACHE[cacheKey];
            setContent(cached.content);
            setTitle(cached.title);
            if (cached.unit_title) setUnitTitle(cached.unit_title);
            setNextSubtopic(cached.next_subtopic || null);
            if (cached.subtopics) setUnitSubtopics(cached.subtopics);
            // We still continue to fetch history/questions in background if needed, 
            // but the UI is unblocked.
        } else {
            setContent("Loading...");
        }

        // Build URL with optional adaptation param
        let url = `/courses/${courseId}/units/${unitId}/subtopics/${subtopicId}?user_id=${effectiveUserId}`;
        // Prioritize explicit adaptation arg, otherwise use state
        const levelToFetch = adaptationType || difficultyLevel;
        if (levelToFetch) {
            url += `&adaptation=${levelToFetch}`;
        }

        // Update state if adaptationType was passed (e.g. from ML) so UI matches
        if (adaptationType) {
            setDifficultyLevel(adaptationType);
        }

        try {
            // 2. PARALLEL FETCHING: Fetch Content, History (optional), and Questions at the same time
            const promises: [Promise<SubtopicContent>, Promise<any>?, Promise<any[]>?] = [
                // Fetch 1: Content
                apiFetch<SubtopicContent>(url)
            ];

            // Fetch 2: History (only if needed)
            if (fetchHistory && (userId || user?.uid)) {
                const uid = userId || user?.uid;
                promises.push(apiFetch<{ attempts: any[] }>(`/answers/quiz-history/${uid}`));
            } else {
                promises.push(Promise.resolve(null)); // Placeholder
            }

            // Fetch 3: Questions (passing user_id so the backend can return
            // a deterministic 3-question sample per user+subtopic)
            const uidForQ = userId || user?.uid || '';
            const qUrl = uidForQ
                ? `/questions/${subtopicId}?user_id=${encodeURIComponent(uidForQ)}`
                : `/questions/${subtopicId}`;
            promises.push(apiFetch<any[]>(qUrl));

            // WAIT for all to finish
            const [data, historyResponse, fetchedQuestions] = await Promise.all(promises);

            // PROCESS CONTENT
            if (data) {
                // Save to Cache
                SUBTOPIC_CACHE[cacheKey] = data;

                setContent(data.content);
                setTitle(data.title);
                if (data.unit_title) {
                    setUnitTitle(data.unit_title);
                }
                if (data.next_subtopic) {
                    setNextSubtopic(data.next_subtopic);
                } else {
                    setNextSubtopic(null);
                }
                if (data.subtopics) {
                    setUnitSubtopics(data.subtopics);
                }

                if (data.adaptation) {
                    // Could show adaptation note if needed
                }
            }

            // PROCESS HISTORY
            if (historyResponse && historyResponse.attempts) {
                const attempt = historyResponse.attempts.find((h: any) =>
                    h.unit_id === unitId && h.subtopic_id === subtopicId
                );
                if (attempt) {
                    setPreviousScore({ score: attempt.score, total: attempt.total_questions });
                } else {
                    setPreviousScore(null);
                }

                // Hydrate sidebar history
                const mappedHistory = historyResponse.attempts.map((h: any) => ({
                    id: h.timestamp ? new Date(h.timestamp).getTime() : Math.random(),
                    score: Math.round(h.percentage),
                    label: h.subtopic_title || h.subtopic_id
                        .split('-')
                        .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' '),
                    unitId: h.unit_id,
                    subtopicId: h.subtopic_id
                })).slice(0, 5); // Take top 5 recent
                setQuizHistory(mappedHistory);
            }

            // PROCESS QUESTIONS — only show real questions seeded in Firestore.
            // No hardcoded fallback (those broke answer feedback because the
            // backend has no row for them, falls through to correct_index=0
            // and returns the wrong feedback message).
            if (fetchedQuestions && fetchedQuestions.length > 0) {
                setQuestions(fetchedQuestions.map((q, i) => ({
                    id: q.id || `q${i}`,
                    text: q.question_text || q.text || q.question || "Question",
                    options: q.options || [],
                    correctAnswer: q.correct_answer ?? ""
                })));
            } else {
                setQuestions([]);
            }

        } catch (err) {
            console.error("Error fetching course data:", err);
            setContent("Failed to load content. Please check your connection.");
        }
    }, [unitId, subtopicId, userId, user]);

    const searchParams = useSearchParams();

    // Fetch content on mount
    useEffect(() => {
        const adaptParam = searchParams.get('adaptation');
        if (adaptParam) {
            setInterventionType('simplified'); // Visual feedback
            setShowAdaptationToast(true);
            fetchContent(adaptParam);
        } else {
            fetchContent();
        }
    }, [fetchContent, searchParams]);

    // Announce the lesson when its title resolves so screen-reader / spoken
    // mode users know what they landed on without poking around.
    const announcedTitleRef = React.useRef<string | null>(null);
    useEffect(() => {
        if (!title || title === subtopicId) return;
        if (announcedTitleRef.current === title) return;
        announcedTitleRef.current = title;
        announce(
            `Lesson loaded: ${title}. Press the take quiz button or say 'take quiz' to start. Say 'read this' to hear the lesson aloud.`,
        );
    }, [title, subtopicId, announce]);

    const startQuiz = useCallback(() => {
        if (questions.length === 0) return;
        setQuizStarted(true);
        setQuizCompleted(false);
        setCurrentQuestionIndex(0);
        setScore(0);
        setStruggledQuestions([]);
        setShowNextButton(false);
        announce(
            `Quiz started. ${questions.length} question${questions.length === 1 ? "" : "s"}. The first question will be read out shortly.`,
            { assertive: true },
        );
    }, [questions.length, announce]);

    // Register page-level voice commands while CoursePlayer is mounted.
    // A blind user can now go from landing → login → dashboard → lesson →
    // quiz entirely by voice.
    useRegisterVoiceCommands(React.useMemo(
        () => [
            {
                keywords: ["take quiz", "start quiz", "begin quiz"],
                synonyms: ["quiz", "test me", "knowledge check"],
                antiKeywords: ["next question", "submit", "stop"],
                action: () => {
                    if (questions.length === 0) {
                        window.speechSynthesis?.cancel();
                        const u = new SpeechSynthesisUtterance(
                            "No quiz is available for this lesson yet.",
                        );
                        u.rate = 1.0;
                        window.speechSynthesis?.speak(u);
                        return;
                    }
                    startQuiz();
                },
                confirm: "Starting the quiz",
                description: "Take the lesson quiz",
                example: "Take the quiz",
                category: "Quiz",
            },
            {
                keywords: ["read lesson", "read this lesson", "read aloud"],
                synonyms: ["narrate lesson", "speak lesson"],
                antiKeywords: ["question", "stop"],
                action: () => {
                    const prose = document.querySelector(".prose");
                    const txt = (prose?.textContent || "").slice(0, 6000);
                    if (!txt) return;
                    window.speechSynthesis?.cancel();
                    const u = new SpeechSynthesisUtterance(txt);
                    u.rate = 0.95;
                    window.speechSynthesis?.speak(u);
                },
                confirm: "Reading the lesson",
                description: "Read the lesson aloud",
                example: "Read this lesson",
                category: "Reading",
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [questions.length, startQuiz],
    ));

    // Fetch ML decisions periodically and on behavior flush
    const fetchMLDecisions = useCallback(async () => {
        setIsAnalyzing(true);
        try {
            const behaviorData = behavior.getBehaviorData();

            const response = await apiFetch<BehaviorResponse>('/behavior', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: behaviorData.user_id,
                    event_type: 'behavior_snapshot',
                    data: {
                        session_id: behaviorData.session_id,
                        screen: `${unitId}_${subtopicId}`,
                        time_ms: behaviorData.time_on_question_ms,
                        hesitation_ms: behaviorData.hesitation_ms,
                        tab_switches: behaviorData.tab_switches,
                        scroll_depth: behaviorData.scroll_depth_pct,
                        attempts: behaviorData.attempts,
                        hint_requests: behaviorData.hint_requests,
                    },
                    timestamp: new Date().toISOString(),
                }),
            });

            // Update confusion state
            if (response.confusion) {
                setConfusionData(response.confusion);
            }

            // Update adaptive decision — enrich with the local
            // difficulty engine so the insights panel shows a richer "why".
            if (response.recommendation) {
                try {
                    const { buildPerformanceMetrics, calculateDifficultyAdjustment } =
                        await import("@/lib/adaptive/difficulty");

                    const metrics = buildPerformanceMetrics(
                        quizHistory.map((h) => ({
                            isCorrect: h.score >= 50,
                            timestamp: h.id,
                        })),
                    );
                    const decision = calculateDifficultyAdjustment(
                        metrics,
                        Number(difficultyLevel) || 3,
                    );
                    setAdaptiveDecision({
                        ...response.recommendation,
                        reason:
                            decision.reason +
                            (response.recommendation.reason
                                ? ` ${response.recommendation.reason}`
                                : ""),
                    });
                } catch {
                    setAdaptiveDecision(response.recommendation);
                }
            }

            // Handle intervention trigger
            if (response.intervention_triggered && response.intervention_type) {
                setInterventionType(response.intervention_type);
                setShowAdaptationToast(true);
                announce(
                    `Adapting the lesson based on your behavior. New mode: ${String(response.intervention_type).replace(/_/g, " ")}.`,
                    { assertive: true },
                );
                // RELOAD CONTENT to show the adaptation (Visual/Analogy/etc)
                setTimeout(() => {
                    const newLevel = String(response.intervention_type);
                    setDifficultyLevel(newLevel);
                    fetchContent(newLevel);
                }, 1500); // 1.5s delay to let the user see the "Adapting..." toast
                setTimeout(() => setShowAdaptationToast(false), 5000);
            }

        } catch (error) {
            console.error("ML decision fetch failed:", error);
        } finally {
            setIsAnalyzing(false);
        }
    }, [behavior, unitId, subtopicId, fetchContent]);

    // Periodic ML analysis while the quiz is active.
    // Runs every 30s + a single 3s warm-up. Disabled outside the quiz to
    // avoid hammering the backend during passive reading.
    useEffect(() => {
        if (!behavior.isTracking) return;

        const initialTimeout = setTimeout(fetchMLDecisions, 3000);
        const interval = setInterval(fetchMLDecisions, 30000);

        return () => {
            clearTimeout(initialTimeout);
            clearInterval(interval);
        };
    }, [fetchMLDecisions, behavior.isTracking]);

    // Loading Skeleton
    if (content === "Loading...") {
        return (
            <div className="min-h-screen bg-[#f2f4f6] flex">
                <div className="w-80 border-r border-slate-200 h-screen hidden lg:block p-8 space-y-6 bg-white shadow-soft z-10">
                    <div className="h-10 w-3/4 bg-slate-100 rounded-xl animate-pulse" />
                    <div className="space-y-4 mt-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-16 w-full bg-slate-50 rounded-[1.5rem] animate-pulse" />
                        ))}
                    </div>
                </div>
                <div className="flex-1 max-w-5xl mx-auto px-12 py-10 space-y-8">
                    <div className="h-12 w-1/2 bg-slate-200 rounded-2xl animate-pulse mb-8" />
                    <div className="space-y-4">
                        <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
                        <div className="h-4 w-full bg-slate-200 rounded animate-pulse" />
                        <div className="h-64 w-full bg-slate-100 rounded-[2.5rem] animate-pulse mt-8" />
                    </div>
                </div>
            </div>
        );
    }

    const handleQuizCompletion = async () => {
        setQuizCompleted(true);
        const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
        announce(
            `Quiz complete. You scored ${score} out of ${questions.length}. That is ${pct} percent.`,
            { assertive: true },
        );
        const behaviorData = behavior.getBehaviorData();

        // Mark the subtopic as completed now that the user has finished the quiz.
        const effectiveUserId = userId || user?.uid;
        if (effectiveUserId && unitId && subtopicId) {
            try {
                await markSubtopicComplete(courseId, unitId, subtopicId, effectiveUserId);
                setCompletedSubtopics((prev) =>
                    prev.includes(subtopicId) ? prev : [...prev, subtopicId]
                );
            } catch (err) {
                console.error("Failed to mark subtopic complete:", err);
            }
        }

        try {
            const quizResult = await apiFetch<{
                status: string;
                recommended_level: number;
                score_pct: number;
                level_changed: boolean;
                level_direction: string;
            }>('/answers/submit-quiz', {
                method: 'POST',
                body: JSON.stringify({
                    user_id: userId || user?.uid || "anonymous",
                    unit_id: unitId,
                    subtopic_id: subtopicId,
                    subtopic_title: title,
                    score: score,
                    total_questions: questions.length,
                    current_level: Number(difficultyLevel) || 1,
                    confusion_detected: (confusionData?.confusion_score ?? 0) > 0.5,
                    metrics: {
                        total_time_ms: behaviorData.time_on_question_ms,
                        attempts: behaviorData.attempts
                    }
                })
            });

            // Update History Locally
            setQuizHistory(prev => [
                ...prev,
                {
                    id: Date.now(),
                    score: Math.round((score / questions.length) * 100),
                    label: title || (subtopicId as string).split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
                    unitId: unitId as string,
                    subtopicId: subtopicId as string
                }
            ]);

            // Immediately apply the recommended level — the user sees the
            // content change right after the quiz, not on next page load.
            if (quizResult.level_changed && quizResult.recommended_level) {
                const newLevel = String(quizResult.recommended_level);
                setDifficultyLevel(newLevel);
                setInterventionType(quizResult.level_direction === "easier" ? "simplified" : "example");
                setShowAdaptationToast(true);
                announce(
                    quizResult.level_direction === "easier"
                        ? `Adjusting to simpler content based on your score. Now showing level ${quizResult.recommended_level}.`
                        : `Great work! Moving to more advanced content. Now at level ${quizResult.recommended_level}.`,
                    { assertive: true },
                );
                setTimeout(() => {
                    fetchContent(newLevel, false);
                }, 800);
                setTimeout(() => setShowAdaptationToast(false), 5000);
            } else {
                // Same level — just refresh to pick up any server-side changes
                setTimeout(() => {
                    fetchContent(undefined, false);
                }, 1000);
            }

        } catch (e) {
            console.error("Failed to submit quiz", e);
        }
    };

    return (
        <TooltipProvider delayDuration={300}>
            {/* Lesson Tutor — floating FAB + selection-spotlight */}
            <LessonTutor
                courseId={courseId}
                unitId={unitId}
                subtopicId={subtopicId}
                lessonSelector=".prose"
            />
            <div className="flex bg-[#f2f4f6] min-h-screen font-sans">
                <div className="flex-1 flex relative h-screen overflow-hidden">
                    {/* Lesson Navigation Sidebar (Desktop) */}
                    <aside className="w-80 bg-white border-r border-slate-200 hidden lg:flex flex-col z-20 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                        {/* Sidebar Header: Back Button */}
                        <div className="p-6 border-b border-slate-100/80">
                            <Link href="/course" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors group mb-6">
                                <div className="p-1.5 rounded-lg bg-slate-50 group-hover:bg-slate-100 transition-colors">
                                    <ChevronLeft size={16} />
                                </div>
                                Back to Courses
                            </Link>

                            <h2 className="text-lg font-bold text-slate-900 leading-tight">
                                {unitTitle.replace(/^(Unit \d+:\s*)/i, '') || "Course Content"}
                            </h2>
                            <p className="text-xs text-slate-400 mt-1 font-medium uppercase tracking-wide">
                                {unitSubtopics.length} Topics
                            </p>
                        </div>

                        {/* Topics List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-slate-200">
                            {unitSubtopics.map((sub, idx) => {
                                const isActive = sub.id === subtopicId;
                                const isCompleted = completedSubtopics.includes(sub.id);

                                return (
                                    <Link
                                        key={sub.id}
                                        href={`/course/${courseId}/${unitId}/${sub.id}`}
                                        className={`group flex items-start gap-3 p-3 rounded-xl transition-all duration-200 border relative overflow-hidden
                                            ${isActive
                                                ? "bg-black border-black shadow-md"
                                                : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-100"
                                            }`}
                                    >
                                        {/* Status Icon */}
                                        <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold transition-colors
                                            ${isActive
                                                ? "bg-white text-slate-900"
                                                : isCompleted
                                                    ? "bg-emerald-100 text-emerald-600"
                                                    : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                                            }`}
                                        >
                                            {isActive ? <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" /> :
                                                isCompleted ? <Check size={10} strokeWidth={3} /> : idx + 1}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className={`text-xs font-semibold leading-relaxed line-clamp-2
                                                ${isActive ? "text-white" : "text-slate-700 group-hover:text-slate-900"}`}>
                                                {sub.title}
                                            </p>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Focus Areas (Difficulty) - New Section */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-2 mb-3 px-2">
                                <BrainCircuit className="w-3 h-3 text-amber-500" />
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    Focus Areas
                                </h4>
                            </div>

                            {/* Mock Stuggled Topics (Logic to come from stats) */}
                            <div className="space-y-1">
                                {quizHistory.filter(h => h.score < 60).length > 0 ? (
                                    quizHistory.filter(h => h.score < 60).slice(0, 3).map((h, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                if (h.subtopicId === subtopicId) {
                                                    // Current topic: Show toast and refresh
                                                    setInterventionType('simplified'); // Show toast
                                                    setShowAdaptationToast(true);
                                                    fetchContent('2'); // Fetch Level 2 (Simplified)
                                                } else {
                                                    // different topic: Show Modal without navigating!
                                                    setExplainerTitle(h.label);
                                                    setExplainerContent("");
                                                    setExplainerLoading(true);
                                                    setShowExplainerModal(true);

                                                    // Fetch Level 5 (Analogy) purely for the modal
                                                    const effectiveUserId = userId || user?.uid || "anonymous";
                                                    const url = `/courses/${courseId}/units/${h.unitId}/subtopics/${h.subtopicId}?user_id=${effectiveUserId}&adaptation=5`;

                                                    // ALSO Switch Main View to Level 5 as requested
                                                    setDifficultyLevel("5");
                                                    fetchContent("5");

                                                    apiFetch<SubtopicContent>(url)
                                                        .then(data => {
                                                            setExplainerContent(data.content);
                                                        })
                                                        .catch(err => {
                                                            console.error("Failed to fetch explanation:", err);
                                                            setExplainerContent("Sorry, we couldn't generate an explanation right now. Please try again.");
                                                        })
                                                        .finally(() => {
                                                            setExplainerLoading(false);
                                                        });
                                                }
                                            }}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-amber-100/50 w-full hover:bg-amber-50 transition-colors text-left group/btn"
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 group-hover/btn:scale-125 transition-transform" />
                                            <span className="text-xs font-semibold text-slate-600 truncate flex-1">{h.label}</span>
                                            <span className="ml-auto text-[10px] font-bold text-amber-600 whitespace-nowrap">
                                                {h.score}% <span className="text-[9px] text-amber-400/80 font-normal ml-0.5">AI Explain</span>
                                            </span>
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-2 py-3 text-xs text-slate-400 italic text-center">
                                        No difficulty detected yet.
                                    </div>
                                )}
                            </div>
                        </div>

                    </aside>

                    <div className="flex-1 flex flex-col relative overflow-hidden">

                        {/* Adaptive Insights Panel (Top Overlay) */}
                        {adaptiveDecision && (
                            <div className="absolute top-6 left-0 right-0 z-50 px-4 flex justify-center pointer-events-none">
                                <div className="pointer-events-auto w-full max-w-lg">
                                    <AdaptiveInsightsPanel
                                        decision={adaptiveDecision}
                                        onRequestNewRecommendation={() => {
                                            setInterventionType('example');
                                            fetchContent('example');
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Modal for Focus Area Explanations */}
                        <ConceptExplainerModal
                            isOpen={showExplainerModal}
                            onClose={() => setShowExplainerModal(false)}
                            title={explainerTitle}
                            content={explainerContent}
                            isLoading={explainerLoading}
                        />

                        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 md:p-8 md:pl-20 relative scroll-smooth" aria-labelledby="lesson-title">
                            <div className="max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-sm min-h-full p-8 md:p-12 border border-slate-100 relative">

                                {/* Header */}
                                <header className="mb-10 border-b border-slate-100 pb-8">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-slate-400 uppercase">
                                            <span className="bg-slate-100 px-2 py-1 rounded-md">{unitId}</span>
                                            <ChevronRight size={12} strokeWidth={3} />
                                            <span className="text-slate-600">{subtopicId}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <NeuralIconButton icon={Volume2} onClick={toggleTTS} active={isSpeaking} />
                                            <NeuralIconButton icon={Type} onClick={() => setAccessibility(p => ({ ...p, bionic: !p.bionic }))} active={accessibility.bionic} />
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                                        <div className="space-y-4 max-w-2xl">
                                            {/* 🌟 Learning Mode Selector */}
                                            <div className="flex items-center gap-3 bg-white w-fit p-1 pr-3 rounded-full border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                                </div>
                                                <select
                                                    value={difficultyLevel}
                                                    onChange={(e) => {
                                                        const newLevel = e.target.value;
                                                        setDifficultyLevel(newLevel);
                                                        fetchContent(newLevel);
                                                    }}
                                                    className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer pr-2 appearance-none hover:text-amber-600 transition-colors"
                                                    aria-label="Select Learning Mode"
                                                >
                                                    <option value="1">Expert (Default)</option>
                                                    <option value="2">Simplified</option>
                                                    <option value="3">Key Points</option>
                                                    <option value="4">Real World</option>
                                                    <option value="5">Analogy</option>
                                                </select>
                                                <ChevronRight className="w-3 h-3 text-slate-400 rotate-90" />
                                            </div>

                                            <h1 id="lesson-title" className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                                                {title}
                                            </h1>
                                        </div>
                                        <NeuralButton
                                            variant="primary"
                                            disabled={questions.length === 0}
                                            className="bg-black text-white hover:bg-neutral-900 shadow-2xl shadow-black/20 px-10 h-14 rounded-[1.25rem] flex-shrink-0 flex items-center gap-3 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed disabled:hover:scale-100"
                                            onClick={() => {
                                                startQuiz();
                                            }}
                                        >
                                            <Brain className="w-5 h-5" />
                                            <span className="font-bold tracking-wide text-sm">
                                                {questions.length === 0 ? "Quiz Coming Soon" : "Take Quiz"}
                                            </span>
                                        </NeuralButton>
                                    </div>
                                </header>

                                {/* Content Renderer */}
                                <div className="prose prose-slate prose-lg max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-p:text-slate-600 prose-p:leading-8 prose-li:text-slate-600">
                                    <ReactMarkdown
                                        components={{
                                            h1: ({ node, children, ...props }) => <h1 className="text-3xl font-bold mt-10 mb-4 text-slate-900 tracking-tight" {...props}>{renderBionic(children)}</h1>,
                                            h2: ({ node, children, ...props }) => <h2 className="text-2xl font-bold mt-10 mb-4 text-slate-900 tracking-tight" {...props}>{renderBionic(children)}</h2>,
                                            h3: ({ node, children, ...props }) => <h3 className="text-xl font-bold mt-8 mb-3 text-slate-800" {...props}>{renderBionic(children)}</h3>,
                                            p: ({ node, children, ...props }) => <div className="mb-6 text-slate-600 leading-8 text-base" {...props}>{renderBionic(children)}</div>,
                                            ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-6 space-y-2 marker:text-slate-400" {...props} />,
                                            ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-6 space-y-2 marker:text-slate-500 marker:font-bold" {...props} />,
                                            li: ({ node, children, ...props }) => <li className="pl-2 text-slate-600 leading-7" {...props}>{renderBionic(children)}</li>,
                                            blockquote: ({ node, children, ...props }) => (
                                                <div className="my-6 border-l-4 border-slate-900 bg-slate-50 rounded-r-xl px-5 py-4" {...props}>
                                                    <div className="text-slate-700 text-sm leading-relaxed [&>div]:mb-0">{children}</div>
                                                </div>
                                            ),
                                            table: ({ node, ...props }) => (
                                                <div className="my-6 overflow-x-auto rounded-xl border border-slate-200">
                                                    <table className="w-full text-sm" {...props} />
                                                </div>
                                            ),
                                            thead: ({ node, ...props }) => <thead className="bg-slate-50 border-b border-slate-200" {...props} />,
                                            th: ({ node, ...props }) => <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" {...props} />,
                                            td: ({ node, ...props }) => <td className="px-4 py-3 text-slate-700 border-b border-slate-100" {...props} />,
                                            tr: ({ node, ...props }) => <tr className="hover:bg-slate-50/50 transition-colors" {...props} />,
                                            strong: ({ node, children, ...props }) => <strong className="font-bold text-slate-900" {...props}>{children}</strong>,
                                            a: ({ node, children, href, ...props }) => (
                                                <a href={href} className="text-blue-600 underline decoration-blue-200 underline-offset-2 hover:decoration-blue-500 transition-colors" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
                                            ),
                                            hr: () => <hr className="my-8 border-none h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />,
                                            code: ({ node, inline, className, children, ...props }: any) => {
                                                const match = /language-(\w+)/.exec(className || '')
                                                const lang = match ? match[1] : '';
                                                return !inline ? (
                                                    <div className="relative my-6 rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-[#0f172a] group">
                                                        {/* Header bar with language + copy */}
                                                        <div className="flex items-center justify-between px-4 py-2.5 bg-[#1e293b] border-b border-white/5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex gap-1.5">
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                                                                </div>
                                                                <span className="ml-3 text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                                                                    {lang || 'code'}
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    const text = String(children).replace(/\n$/, '');
                                                                    navigator.clipboard.writeText(text);
                                                                }}
                                                                className="text-[10px] font-bold text-slate-500 hover:text-white px-2 py-1 rounded-md hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                                                            >
                                                                Copy
                                                            </button>
                                                        </div>
                                                        <pre className="p-4 overflow-x-auto selection:bg-indigo-500/30 text-[13px] leading-6">
                                                            <code className={`${className} font-mono text-slate-100`} {...props}>
                                                                {children}
                                                            </code>
                                                        </pre>
                                                    </div>
                                                ) : (
                                                    <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded-md font-mono text-[13px] border border-slate-200/80" {...props}>
                                                        {children}
                                                    </code>
                                                )
                                            }
                                        }}
                                    >
                                        {content}
                                    </ReactMarkdown>
                                </div>

                                {/* SQL playground — appears when this subtopic has a registered challenge. */}
                                {(() => {
                                    const challenge = getSqlChallenge(subtopicId);
                                    if (!challenge) return null;
                                    return (
                                        <div className="mt-10 p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                                            <SqlPlayground
                                                key={challenge.id}
                                                challenge={challenge}
                                                onComplete={(durationMs, attempts) => {
                                                    console.info(
                                                        "[SqlPlayground] Solved",
                                                        challenge.id,
                                                        `in ${(durationMs / 1000).toFixed(1)}s, attempts=${attempts}`,
                                                    );
                                                }}
                                            />
                                        </div>
                                    );
                                })()}

                                {/* Bottom Navigation */}
                                <div className="flex justify-between items-center mt-12 pt-8 border-t border-slate-100">
                                    <NeuralButton variant="ghost" className="text-slate-400 hover:text-slate-600">
                                        Previous Lesson
                                    </NeuralButton>
                                    {nextSubtopic && (
                                        <Link href={`/course/${courseId}/${unitId}/${nextSubtopic.id}`}>
                                            <NeuralButton variant="primary" className="bg-black hover:bg-neutral-800 text-white px-8 h-12 shadow-none border-none flex items-center justify-center gap-2">
                                                <span>Next Lesson</span>
                                                <ArrowRight size={18} />
                                            </NeuralButton>
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </main>
                        {/* Confusion Indicator (Floating) */}
                        <div className="absolute bottom-8 right-8 z-40 pointer-events-none">
                            <div className="pointer-events-auto">
                                {confusionData && (
                                    <ConfusionIndicator
                                        confusionData={confusionData}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Adaptation Toast */}
                        {showAdaptationToast && (
                            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
                                <AdaptationToast
                                    type={(interventionType as any) || 'example'}
                                    message={`Adapting to ${(interventionType || 'example').replace(/_/g, ' ')} style`}
                                />
                            </div>
                        )}

                    </div>
                    <SupplementaryInfoPanel stats={{
                        history: quizHistory,
                        average: quizHistory.length > 0
                            ? Math.round(quizHistory.reduce((acc, curr) => acc + curr.score, 0) / quizHistory.length)
                            : 0
                    }} />
                </div>
            </div >

            {/* Quiz Modal */}
            < Dialog open={quizStarted} onOpenChange={setQuizStarted} >
                <DialogContent className="sm:max-w-5xl w-full h-[85vh] bg-white rounded-[2rem] p-0 border-slate-100 shadow-2xl overflow-hidden flex flex-col [&>button]:hidden">

                    {/* Modal Header */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold text-sm">
                                {quizCompleted ? <Check size={16} /> : "?"}
                            </div>
                            <div>
                                <DialogTitle className="font-bold text-slate-900">Knowledge Check</DialogTitle>
                                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                                    {quizCompleted ? "Complete" : "Assessment"}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setQuizStarted(false)}
                            className="p-2 -mr-2 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-900 transition-colors"
                            aria-label="Close"
                        >
                            <XIcon size={28} />
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="flex-1 p-8 overflow-y-auto flex flex-col justify-center">
                        {quizCompleted ? (
                            <div className="text-center animate-in zoom-in-50 duration-500 max-w-2xl mx-auto w-full">
                                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                                    {score / questions.length > 0.7 ? <Check size={48} strokeWidth={3} /> : <Activity size={48} strokeWidth={3} />}
                                </div>
                                <h4 className="text-3xl font-bold text-slate-900 mb-2">
                                    {score / questions.length > 0.7 ? "Excellent Work!" : "Good Effort!"}
                                </h4>
                                <p className="text-slate-600 mb-8 text-lg">
                                    You scored <strong className="text-emerald-600 text-2xl mx-1">{score}/{questions.length}</strong>
                                </p>

                                {/* Struggle Analysis Panel */}
                                {struggledQuestions.length > 0 && (
                                    <div className="max-w-3xl mx-auto w-full mt-12 animate-in slide-in-from-bottom-4 duration-700 delay-200">
                                        <div className="flex items-center gap-3 mb-6 pl-1">
                                            <div className="p-2 bg-indigo-50 rounded-lg">
                                                <Brain className="h-5 w-5 text-indigo-600" />
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-slate-900 text-lg">Learning Insights</h5>
                                                <p className="text-sm text-slate-500 font-medium">Targeted concepts for review</p>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {struggledQuestions.map((q, idx) => (
                                                <div key={idx} className="bg-white p-6 rounded-[1.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group hover:border-indigo-100 transition-colors">

                                                    {/* Question Text */}
                                                    <div className="mb-4 pr-24">
                                                        <h6 className="font-bold text-slate-800 text-base leading-snug">{q.text}</h6>
                                                    </div>

                                                    {/* Action Button (Top Right) */}
                                                    <div className="absolute top-6 right-6">
                                                        <NeuralButton
                                                            variant="ghost"
                                                            className="text-xs h-9 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-100"
                                                            onClick={() => {
                                                                setInterventionType("example");
                                                                setShowAdaptationToast(true);
                                                                setQuizStarted(false);
                                                                fetchContent("example");
                                                            }}
                                                        >
                                                            Read Concept
                                                        </NeuralButton>
                                                    </div>

                                                    {/* Answers Comparison */}
                                                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-8 mb-5">
                                                        {q.userSelected && (
                                                            <div className="flex-1">
                                                                <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 block ${q.isCorrect ? 'text-emerald-600' : 'text-red-500'}`}>Your Answer</span>
                                                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${q.isCorrect ? 'text-emerald-700 bg-emerald-50/50 border-emerald-100/50' : 'text-red-600/90 bg-red-50/50 border-red-100/50'}`}>
                                                                    {q.isCorrect ? <Check size={14} className="shrink-0" /> : <XIcon size={14} className="shrink-0" />}
                                                                    <span className={`text-sm font-medium ${q.isCorrect ? '' : 'line-through decoration-red-300'}`}>{q.userSelected}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {q.correctAnswer && (
                                                            <div className="flex-1">
                                                                <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider mb-1 block">Correct Answer</span>
                                                                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50/50 px-3 py-2 rounded-lg border border-emerald-100/50">
                                                                    <Check size={14} className="shrink-0" />
                                                                    <span className="text-sm font-bold">{q.correctAnswer}</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* AI Analysis */}
                                                    <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                                                        <div className="flex gap-2.5">
                                                            <div className="mt-1 shrink-0">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/50" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Analysis</span>
                                                                <p className="text-sm text-slate-600 leading-relaxed">
                                                                    {getDemoExplanation(q.text, q.userSelected)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Detection Tag */}
                                                    < div className="mt-4 flex items-center gap-2" >
                                                        <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-600/90 text-[10px] font-bold uppercase tracking-wider border border-amber-100 inline-flex items-center gap-1.5">
                                                            <Zap size={10} className="fill-amber-500 text-amber-500" />
                                                            {q.reason}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Adaptive remediation path — surfaces weakest prereqs
                                            from the competency graph so the learner has a
                                            concrete next step instead of just "review". */}
                                        <div className="mt-6">
                                            <RemediationPathPanel
                                                subtopicId={subtopicId}
                                                masteryBySubtopic={{
                                                    ...masteryBySubtopic,
                                                    // The current subtopic has weakened — make
                                                    // sure the engine sees it that way too.
                                                    [subtopicId]:
                                                        questions.length > 0
                                                            ? score / questions.length
                                                            : 0,
                                                }}
                                                completed={
                                                    new Set(
                                                        score / Math.max(1, questions.length) > 0.7
                                                            ? [...completedSubtopics, subtopicId]
                                                            : completedSubtopics,
                                                    )
                                                }
                                                showChallenge={
                                                    score / Math.max(1, questions.length) > 0.7
                                                }
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Sticky Footer for Results */}
                                <div className="sticky bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md p-4 border-t border-slate-100 mt-auto -mx-8 -mb-8 flex justify-center gap-4 z-10">
                                    <NeuralButton
                                        onClick={() => {
                                            setQuizStarted(false);
                                            // Ensure we don't reset history here, just close state
                                        }}
                                        variant="ghost"
                                        className="text-slate-500 hover:text-slate-900"
                                    >
                                        Close Results
                                    </NeuralButton>
                                    <NeuralButton
                                        onClick={() => {
                                            setQuizCompleted(false);
                                            setCurrentQuestionIndex(0);
                                            setScore(0);
                                            setStruggledQuestions([]);
                                            setShowNextButton(false);
                                        }}
                                        variant="primary"
                                        className="bg-black text-white hover:bg-neutral-800 shadow-lg shadow-black/10"
                                    >
                                        Retake Quiz
                                    </NeuralButton>
                                </div>
                            </div>
                        ) : questions.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center flex-col gap-4">
                                <div className="w-12 h-12 border-4 border-slate-200 border-t-black rounded-full animate-spin" />
                                <p className="text-slate-500 font-medium animate-pulse">Loading assessment...</p>
                            </div>
                        ) : (
                            <div className="max-w-5xl mx-auto w-full h-full flex flex-col relative">
                                {/* Progress Dots */}
                                <div className="flex justify-center gap-3 mb-10">
                                    {questions.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => {
                                                setCurrentQuestionIndex(idx);
                                                setShowNextButton(false);
                                            }}
                                            className={`w-3 h-3 rounded-full transition-all duration-300 ${idx === currentQuestionIndex
                                                ? "bg-black scale-125 ring-2 ring-slate-200"
                                                : idx < currentQuestionIndex
                                                    ? "bg-slate-400 hover:bg-slate-500"
                                                    : "bg-slate-200 hover:bg-slate-300"
                                                }`}
                                        />
                                    ))}
                                </div>

                                <div className="flex items-center gap-4 md:gap-8 flex-1">
                                    {/* Left Arrow */}
                                    <button
                                        disabled={currentQuestionIndex === 0}
                                        onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                                        className={`p-3 rounded-full transition-all duration-200 flex-shrink-0 bg-slate-100/50 hover:bg-slate-100 ${currentQuestionIndex === 0
                                            ? "text-slate-300 cursor-not-allowed"
                                            : "text-slate-600 hover:text-slate-900"
                                            }`}
                                    >
                                        <ChevronLeft size={32} strokeWidth={2} />
                                    </button>

                                    {/* Question Content */}
                                    <div className="flex-1 w-full max-w-2xl mx-auto">
                                        {questions[currentQuestionIndex] && (() => {
                                            const currentQuestion = questions[currentQuestionIndex];
                                            if (!currentQuestion) return null;
                                            return (
                                                <QuestionComponent
                                                    key={`modal-q-${currentQuestion.id}`}
                                                    questionId={currentQuestion.id}
                                                    text={currentQuestion.text}
                                                    options={currentQuestion.options}
                                                    correctAnswerIndex={
                                                        typeof currentQuestion.correctAnswer === 'number'
                                                            ? currentQuestion.correctAnswer
                                                            : currentQuestion.options.indexOf(currentQuestion.correctAnswer as string)
                                                    }
                                                    onWrongOptionHover={behavior.recordWrongOptionHover}
                                                    onNext={() => {
                                                        if (currentQuestionIndex < questions.length - 1) {
                                                            setCurrentQuestionIndex((p) => p + 1);
                                                            setShowNextButton(false);
                                                        } else {
                                                            handleQuizCompletion();
                                                        }
                                                    }}
                                                    onAnswer={async (selected) => {
                                                        const bData = behavior.getBehaviorData();
                                                        behavior.recordAttempt();
                                                        // Handle both index (number) and string format answers
                                                        const selectedIdx = currentQuestion.options.indexOf(selected);
                                                        const isCorrect = typeof currentQuestion.correctAnswer === 'number'
                                                            ? selectedIdx === currentQuestion.correctAnswer
                                                            : selected === currentQuestion.correctAnswer;

                                                        // Get correct answer text for display
                                                        const correctText = typeof currentQuestion.correctAnswer === 'number'
                                                            ? currentQuestion.options[currentQuestion.correctAnswer]
                                                            : currentQuestion.correctAnswer;

                                                        // Feed the struggle detector. After a few answers we
                                                        // can show a recommended intervention if patterns warrant it.
                                                        struggleTrackerRef.current.add({
                                                            type: "answer_submitted",
                                                            correct: Boolean(isCorrect),
                                                            timeSpent: Math.round(bData.time_on_question_ms / 1000),
                                                            attemptNumber: bData.attempts,
                                                            conceptKey: currentQuestion.id,
                                                        });
                                                        struggleTrackerRef.current.add({
                                                            type: "interaction_completed",
                                                            timeSpent: Math.round(bData.time_on_question_ms / 1000),
                                                        });

                                                        // Check for struggle indicators
                                                        const isStruggle = !isCorrect ||
                                                            bData.wrong_option_hover_count > 2 ||
                                                            (bData.hesitation_ms > 8000); // >8s hesitation

                                                        if (isStruggle) {
                                                            let reason = "Incorrect Answer";
                                                            if (bData.wrong_option_hover_count > 2) reason = "Uncertainty detected";
                                                            else if (bData.hesitation_ms > 8000) reason = "High hesitation";

                                                            setStruggledQuestions(prev => {
                                                                // Avoid duplicates
                                                                if (prev.some(p => p.id === currentQuestion.id)) return prev;
                                                                return [...prev, {
                                                                    id: currentQuestion.id,
                                                                    text: currentQuestion.text,
                                                                    reason,
                                                                    userSelected: selected,
                                                                    correctAnswer: correctText as string,
                                                                    isCorrect: isCorrect
                                                                }];
                                                            });

                                                            // Run the rule-based detector — surface its recommended
                                                            // intervention through the existing adaptation toast.
                                                            const result = struggleTrackerRef.current.analyze({
                                                                accuracy: Math.round((score / Math.max(1, currentQuestionIndex + 1)) * 100),
                                                                currentDifficulty: Number(difficultyLevel) || 3,
                                                                incorrectStreak: bData.wrong_option_hover_count > 2 ? 2 : 0,
                                                            });
                                                            if (result.isStruggling && result.recommendedIntervention) {
                                                                console.info(
                                                                    "[StruggleDetector]",
                                                                    result.overallSeverity,
                                                                    result.recommendedIntervention.message,
                                                                );
                                                            }
                                                        }

                                                        if (isCorrect) setScore(s => s + 1);

                                                        setShowNextButton(true);
                                                        // Backend /answers/submit already runs the
                                                        // confusion + bandit pipeline, so we don't
                                                        // need a redundant /behavior call right after.

                                                        // Call Backend for Feedback
                                                        try {
                                                            const response = await apiFetch<{
                                                                correct: boolean;
                                                                feedback_message: string;
                                                            }>('/answers/submit', {
                                                                method: 'POST',
                                                                body: JSON.stringify({
                                                                    user_id: behavior.getBehaviorData().user_id,
                                                                    question_id: currentQuestion.id,
                                                                    answer: selectedIdx, // Sending index
                                                                    time_taken_ms: behavior.getBehaviorData().time_on_question_ms,
                                                                    attempts: behavior.getBehaviorData().attempts
                                                                })
                                                            });

                                                            return {
                                                                correct: isCorrect, // Use local check for immediate consistency or use response.correct
                                                                feedback: response.feedback_message
                                                            };
                                                        } catch (err) {
                                                            console.error("Failed to submit answer:", err);
                                                            return isCorrect; // Fallback to boolean
                                                        }
                                                    }} />
                                            );
                                        })()}

                                        {showNextButton && (
                                            <div className="mt-8 flex justify-center animate-in fade-in slide-in-from-bottom-2">
                                                <span className="text-sm text-slate-400 font-medium animate-pulse">Press the right arrow to continue</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Arrow */}
                                    <button
                                        onClick={() => {
                                            if (currentQuestionIndex < questions.length - 1) {
                                                setCurrentQuestionIndex(prev => prev + 1);
                                                setShowNextButton(false);
                                            } else {
                                                handleQuizCompletion();
                                            }
                                        }}
                                        className={`p-3 rounded-full transition-all duration-200 flex-shrink-0 bg-slate-100/50 hover:bg-slate-100 text-slate-900 hover:scale-105 active:scale-95`}
                                    >
                                        <ChevronRight size={32} strokeWidth={2} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog >




        </TooltipProvider >
    );
}
