/**
 * Real-Time Struggle Detector
 *
 * Lightweight, rule-based companion to our XGBoost confusion model.
 * XGBoost answers "is the user confused?" (binary, ML).
 * This module answers "what kind of struggle, with what confidence,
 * and what should we suggest?" (typed, explainable).
 *
 * Adapted from LearnFlow-AI/src/lib/adaptive/struggle-detection.ts.
 */

export type StruggleType =
    | "time_on_task"
    | "repeated_errors"
    | "help_seeking"
    | "engagement_drop"
    | "difficulty_mismatch";

export type Severity = "low" | "medium" | "high";

export interface StruggleIndicator {
    type: StruggleType;
    severity: Severity;
    /** 0–1. Higher = more sure. */
    confidence: number;
    description: string;
    suggestedAction: string;
    dataPoints: Record<string, number | string>;
}

export type InteractionEventType =
    | "answer_submitted"
    | "hint_requested"
    | "content_viewed"
    | "interaction_started"
    | "interaction_completed";

export interface InteractionEvent {
    timestamp: number; // epoch ms
    type: InteractionEventType;
    correct?: boolean;
    timeSpent?: number; // seconds
    attemptNumber?: number;
    conceptKey?: string;
}

export interface StruggleDetectionInput {
    events: InteractionEvent[];
    /** Recent metrics from BKT / quiz history, all optional. */
    metrics?: {
        accuracy?: number;
        recentTrend?: "improving" | "stable" | "declining";
        currentDifficulty?: number;
        incorrectStreak?: number;
    };
    /** Expected per-question time in seconds (default 60). */
    expectedTimePerInteraction?: number;
}

export interface StruggleDetectionResult {
    isStruggling: boolean;
    indicators: StruggleIndicator[];
    overallSeverity: "none" | Severity;
    recommendedIntervention?: {
        type: "hint" | "simplify" | "scaffolding" | "break" | "review" | "tutor";
        message: string;
        action?: string;
    };
}

export function detectStruggle(input: StruggleDetectionInput): StruggleDetectionResult {
    const { events, metrics = {}, expectedTimePerInteraction = 60 } = input;

    const indicators: StruggleIndicator[] = [];

    const t = checkTimeOnTask(events, expectedTimePerInteraction);
    if (t) indicators.push(t);

    const r = checkRepeatedErrors(events);
    if (r) indicators.push(r);

    const h = checkHelpSeeking(events);
    if (h) indicators.push(h);

    const e = checkEngagementDrop(events, metrics);
    if (e) indicators.push(e);

    const d = checkDifficultyMismatch(metrics);
    if (d) indicators.push(d);

    const overallSeverity = aggregateSeverity(indicators);
    const isStruggling = overallSeverity !== "none";

    return {
        isStruggling,
        indicators,
        overallSeverity,
        recommendedIntervention: isStruggling
            ? buildIntervention(indicators)
            : undefined,
    };
}

// ─── Indicator checks ────────────────────────────────────────────────────────

function checkTimeOnTask(
    events: InteractionEvent[],
    expectedTime: number,
): StruggleIndicator | null {
    const completed = events.filter(
        (e) => e.type === "interaction_completed" && e.timeSpent != null,
    );
    if (completed.length === 0) return null;

    const avg =
        completed.reduce((sum, e) => sum + (e.timeSpent || 0), 0) / completed.length;
    const ratio = avg / expectedTime;

    if (ratio > 2.5) {
        return {
            type: "time_on_task",
            severity: ratio > 4 ? "high" : "medium",
            confidence: Math.min(0.9, 0.5 + (ratio - 2.5) * 0.1),
            description: "Taking significantly longer than expected on questions.",
            suggestedAction: "Offer a simpler explanation or scaffolding.",
            dataPoints: {
                averageSeconds: Math.round(avg),
                expectedSeconds: expectedTime,
                ratio: ratio.toFixed(2),
            },
        };
    }

    if (ratio < 0.3) {
        const answers = events.filter((e) => e.type === "answer_submitted");
        const errors = answers.filter((a) => a.correct === false).length;
        const errorRate = answers.length ? errors / answers.length : 0;
        if (errorRate > 0.5) {
            return {
                type: "time_on_task",
                severity: "medium",
                confidence: 0.7,
                description: "Rushing through content with errors.",
                suggestedAction: "Encourage more careful reading.",
                dataPoints: {
                    averageSeconds: Math.round(avg),
                    expectedSeconds: expectedTime,
                    errorRatePct: Math.round(errorRate * 100),
                },
            };
        }
    }

    return null;
}

