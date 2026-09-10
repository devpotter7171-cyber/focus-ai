/**
 * Competency Graph data model.
 *
 * Inspired by Artemis' atlas competency-graph (Repos/Artemis/.../atlas/manage/competency-graph),
 * trimmed down for our ~26-subtopic DBMS curriculum.
 *
 * Each competency groups related subtopics and declares the competencies that
 * should be learned first ("prerequisites"). The graph is a DAG so it can be
 * laid out in layers (Sugiyama-style) with no extra layout library.
 */

export interface Competency {
    id: string;
    title: string;
    description: string;
    subtopicIds: string[];      // matches `id` field in seed/dbms_subtopics.json
    prerequisites: string[];    // competency ids
    /** Suggested unit anchor (purely cosmetic). */
    unitId?: string;
}

/**
 * The DBMS competency map.  Mirrors the conceptual flow of the seeded
 * curriculum: foundations → ER → relational → algebra/normalization →
 * SQL → transactions/concurrency → NoSQL/storage → warehousing.
 */
export const DBMS_COMPETENCIES: Competency[] = [
    {
        id: "c_database_basics",
        title: "Database Foundations",
        description:
            "Why we need DBMS, three-schema architecture, data abstraction, and core terminology.",
        subtopicIds: ["intro-to-database-systems", "data-models-schemas"],
        prerequisites: [],
        unitId: "u1",
    },
    {
        id: "c_er_modeling",
        title: "ER Modeling",
        description:
            "Entities, attributes, relationships, cardinality, weak entities, and ER refinement.",
        subtopicIds: [
            "er-model-concepts",
            "relationships-constraints",
            "refining-er-design",
        ],
        prerequisites: ["c_database_basics"],
        unitId: "u1",
    },
    {
        id: "c_relational_model",
        title: "Relational Model",
        description:
            "Tuples, relations, keys, integrity constraints, and DML update semantics.",
        subtopicIds: ["relational-model-concepts", "update-operations"],
        prerequisites: ["c_er_modeling"],
        unitId: "u2",
    },
    {
        id: "c_relational_algebra",
        title: "Relational Algebra",
        description:
            "Unary and binary algebra operators, set theory, and translating queries to algebra.",
        subtopicIds: [
            "unary-relational-operations",
            "relational-algebra-set-theory",
            "binary-relational-operations",
            "relational-algebra-queries",
        ],
        prerequisites: ["c_relational_model"],
        unitId: "u2",
    },
    {
        id: "c_sql_fundamentals",
        title: "SQL Fundamentals",
        description:
            "DDL/DML, SELECT queries, joins, aggregation, and INSERT/UPDATE/DELETE.",
        subtopicIds: ["introduction-to-sql", "dml-operations"],
        prerequisites: ["c_relational_algebra"],
        unitId: "u3",
    },
    {
        id: "c_normalization",
        title: "Normalization",
        description:
            "Functional dependencies, 1NF–BCNF, decomposition, and lossless joins.",
        subtopicIds: [
            "functional-dependencies",
            "normal-forms-1nf-3nf",
            "bcnf-decompositions",
        ],
        prerequisites: ["c_relational_model"],
        unitId: "u3",
    },
    {
        id: "c_transactions",
        title: "Transactions",
        description:
            "ACID properties, transaction states, schedules, and serializability tests.",
        subtopicIds: [
            "transaction-concepts",
            "schedules-serializability",
            "testing-serializability",
        ],
        prerequisites: ["c_sql_fundamentals"],
        unitId: "u4",
    },
    {
        id: "c_concurrency",
        title: "Concurrency Control",
        description:
            "Two-phase locking, timestamp ordering, and deadlock handling.",
        subtopicIds: ["concurrency-control"],
        prerequisites: ["c_transactions"],
        unitId: "u4",
    },
    {
        id: "c_nosql_basics",
        title: "NoSQL & Distribution",
        description:
            "Document, column, KV, graph stores, and distribution models.",
        subtopicIds: [
            "introduction-to-nosql",
            "distribution-models",
            "big-data-architectures",
        ],
        prerequisites: ["c_relational_model"],
        unitId: "u5",
    },
    {
        id: "c_indexing_storage",
        title: "Indexing & Optimization",
        description:
            "B-trees, hash indexes, query plans, and cost-based optimization.",
        subtopicIds: ["indexing", "query-optimization"],
        prerequisites: ["c_sql_fundamentals"],
        unitId: "u6",
    },
    {
        id: "c_data_warehousing",
        title: "Data Warehousing",
        description:
            "Star/snowflake schemas, OLAP cubes, and ETL patterns.",
        subtopicIds: ["data-warehousing"],
        prerequisites: ["c_indexing_storage", "c_nosql_basics"],
        unitId: "u6",
    },
];

