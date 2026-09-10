/**
 * Adaptive Difficulty Engine
 *
 * Pure-function rule engine that converts performance metrics into a
 * human-readable difficulty decision. Sits on top of the LinUCB bandit:
 *
 *   • Bandit picks WHICH content variant to deliver (visual/step/example/...)
 *   • This engine produces the WHY — a natural-language rationale plus
 *     a list of `AdaptiveRecommendation`s for the AdaptiveInsightsPanel.
 *
 * Adapted from LearnFlow-AI/src/lib/adaptive/difficulty.ts (MIT-spirit
 * permissive use), simplified for our 1–5 difficulty scale and BKT-derived
 * metrics.
 */

export type RecommendationType =
    | "speed_up"
    | "slow_down"
    | "simplify"
    | "extra_examples"
    | "review"
    | "challenge";

export interface AdaptiveRecommendation {
    type: RecommendationType;
    message: string;
}

export interface PerformanceMetrics {
    /** 0–100 accuracy across recent answers. */
    accuracy: number;
    /** Trend over the last 10 vs the previous 10 graded responses. */
    recentTrend: "improving" | "stable" | "declining";
    /** Current correct / incorrect streak counts. */
    streakData: { correct: number; incorrect: number };
    /** Total responses graded so far (used for confidence). */
    totalResponses: number;
}

export interface DifficultyDecision {
    /** Numeric adjustment in [-2, +2]. */
    adjustment: number;
    /** Resulting difficulty level (1–5; 1 = expert, 5 = friendly analogy). */
    newDifficulty: number;
    /** Plain-English explanation, ready to render in the insights panel. */
    reason: string;
    /** Actionable recommendations for the UI (toasts, sidebar nudges). */
    recommendations: AdaptiveRecommendation[];
}

export interface DifficultyRules {
    excellentThreshold: number;
    goodThreshold: number;
    strugglingThreshold: number;
    criticalThreshold: number;
    incorrectStreakThreshold: number;
    correctStreakThreshold: number;
    majorIncrease: number;
    minorIncrease: number;
    minorDecrease: number;
    majorDecrease: number;
}

const DEFAULT_RULES: DifficultyRules = {
    excellentThreshold: 90,
    goodThreshold: 70,
    strugglingThreshold: 70,
    criticalThreshold: 50,
    incorrectStreakThreshold: 3,
    correctStreakThreshold: 5,
    // Note Focus-AI uses a 1–5 scale where lower = harder, so a "decrease"
    // in difficulty (easier content) means moving toward 5.
    majorIncrease: -2, // toward harder (lower number)
    minorIncrease: -1,
    minorDecrease: +1, // toward easier (higher number)
    majorDecrease: +2,
};