function checkRepeatedErrors(events: InteractionEvent[]): StruggleIndicator | null {
    const answers = events.filter((e) => e.type === "answer_submitted");
    if (answers.length < 3) return null;

    const recent = answers.slice(-5);
    const incorrectCount = recent.filter((a) => a.correct === false).length;
    let consecutive = 0;
    let max = 0;
    for (const a of recent) {
        if (a.correct === false) {
            consecutive++;
            max = Math.max(max, consecutive);
        } else {
            consecutive = 0;
        }
    }

    if (max >= 3 || incorrectCount >= 4) {
        return {
            type: "repeated_errors",
            severity: max >= 4 ? "high" : "medium",
            confidence: 0.85,
            description: `${max} consecutive incorrect answers.`,
            suggestedAction: "Provide a hint or review prerequisite concept.",
            dataPoints: {
                consecutiveErrors: max,
                recentErrorRatePct: Math.round((incorrectCount / recent.length) * 100),
            },
        };
    }
    return null;
}

function checkHelpSeeking(events: InteractionEvent[]): StruggleIndicator | null {
    const cutoff = Date.now() - 10 * 60 * 1000;
    const recent = events.filter((e) => e.timestamp > cutoff);
    const hints = recent.filter((e) => e.type === "hint_requested");
    const interactions = recent.filter(
        (e) => e.type === "interaction_started" || e.type === "interaction_completed",
    );
    if (interactions.length === 0) return null;
    const ratio = hints.length / Math.max(1, interactions.length / 2);

    if (ratio > 0.8 && hints.length >= 3) {
        return {
            type: "help_seeking",
            severity: ratio > 1.5 ? "high" : "medium",
            confidence: 0.75,
            description: "Requesting hints frequently.",
            suggestedAction: "Review foundational concepts or open the AI tutor.",
            dataPoints: {
                hintsRequested: hints.length,
                interactionsInWindow: Math.floor(interactions.length / 2),
                windowMinutes: 10,
            },
        };
    }
    return null;
}

function checkEngagementDrop(
    events: InteractionEvent[],
    metrics: StruggleDetectionInput["metrics"] = {},
): StruggleIndicator | null {
    if (events.length < 2) return null;
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

    let maxGap = 0;
    for (let i = 1; i < sorted.length; i++) {
        const gap = (sorted[i]!.timestamp - sorted[i - 1]!.timestamp) / 1000;
        if (gap > maxGap) maxGap = gap;
    }

    if (maxGap > 300) {
        return {
            type: "engagement_drop",
            severity: maxGap > 600 ? "high" : "medium",
            confidence: 0.6,
            description: "Extended pause detected during this session.",
            suggestedAction: "Suggest a short break.",
            dataPoints: { maxGapSeconds: Math.round(maxGap) },
        };
    }

    if (metrics.recentTrend === "declining") {
        return {
            type: "engagement_drop",
            severity: "low",
            confidence: 0.5,
            description: "Performance trending downward.",
            suggestedAction: "Offer encouragement and check understanding.",
            dataPoints: {
                trend: "declining",
                accuracyPct: Math.round(metrics.accuracy ?? 0),
            },
        };
    }
    return null;
}