/**
 * Compute the layer ("depth") of every competency: 0 if it has no
 * prerequisites, otherwise 1 + max(layer of any prereq).
 *
 * Returns a map id → depth and validates that the graph is acyclic.
 */
export function computeLayers(
    comps: Competency[] = DBMS_COMPETENCIES,
): Record<string, number> {
    const byId = new Map(comps.map((c) => [c.id, c]));
    const memo = new Map<string, number>();
    const visiting = new Set<string>();

    function visit(id: string): number {
        if (memo.has(id)) return memo.get(id)!;
        if (visiting.has(id)) {
            // Cycle — fall back to 0 so the UI still renders.
            console.warn(`competencies: cycle detected at ${id}`);
            return 0;
        }
        const node = byId.get(id);
        if (!node) return 0;
        visiting.add(id);
        const depth =
            node.prerequisites.length === 0
                ? 0
                : Math.max(...node.prerequisites.map(visit)) + 1;
        visiting.delete(id);
        memo.set(id, depth);
        return depth;
    }

    for (const c of comps) visit(c.id);
    return Object.fromEntries(memo);
}

/**
 * Build (x, y) positions in a clean layered DAG layout.  Each layer is a
 * column; nodes within a layer are stacked vertically and centred.
 */
export function layoutGraph(
    comps: Competency[] = DBMS_COMPETENCIES,
    nodeWidth = 220,
    nodeHeight = 90,
    layerGap = 120,
    rowGap = 40,
): {
    positions: Record<string, { x: number; y: number }>;
    width: number;
    height: number;
} {
    const layers = computeLayers(comps);
    const byLayer: Record<number, Competency[]> = {};
    for (const c of comps) {
        const l = layers[c.id] ?? 0;
        (byLayer[l] ||= []).push(c);
    }
    const maxLayer = Math.max(...Object.keys(byLayer).map(Number));
    const maxRows = Math.max(...Object.values(byLayer).map((r) => r.length));

    const positions: Record<string, { x: number; y: number }> = {};
    for (let l = 0; l <= maxLayer; l++) {
        const row = byLayer[l] ?? [];
        // Stable order: sort by title for deterministic layout.
        row.sort((a, b) => a.title.localeCompare(b.title));
        const totalHeight = row.length * nodeHeight + (row.length - 1) * rowGap;
        const startY = ((maxRows * (nodeHeight + rowGap)) - totalHeight) / 2;
        row.forEach((c, idx) => {
            positions[c.id] = {
                x: l * (nodeWidth + layerGap),
                y: startY + idx * (nodeHeight + rowGap),
            };
        });
    }

    const width = (maxLayer + 1) * (nodeWidth + layerGap);
    const height = maxRows * (nodeHeight + rowGap) + 40;
    return { positions, width, height };
}

/** Compute the per-competency completion ratio (0..1) given a set of
 * completed subtopic ids. */
export function computeCompletion(
    comp: Competency,
    completedSubtopics: Set<string>,
): number {
    if (comp.subtopicIds.length === 0) return 0;
    const done = comp.subtopicIds.filter((id) => completedSubtopics.has(id))
        .length;
    return done / comp.subtopicIds.length;
}

/** Return all competencies that contain a given subtopic. Useful for badge UIs. */
export function competenciesForSubtopic(
    subtopicId: string,
    comps: Competency[] = DBMS_COMPETENCIES,
): Competency[] {
    return comps.filter((c) => c.subtopicIds.includes(subtopicId));
}

/**
 * Map a competency completion ratio to a colour gradient. Mirrors the BKT
 * thresholds the rest of the app uses (struggling < 0.4, learning 0.4–0.7,
 * mastered > 0.7).
 */
export function competencyColor(progress: number): {
    bg: string;
    border: string;
    text: string;
    label: "Locked" | "Struggling" | "Learning" | "Mastered";
} {
    if (progress >= 0.7) {
        return {
            bg: "#dcfce7", // green-100
            border: "#16a34a", // green-600
            text: "#166534",
            label: "Mastered",
        };
    }
    if (progress >= 0.4) {
        return {
            bg: "#fef9c3", // yellow-100
            border: "#eab308", // yellow-500
            text: "#854d0e",
            label: "Learning",
        };
    }
    if (progress > 0) {
        return {
            bg: "#fee2e2", // red-100
            border: "#ef4444", // red-500
            text: "#991b1b",
            label: "Struggling",
        };
    }
    return {
        bg: "#f1f5f9", // slate-100
        border: "#cbd5e1", // slate-300
        text: "#475569",
        label: "Locked",
    };
}
