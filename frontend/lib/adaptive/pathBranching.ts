/**
 * Adaptive Path Branching (M2)
 *
 * When the rule-based struggle detector fires, we don't just nudge the
 * learner with a hint — we compute a *remediation path* through the
 * competency graph and suggest concrete prereq subtopics to revisit.
 *
 * Inspired by Artemis' atlas competency learning paths
 * (Repos/Artemis/.../atlas/manage/learning-path-management) and
 * LearnFlow-AI's adaptive path engine; trimmed to a pure-function module
 * that operates on our DBMS competency map + BKT mastery snapshot.
 *
 * No new dependencies. No side effects.
 */

import {
    DBMS_COMPETENCIES,
    type Competency,
    competenciesForSubtopic,
} from "@/lib/competencies";

export type PathReasonCode =
    | "weak_prereq"
    | "incomplete_prereq"
    | "weak_current"
    | "ready_to_advance"
    | "challenge_unlock";

export interface PathStep {
    subtopicId: string;
    competencyId: string;
    competencyTitle: string;
    /** 0..1 mastery snapshot. */
    mastery: number;
    completed: boolean;
    reasonCode: PathReasonCode;
    reason: string;
}

export interface RemediationPath {
    sourceSubtopicId: string;
    sourceCompetencyId: string | null;
    /** Ordered weakest-first; revisit these in order. */
    steps: PathStep[];
    /** Plain-English summary suitable for a toast or panel header. */
    summary: string;
    /** Severity bucket — "review" for soft nudges, "branch" for hard pivots. */
    action: "stay" | "review" | "branch";
}

export interface ChallengePath {
    /** Competencies the learner has mastered enough to unlock. */
    unlocked: Competency[];
    /** First-step subtopic to try in each unlocked competency. */
    suggestedNext: PathStep[];
    summary: string;
}

export interface PathInput {
    subtopicId: string;
    /** Mastery snapshot keyed by subtopic id, range 0..1. */
    masteryBySubtopic: Record<string, number>;
    /** Subtopic ids the user has completed. */
    completed: Set<string>;
    /** Optional override: how weak a prereq has to be before we surface it. */
    weakPrereqThreshold?: number;
    /** Optional override: how strong a competency has to be to unlock the next. */
    masteryUnlockThreshold?: number;
    competencies?: Competency[];
}

const DEFAULT_WEAK_THRESHOLD = 0.55;
const DEFAULT_UNLOCK_THRESHOLD = 0.7;

/**
 * Given the subtopic the learner is currently struggling with, return a
 * weakest-first list of prerequisite subtopics they should revisit before
 * trying again. Falls back to the current subtopic itself if no graph
 * structure can be applied.
 */