export function calculateDifficultyAdjustment(
    metrics: PerformanceMetrics,
    currentDifficulty: number,
    rules: DifficultyRules = DEFAULT_RULES,
): DifficultyDecision {
    const recommendations: AdaptiveRecommendation[] = [];
    let adjustment = 0;
    let reason = "Steady progress — keeping the current pacing.";

    if (metrics.streakData.incorrect >= rules.incorrectStreakThreshold) {
        adjustment = rules.majorDecrease;
        reason = `${metrics.streakData.incorrect} incorrect answers in a row. Slowing down to help you build understanding.`;
        recommendations.push({
            type: "slow_down",
            message: "Let's take a step back and review the basics.",
        });
        recommendations.push({
            type: "review",
            message: "Consider re-reading the previous section before continuing.",
        });
    } else if (metrics.accuracy < rules.criticalThreshold) {
        adjustment = rules.majorDecrease;
        reason = `Accuracy at ${metrics.accuracy}%. Switching to simpler explanations and concrete examples.`;
        recommendations.push({
            type: "simplify",
            message: "Try a friendlier analogy version of this topic.",
        });
        recommendations.push({
            type: "extra_examples",
            message: "Here are extra worked examples for this concept.",
        });
    } else if (metrics.accuracy < rules.strugglingThreshold) {
        adjustment = rules.minorDecrease;
        reason = `Accuracy at ${metrics.accuracy}%. Adding a bit more support.`;
        recommendations.push({
            type: "extra_examples",
            message: "A few more examples should reinforce this.",
        });
    } else if (
        metrics.accuracy >= rules.excellentThreshold &&
        metrics.recentTrend === "improving"
    ) {
        adjustment = rules.majorIncrease;
        reason = `Excellent at ${metrics.accuracy}% with an improving trend. Ready for the expert version.`;
        recommendations.push({
            type: "challenge",
            message: "You've earned a more rigorous treatment of this topic.",
        });
        recommendations.push({
            type: "speed_up",
            message: "Want to skip ahead? You're ready for harder content.",
        });
    } else if (metrics.streakData.correct >= rules.correctStreakThreshold) {
        adjustment = rules.minorIncrease;
        reason = `${metrics.streakData.correct} in a row! Ratcheting up the difficulty.`;
        recommendations.push({
            type: "challenge",
            message: `Streak of ${metrics.streakData.correct} — let's try something harder.`,
        });
    } else if (
        metrics.accuracy >= rules.goodThreshold &&
        metrics.recentTrend === "declining"
    ) {
        adjustment = 0;
        reason = `Performance is good at ${metrics.accuracy}% but trending down. Holding the current level.`;
        recommendations.push({
            type: "review",
            message: "Recent answers have dipped — consider reviewing.",
        });
    } else if (metrics.accuracy >= rules.goodThreshold) {
        adjustment = 0;
        reason = `Steady progress at ${metrics.accuracy}%. Keep it up!`;
    }

    // Clamp 1..5 (Focus-AI scale)
    const newDifficulty = Math.max(1, Math.min(5, currentDifficulty + adjustment));
    const actualAdjustment = newDifficulty - currentDifficulty;

    return {
        adjustment: actualAdjustment,
        newDifficulty,
        reason,
        recommendations,
    };
}

/**
 * Build a `PerformanceMetrics` object from a list of recent quiz attempts.
 * Each attempt only needs `is_correct` (or `isCorrect`) and an optional
 * `time_taken_ms`; we tolerate either casing.
 */
export interface RawAttempt {
    is_correct?: boolean | number;
    isCorrect?: boolean;
    time_taken_ms?: number;
    timestamp?: string | number;
}

export function buildPerformanceMetrics(attempts: RawAttempt[]): PerformanceMetrics {
    const graded = attempts.filter(
        (a) => a.is_correct !== undefined || a.isCorrect !== undefined,
    );
    if (graded.length === 0) {
        return {
            accuracy: 0,
            recentTrend: "stable",
            streakData: { correct: 0, incorrect: 0 },
            totalResponses: 0,
        };
    }

    const isOk = (a: RawAttempt) => Boolean(a.isCorrect ?? a.is_correct);

    const correctCount = graded.filter(isOk).length;
    const accuracy = Math.round((correctCount / graded.length) * 100);

    // Trend
    let recentTrend: PerformanceMetrics["recentTrend"] = "stable";
    if (graded.length >= 5) {
        const last10 = graded.slice(-10);
        const prev10 = graded.slice(-20, -10);
        const recentAcc = last10.length
            ? (last10.filter(isOk).length / last10.length) * 100
            : 0;
        const prevAcc = prev10.length
            ? (prev10.filter(isOk).length / prev10.length) * 100
            : recentAcc;
        if (recentAcc > prevAcc + 10) recentTrend = "improving";
        else if (recentAcc < prevAcc - 10) recentTrend = "declining";
    }

    // Streaks (most-recent-first)
    const sorted = [...graded].reverse();
    let correctStreak = 0;
    let incorrectStreak = 0;
    if (sorted[0] && isOk(sorted[0])) {
        for (const a of sorted) {
            if (isOk(a)) correctStreak++;
            else break;
        }
    } else {
        for (const a of sorted) {
            if (!isOk(a)) incorrectStreak++;
            else break;
        }
    }

    return {
        accuracy,
        recentTrend,
        streakData: { correct: correctStreak, incorrect: incorrectStreak },
        totalResponses: graded.length,
    };
}
