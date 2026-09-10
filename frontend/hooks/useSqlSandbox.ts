"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser-side SQLite sandbox using sql.js (SQLite compiled to WASM).
 *
 * Why client-side?
 *   • Zero backend cost — every learner gets isolated execution.
 *   • Sub-millisecond run latency — no network roundtrip.
 *   • Auto-grading is a deterministic compare against a seed result set.
 *
 * Memory footprint per page: ~1.4 MB WASM downloaded once and cached by
 * the browser, ~few hundred KB of in-memory DB per active sandbox.
 */

// We re-export the row shape so consumers don't need to import sql.js types.
export interface SqlResult {
    columns: string[];
    rows: (string | number | null)[][];
}

interface SqlJsModule {
    Database: new (data?: Uint8Array) => SqlJsDb;
}

interface SqlJsDb {
    run(sql: string): void;
    exec(sql: string): { columns: string[]; values: (string | number | null)[][] }[];
    close(): void;
}

let _SQL: Promise<SqlJsModule> | null = null;

/** Lazy-load the sql.js WASM bundle once per page. */
function loadSqlJs(): Promise<SqlJsModule> {
    if (_SQL) return _SQL;
    _SQL = (async () => {
        // Dynamic import keeps the wasm out of the initial bundle.
        const initSqlJs = (await import("sql.js")).default;
        const SQL = await initSqlJs({
            // Serve the wasm from the CDN — saves us from copying it into /public.
            // sql.js v1.10+ ships a stable copy here. If you'd prefer offline,
            // copy node_modules/sql.js/dist/sql-wasm.wasm to /public/ and
            // change locateFile to () => "/sql-wasm.wasm".
            locateFile: (file: string) =>
                `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`,
        });
        return SQL as unknown as SqlJsModule;
    })();
    return _SQL;
}

interface UseSqlSandboxOptions {
    /** SQL DDL+DML to seed the database on creation (CREATE TABLE … INSERT …). */
    seed: string;
}

export interface SqlSandboxHandle {
    /** True when the WASM bundle and seed have finished loading. */
    ready: boolean;
    /** Last error from initialization or query execution. */
    error: string | null;
    /** True while a query is executing. */
    running: boolean;
    /** Last successful result. */
    result: SqlResult | null;
    /** Execute a SQL query and update `result`. Returns the result. */
    run: (sql: string) => Promise<SqlResult | null>;
    /** Reset the database back to the seed state. */
    reset: () => Promise<void>;
}

export function useSqlSandbox({ seed }: UseSqlSandboxOptions): SqlSandboxHandle {
    const dbRef = useRef<SqlJsDb | null>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [running, setRunning] = useState(false);
    const [result, setResult] = useState<SqlResult | null>(null);

    // Init + reset
    const init = useCallback(async () => {
        try {
            setError(null);
            const SQL = await loadSqlJs();
            if (dbRef.current) {
                try { dbRef.current.close(); } catch { /* ignore */ }
            }
            const db = new SQL.Database();
            if (seed && seed.trim()) {
                db.run(seed);
            }
            dbRef.current = db;
            setReady(true);
        } catch (err) {
            setError((err as Error).message);
            setReady(false);
        }
    }, [seed]);

    useEffect(() => {
        init();
        return () => {
            if (dbRef.current) {
                try { dbRef.current.close(); } catch { /* ignore */ }
                dbRef.current = null;
            }
        };
    }, [init]);

    const run = useCallback(async (sql: string): Promise<SqlResult | null> => {
        if (!dbRef.current) {
            setError("Sandbox not ready yet");
            return null;
        }
        setRunning(true);
        setError(null);
        try {
            const out = dbRef.current.exec(sql);
            // exec() returns one entry per statement that produced rows.
            // We surface the first; if a learner runs `INSERT … SELECT …`
            // they'll see the SELECT result, which is what they want.
            const first = out[out.length - 1];
            if (!first) {
                const empty: SqlResult = { columns: [], rows: [] };
                setResult(empty);
                return empty;
            }
            const r: SqlResult = { columns: first.columns, rows: first.values };
            setResult(r);
            return r;
        } catch (err) {
            setError((err as Error).message);
            setResult(null);
            return null;
        } finally {
            setRunning(false);
        }
    }, []);

    const reset = useCallback(async () => {
        await init();
        setResult(null);
    }, [init]);

    return { ready, error, running, result, run, reset };
}

/** Compare two `SqlResult`s for grading. Set semantics — column/row order
 *  doesn't matter. Useful for "does the learner's query return the same
 *  rows as the expected query?". */
export function resultsEqual(a: SqlResult, b: SqlResult): boolean {
    if (a.columns.length !== b.columns.length) return false;
    if (a.rows.length !== b.rows.length) return false;

    const norm = (r: SqlResult) => {
        const idx = r.columns.map((_, i) => i).sort((i, j) =>
            r.columns[i]!.localeCompare(r.columns[j]!),
        );
        const sortedCols = idx.map((i) => r.columns[i]);
        const sortedRows = r.rows
            .map((row) => idx.map((i) => row[i]))
            .map((row) => JSON.stringify(row))
            .sort();
        return { sortedCols, sortedRows };
    };

    const A = norm(a);
    const B = norm(b);
    if (A.sortedCols.join("|") !== B.sortedCols.join("|")) return false;
    for (let i = 0; i < A.sortedRows.length; i++) {
        if (A.sortedRows[i] !== B.sortedRows[i]) return false;
    }
    return true;
}