export function findRemediationPath(input: PathInput): RemediationPath {
    const {
        subtopicId,
        masteryBySubtopic,
        completed,
        weakPrereqThreshold = DEFAULT_WEAK_THRESHOLD,
        competencies = DBMS_COMPETENCIES,
    } = input;

    const owners = competenciesForSubtopic(subtopicId, competencies);
    const sourceCompetency = owners[0] ?? null;

    if (!sourceCompetency) {
        return {
            sourceSubtopicId: subtopicId,
            sourceCompetencyId: null,
            steps: [],
            summary:
                "No competency graph entry for this subtopic — try the AI tutor or request a hint.",
            action: "review",
        };
    }

    // Walk prerequisite competencies (BFS) and collect weak subtopics.
    const byId = new Map(competencies.map((c) => [c.id, c]));
    const visited = new Set<string>();
    const queue: string[] = [...sourceCompetency.prerequisites];
    const candidates: PathStep[] = [];

    while (queue.length > 0) {
        const compId = queue.shift()!;
        if (visited.has(compId)) continue;
        visited.add(compId);
        const comp = byId.get(compId);
        if (!comp) continue;

        for (const sid of comp.subtopicIds) {
            const m = masteryBySubtopic[sid] ?? 0;
            const done = completed.has(sid);
            // Surface subtopics that look weak. "Weak" here is either
            // explicit BKT below threshold OR not yet completed at all.
            if (!done) {
                candidates.push({
                    subtopicId: sid,
                    competencyId: comp.id,
                    competencyTitle: comp.title,
                    mastery: m,
                    completed: false,
                    reasonCode: "incomplete_prereq",
                    reason: `Prereq subtopic in "${comp.title}" not finished yet.`,
                });
            } else if (m < weakPrereqThreshold) {
                candidates.push({
                    subtopicId: sid,
                    competencyId: comp.id,
                    competencyTitle: comp.title,
                    mastery: m,
                    completed: true,
                    reasonCode: "weak_prereq",
                    reason: `Mastery for prereq "${comp.title}" is only ${Math.round(
                        m * 100,
                    )}%.`,
                });
            }
        }

        // Recurse one more level back; depth-2 is plenty for our 11-node graph.
        for (const pre of comp.prerequisites) queue.push(pre);
    }

    // Sort weakest first — incomplete trumps weak; lower mastery first.
    candidates.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return a.mastery - b.mastery;
    });

    // Cap to the 3 most actionable steps.
    const steps = candidates.slice(0, 3);

    // If no upstream weakness, the learner just needs review of the
    // current subtopic itself.
    if (steps.length === 0) {
        const m = masteryBySubtopic[subtopicId] ?? 0;
        return {
            sourceSubtopicId: subtopicId,
            sourceCompetencyId: sourceCompetency.id,
            steps: [
                {
                    subtopicId,
                    competencyId: sourceCompetency.id,
                    competencyTitle: sourceCompetency.title,
                    mastery: m,
                    completed: completed.has(subtopicId),
                    reasonCode: "weak_current",
                    reason: `Prereqs look solid — try a friendlier explanation of this subtopic.`,
                },
            ],
            summary: `Prereqs look solid. Try a simplified version of "${sourceCompetency.title}".`,
            action: "review",
        };
    }

    const action: RemediationPath["action"] = steps.some(
        (s) => s.reasonCode === "incomplete_prereq",
    )
        ? "branch"
        : "review";

    const summary =
        action === "branch"
            ? `Some prereqs in "${sourceCompetency.title}" aren't covered yet. Revisit ${steps.length} subtopic${
                  steps.length === 1 ? "" : "s"
              } first.`
            : `Mastery on a few prereqs of "${sourceCompetency.title}" is shaky. A short review will help.`;

    return {
        sourceSubtopicId: subtopicId,
        sourceCompetencyId: sourceCompetency.id,
        steps,
        summary,
        action,
    };
}

/**
 * Given the learner's overall mastery snapshot, surface the next
 * competencies they're cleared for and pick a starting subtopic in each.
 */
export function findChallengePath(
    masteryBySubtopic: Record<string, number>,
    completed: Set<string>,
    options: {
        unlockThreshold?: number;
        competencies?: Competency[];
        max?: number;
    } = {},
): ChallengePath {
    const {
        unlockThreshold = DEFAULT_UNLOCK_THRESHOLD,
        competencies = DBMS_COMPETENCIES,
        max = 3,
    } = options;

    const compMastery: Record<string, number> = {};
    for (const c of competencies) {
        const samples = c.subtopicIds.map((s) => masteryBySubtopic[s] ?? 0);
        compMastery[c.id] = samples.length
            ? samples.reduce((a, b) => a + b, 0) / samples.length
            : 0;
    }

    const ready = competencies.filter((c) => {
        const own = compMastery[c.id] ?? 0;
        if (own >= unlockThreshold) return false; // already mastered
        return c.prerequisites.every(
            (p) => (compMastery[p] ?? 0) >= unlockThreshold,
        );
    });

    // Sort by lowest current mastery — most "next-up" first.
    ready.sort((a, b) => (compMastery[a.id] ?? 0) - (compMastery[b.id] ?? 0));

    const suggestedNext: PathStep[] = ready.slice(0, max).map((c) => {
        // Pick the first uncompleted subtopic; otherwise the weakest.
        const next =
            c.subtopicIds.find((s) => !completed.has(s)) ??
            [...c.subtopicIds].sort(
                (a, b) =>
                    (masteryBySubtopic[a] ?? 0) - (masteryBySubtopic[b] ?? 0),
            )[0];
        return {
            subtopicId: next ?? c.subtopicIds[0]!,
            competencyId: c.id,
            competencyTitle: c.title,
            mastery: masteryBySubtopic[next ?? ""] ?? 0,
            completed: completed.has(next ?? ""),
            reasonCode: "challenge_unlock",
            reason: `Prereqs done — ready to start "${c.title}".`,
        };
    });

    const summary =
        suggestedNext.length === 0
            ? "No new competencies unlocked yet — keep building mastery on the current ones."
            : `${suggestedNext.length} competenc${
                  suggestedNext.length === 1 ? "y is" : "ies are"
              } unlocked and ready to start.`;

    return {
        unlocked: ready,
        suggestedNext,
        summary,
    };
}

/** Pretty-print a subtopic id like `relational-algebra-queries`. */
export function humaniseSubtopicId(id: string): string {
    return id
        .split(/[-_]/)
        .filter(Boolean)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");
}
