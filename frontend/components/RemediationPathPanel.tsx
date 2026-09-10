"use client";

import React from "react";
import Link from "next/link";
import {
    GitBranch,
    AlertTriangle,
    BookOpenCheck,
    Sparkles,
    ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    findRemediationPath,
    findChallengePath,
    humaniseSubtopicId,
    type RemediationPath,
    type ChallengePath,
    type PathStep,
} from "@/lib/adaptive/pathBranching";

interface RemediationPathPanelProps {
    /** Subtopic the user is currently working on / struggling with. */
    subtopicId: string;
    /** Mastery snapshot keyed by subtopic id, range 0..1. */
    masteryBySubtopic: Record<string, number>;
    /** Set of completed subtopic ids. */
    completed: Set<string>;
    /** Pre-computed remediation path (optional — overrides internal calc). */
    path?: RemediationPath;
    /** Show the challenge / unlock panel below remediation. */
    showChallenge?: boolean;
    className?: string;
    onNavigate?: (subtopicId: string) => void;
}

/**
 * Single React component that renders both:
 *   • the *remediation* path (revisit prereqs you're weak on)
 *   • optionally, the *challenge* path (next competencies unlocked)
 *
 * Both lists deep-link into /study?subtopic=… so the learner can pivot
 * with one click.  If `onNavigate` is provided we call it before the
 * link runs (used by CoursePlayer to record an analytics breadcrumb).
 */
export function RemediationPathPanel({
    subtopicId,
    masteryBySubtopic,
    completed,
    path,
    showChallenge = true,
    className,
    onNavigate,
}: RemediationPathPanelProps) {
    const remediation = React.useMemo<RemediationPath>(
        () =>
            path ??
            findRemediationPath({
                subtopicId,
                masteryBySubtopic,
                completed,
            }),
        [path, subtopicId, masteryBySubtopic, completed],
    );

    const challenge = React.useMemo<ChallengePath | null>(
        () =>
            showChallenge
                ? findChallengePath(masteryBySubtopic, completed)
                : null,
        [showChallenge, masteryBySubtopic, completed],
    );

    if (remediation.steps.length === 0 && (!challenge || challenge.suggestedNext.length === 0)) {
        return null;
    }

    const isHard = remediation.action === "branch";

    return (
        <div className={cn("space-y-4", className)}>
            {remediation.steps.length > 0 && (
                <div
                    className={cn(
                        "rounded-2xl border p-5 shadow-sm",
                        isHard
                            ? "border-amber-200 bg-amber-50"
                            : "border-blue-200 bg-blue-50",
                    )}
                >
                    <div className="flex items-start gap-3 mb-3">
                        <div
                            className={cn(
                                "p-2 rounded-xl",
                                isHard ? "bg-amber-100" : "bg-blue-100",
                            )}
                        >
                            {isHard ? (
                                <AlertTriangle
                                    size={18}
                                    className="text-amber-700"
                                />
                            ) : (
                                <GitBranch size={18} className="text-blue-700" />
                            )}
                        </div>
                        <div>
                            <h3
                                className={cn(
                                    "text-sm font-bold uppercase tracking-wider",
                                    isHard ? "text-amber-800" : "text-blue-800",
                                )}
                            >
                                Adaptive Remediation Path
                            </h3>
                            <p
                                className={cn(
                                    "text-sm mt-1",
                                    isHard ? "text-amber-900" : "text-blue-900",
                                )}
                            >
                                {remediation.summary}
                            </p>
                        </div>
                    </div>
                    <ul className="space-y-2">
                        {remediation.steps.map((step, i) => (
                            <PathStepRow
                                key={`${step.subtopicId}-${i}`}
                                step={step}
                                index={i}
                                onNavigate={onNavigate}
                                tone={isHard ? "amber" : "blue"}
                            />
                        ))}
                    </ul>
                </div>
            )}

            {challenge && challenge.suggestedNext.length > 0 && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                    <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-emerald-100">
                            <Sparkles size={18} className="text-emerald-700" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-800">
                                Unlocked & Ready
                            </h3>
                            <p className="text-sm mt-1 text-emerald-900">
                                {challenge.summary}
                            </p>
                        </div>
                    </div>
                    <ul className="space-y-2">
                        {challenge.suggestedNext.map((step, i) => (
                            <PathStepRow
                                key={`${step.subtopicId}-${i}`}
                                step={step}
                                index={i}
                                onNavigate={onNavigate}
                                tone="emerald"
                                showCompetencyOnly
                            />
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function PathStepRow({
    step,
    index,
    onNavigate,
    tone,
    showCompetencyOnly = false,
}: {
    step: PathStep;
    index: number;
    onNavigate?: (subtopicId: string) => void;
    tone: "amber" | "blue" | "emerald";
    showCompetencyOnly?: boolean;
}) {
    const palette =
        tone === "amber"
            ? {
                  text: "text-amber-900",
                  badge: "bg-amber-100 text-amber-800",
                  hover: "hover:bg-amber-100/70",
              }
            : tone === "blue"
              ? {
                    text: "text-blue-900",
                    badge: "bg-blue-100 text-blue-800",
                    hover: "hover:bg-blue-100/70",
                }
              : {
                    text: "text-emerald-900",
                    badge: "bg-emerald-100 text-emerald-800",
                    hover: "hover:bg-emerald-100/70",
                };

    const masteryPct = Math.round(step.mastery * 100);

    return (
        <li>
            <Link
                href={`/study?subtopic=${step.subtopicId}`}
                onClick={() => onNavigate?.(step.subtopicId)}
                className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-xl transition",
                    palette.hover,
                )}
            >
                <span
                    className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                        palette.badge,
                    )}
                >
                    {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-semibold truncate", palette.text)}>
                        {showCompetencyOnly
                            ? step.competencyTitle
                            : humaniseSubtopicId(step.subtopicId)}
                    </div>
                    {!showCompetencyOnly && (
                        <div className={cn("text-xs opacity-80", palette.text)}>
                            in <em>{step.competencyTitle}</em> · mastery {masteryPct}%
                        </div>
                    )}
                    <div className={cn("text-xs italic mt-0.5 opacity-75", palette.text)}>
                        {step.reason}
                    </div>
                </div>
                <ArrowRight size={16} className={palette.text} />
            </Link>
        </li>
    );
}

interface QuickRemediationToastProps {
    path: RemediationPath;
    className?: string;
}

/**
 * Minimal pill version for inline use (toast / sidebar).
 */
export function QuickRemediationToast({ path, className }: QuickRemediationToastProps) {
    if (path.steps.length === 0) return null;
    const first = path.steps[0]!;
    return (
        <div
            className={cn(
                "flex items-center gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm",
                className,
            )}
        >
            <BookOpenCheck size={18} className="text-amber-700 flex-shrink-0" />
            <div className="flex-1">
                <div className="font-semibold text-amber-900">{path.summary}</div>
                <div className="text-xs text-amber-800 opacity-90">
                    Start with: {humaniseSubtopicId(first.subtopicId)}
                </div>
            </div>
            <Link
                href={`/study?subtopic=${first.subtopicId}`}
                className="text-xs font-semibold text-amber-900 underline-offset-2 hover:underline"
            >
                Open
            </Link>
        </div>
    );
}
