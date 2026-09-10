"use client";

import React from "react";
import {
    DBMS_COMPETENCIES,
    type Competency,
    competencyColor,
    computeCompletion,
    layoutGraph,
} from "@/lib/competencies";
import { cn } from "@/lib/utils";

interface CompetencyGraphProps {
    /** Set of subtopic ids the user has completed. */
    completedSubtopics: Set<string>;
    /** Optional BKT mastery snapshot keyed by subtopic id (0..1). */
    masteryBySubtopic?: Record<string, number>;
    /** Click handler when a node is selected. */
    onSelect?: (comp: Competency) => void;
    className?: string;
}

/**
 * Pure-SVG layered DAG renderer for the competency graph.
 *
 * No external graph library is needed for our ~12-node curriculum;
 * we lay out columns by depth and draw cubic-bezier edges between
 * prerequisite arrows.
 */
export function CompetencyGraph({
    completedSubtopics,
    masteryBySubtopic,
    onSelect,
    className,
}: CompetencyGraphProps) {
    const comps = DBMS_COMPETENCIES;
    const NODE_W = 220;
    const NODE_H = 92;

    const { positions, width, height } = layoutGraph(comps, NODE_W, NODE_H);

    const [hoverId, setHoverId] = React.useState<string | null>(null);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);

    // Per-competency progress: prefer BKT mastery if provided, else completion ratio.
    const progressMap = React.useMemo(() => {
        const m: Record<string, number> = {};
        for (const c of comps) {
            if (masteryBySubtopic) {
                const samples = c.subtopicIds
                    .map((id) => masteryBySubtopic[id])
                    .filter((v): v is number => typeof v === "number");
                m[c.id] = samples.length
                    ? samples.reduce((a, b) => a + b, 0) / samples.length
                    : computeCompletion(c, completedSubtopics);
            } else {
                m[c.id] = computeCompletion(c, completedSubtopics);
            }
        }
        return m;
    }, [comps, completedSubtopics, masteryBySubtopic]);

    const isUnlocked = React.useCallback(
        (c: Competency) =>
            c.prerequisites.every((p) => (progressMap[p] ?? 0) >= 0.4),
        [progressMap],
    );

    return (
        <div
            className={cn(
                "w-full overflow-auto rounded-2xl border border-slate-200 bg-white p-4",
                className,
            )}
        >
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label="Competency graph"
                className="min-w-full"
            >
                <defs>
                    <marker
                        id="arrowhead"
                        markerWidth="10"
                        markerHeight="10"
                        refX="9"
                        refY="5"
                        orient="auto"
                        markerUnits="strokeWidth"
                    >
                        <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
                    </marker>
                </defs>

                {/* Edges */}
                {comps.flatMap((c) =>
                    c.prerequisites.map((preId) => {
                        const from = positions[preId];
                        const to = positions[c.id];
                        if (!from || !to) return null;
                        const x1 = from.x + NODE_W;
                        const y1 = from.y + NODE_H / 2;
                        const x2 = to.x;
                        const y2 = to.y + NODE_H / 2;
                        const mx = (x1 + x2) / 2;
                        const isActive =
                            hoverId === c.id || hoverId === preId ||
                            selectedId === c.id || selectedId === preId;
                        return (
                            <path
                                key={`${preId}->${c.id}`}
                                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                                fill="none"
                                stroke={isActive ? "#0f172a" : "#94a3b8"}
                                strokeWidth={isActive ? 2.5 : 1.5}
                                markerEnd="url(#arrowhead)"
                                opacity={isActive ? 1 : 0.65}
                            />
                        );
                    }),
                )}

                {/* Nodes */}
                {comps.map((c) => {
                    const pos = positions[c.id];
                    if (!pos) return null;
                    const progress = progressMap[c.id] ?? 0;
                    const colour = competencyColor(progress);
                    const unlocked = isUnlocked(c);
                    const isHover = hoverId === c.id;
                    const isSelected = selectedId === c.id;
                    return (
                        <g
                            key={c.id}
                            transform={`translate(${pos.x}, ${pos.y})`}
                            style={{ cursor: "pointer" }}
                            onMouseEnter={() => setHoverId(c.id)}
                            onMouseLeave={() => setHoverId(null)}
                            onClick={() => {
                                setSelectedId(c.id);
                                onSelect?.(c);
                            }}
                        >
                            <rect
                                x={0}
                                y={0}
                                width={NODE_W}
                                height={NODE_H}
                                rx={14}
                                ry={14}
                                fill={colour.bg}
                                stroke={isSelected ? "#0f172a" : colour.border}
                                strokeWidth={isSelected ? 3 : isHover ? 2.5 : 2}
                                opacity={unlocked ? 1 : 0.55}
                            />
                            <text
                                x={14}
                                y={26}
                                fontSize={14}
                                fontWeight={700}
                                fill={colour.text}
                            >
                                {c.title}
                            </text>
                            <text
                                x={14}
                                y={46}
                                fontSize={11}
                                fill={colour.text}
                                opacity={0.85}
                            >
                                {c.subtopicIds.length} subtopic
                                {c.subtopicIds.length === 1 ? "" : "s"}
                            </text>

                            {/* Progress bar */}
                            <rect
                                x={14}
                                y={60}
                                width={NODE_W - 28}
                                height={6}
                                rx={3}
                                fill="rgba(15,23,42,0.08)"
                            />
                            <rect
                                x={14}
                                y={60}
                                width={(NODE_W - 28) * Math.max(0, Math.min(1, progress))}
                                height={6}
                                rx={3}
                                fill={colour.border}
                            />
                            <text
                                x={NODE_W - 14}
                                y={82}
                                fontSize={10}
                                fontWeight={600}
                                fill={colour.text}
                                textAnchor="end"
                            >
                                {colour.label} · {Math.round(progress * 100)}%
                            </text>
                        </g>
                    );
                })}
            </svg>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
                <Legend swatch="#cbd5e1" label="Locked" />
                <Legend swatch="#ef4444" label="Struggling (<40%)" />
                <Legend swatch="#eab308" label="Learning (40–70%)" />
                <Legend swatch="#16a34a" label="Mastered (>70%)" />
            </div>
        </div>
    );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
    return (
        <div className="flex items-center gap-2 text-slate-600">
            <span
                className="inline-block h-3 w-3 rounded-sm border"
                style={{ background: swatch, borderColor: swatch }}
            />
            <span>{label}</span>
        </div>
    );
}