function checkDifficultyMismatch(
    metrics: StruggleDetectionInput["metrics"] = {},
): StruggleIndicator | null {
    const accuracy = metrics.accuracy ?? 0;
    const difficulty = metrics.currentDifficulty ?? 3;
    const incorrectStreak = metrics.incorrectStreak ?? 0;

    // 1 = expert (hardest) on Focus-AI's scale, so "difficulty too high" means
    // a low number with low accuracy.
    if (difficulty <= 2 && accuracy < 50 && incorrectStreak >= 2) {
        return {
            type: "difficulty_mismatch",
            severity: "high",
            confidence: 0.8,
            description: "Content difficulty exceeds current skill level.",
            suggestedAction: "Switch to a friendlier explanation.",
            dataPoints: {
                difficultyLevel: difficulty,
                accuracyPct: accuracy,
                incorrectStreak,
            },
        };
    }
    if (difficulty <= 3 && accuracy < 40) {
        return {
            type: "difficulty_mismatch",
            severity: "medium",
            confidence: 0.7,
            description: "Struggling at the current difficulty.",
            suggestedAction: "Reduce difficulty temporarily.",
            dataPoints: {
                difficultyLevel: difficulty,
                accuracyPct: accuracy,
            },
        };
    }
    return null;
}

// ─── Aggregation + intervention ──────────────────────────────────────────────

function aggregateSeverity(indicators: StruggleIndicator[]): "none" | Severity {
    if (indicators.length === 0) return "none";
    const SEV: Record<Severity, number> = { low: 1, medium: 2, high: 3 };
    let weighted = 0;
    let totalW = 0;
    for (const i of indicators) {
        weighted += SEV[i.severity] * i.confidence;
        totalW += i.confidence;
    }
    if (totalW === 0) return "none";
    const avg = weighted / totalW;
    if (avg >= 2.5) return "high";
    if (avg >= 1.5) return "medium";
    return "low";
}

function buildIntervention(
    indicators: StruggleIndicator[],
): StruggleDetectionResult["recommendedIntervention"] {
    // Pick the highest-severity indicator
    const order: Severity[] = ["high", "medium", "low"];
    let primary: StruggleIndicator | undefined;
    for (const sev of order) {
        primary = indicators.find((i) => i.severity === sev);
        if (primary) break;
    }
    if (!primary) {
        return { type: "hint", message: "Need a hint? I can help." };
    }

    switch (primary.type) {
        case "repeated_errors":
            return primary.severity === "high"
                ? {
                      type: "review",
                      message: "Let's review the key concepts before continuing.",
                      action: "show_concept_review",
                  }
                : {
                      type: "hint",
                      message: "Want a hint to help you solve this?",
                      action: "show_hint",
                  };
        case "time_on_task":
            return primary.description.includes("Rushing")
                ? {
                      type: "scaffolding",
                      message: "Take your time — read the question carefully.",
                  }
                : {
                      type: "simplify",
                      message: "This concept is tricky. Want me to explain it differently?",
                      action: "show_simplified",
                  };
        case "help_seeking":
            return {
                type: "tutor",
                message: "Want to chat with the AI tutor about this topic?",
                action: "open_tutor_chat",
            };
        case "engagement_drop":
            return {
                type: "break",
                message: "You've been working hard! A short break may help.",
            };
        case "difficulty_mismatch":
            return {
                type: "simplify",
                message: "Let me show you an easier version first.",
                action: "reduce_difficulty",
            };
        default:
            return { type: "hint", message: "Need help? I'm here." };
    }
}

// ─── Sliding-window event tracker ────────────────────────────────────────────

/**
 * Holds the last N interaction events in memory for a single learner session.
 * Used to feed `detectStruggle` with a stable window of recent activity.
 */
export class StruggleTracker {
    private events: InteractionEvent[] = [];
    constructor(private readonly maxEvents = 50) {}

    add(event: Omit<InteractionEvent, "timestamp">): void {
        this.events.push({ ...event, timestamp: Date.now() });
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }
    }

    getEvents(): InteractionEvent[] {
        return [...this.events];
    }

    analyze(
        metrics?: StruggleDetectionInput["metrics"],
        expectedTimePerInteraction?: number,
    ): StruggleDetectionResult {
        return detectStruggle({
            events: this.events,
            metrics,
            expectedTimePerInteraction,
        });
    }

    clear(): void {
        this.events = [];
    }
}
