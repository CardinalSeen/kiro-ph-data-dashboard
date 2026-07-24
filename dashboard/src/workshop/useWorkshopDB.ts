/**
 * ═══════════════════════════════════════════════════════════════════
 * WORKSHOP STEP 4.1 — DUCKDB-WASM INITIALIZATION & PARQUET LOADING
 * ═══════════════════════════════════════════════════════════════════
 *
 * This hook boots DuckDB entirely inside the browser (WebAssembly),
 * fetches the student's cleaned_dataset.parquet, and registers it in
 * DuckDB's in-memory virtual filesystem so it's queryable with plain SQL.
 *
 * Data Engineering Insight:
 * Because the query engine ships as WASM and runs on the client, there is
 * ZERO backend to provision, scale, or pay for — Vercel just serves a
 * static parquet file. Latency collapses to local memory speed because the
 * data never leaves the user's browser after the initial download.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';

interface WorkshopDBState {
  conn: duckdb.AsyncDuckDBConnection | null;
  ready: boolean;
  error: string | null;
}

// The student's cleaned file, served statically from /public/data
const DATASET = 'cleaned_dataset.parquet';

export function useWorkshopDB() {
  const [state, setState] = useState<WorkshopDBState>({ conn: null, ready: false, error: null });
  const initRef = useRef(false); // guard against React 18 double-invoke

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        // STEP 1: Pick the best WASM bundle for this browser (MVP vs EH).
        // Vite resolves these URLs at build time so they're bundled correctly.
        const bundles = await duckdb.selectBundle({
          mvp: {
            mainModule: new URL('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm', import.meta.url).href,
            mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js', import.meta.url).href,
          },
          eh: {
            mainModule: new URL('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm', import.meta.url).href,
            mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js', import.meta.url).href,
          },
        });

        // STEP 2: Spin up DuckDB in a Web Worker (keeps the UI thread free).
        const worker = new Worker(bundles.mainWorker!);
        const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(), worker);
        await db.instantiate(bundles.mainModule);

        // STEP 3: Fetch the parquet bytes and register them in DuckDB's
        // in-memory virtual filesystem. After this, 'cleaned_dataset.parquet'
        // is addressable in SQL exactly like a real file on disk.
        const res = await fetch(`/data/${DATASET}`);
        const buffer = new Uint8Array(await res.arrayBuffer());
        await db.registerFileBuffer(DATASET, buffer);

        // STEP 4: Open a connection — this is what we run SQL against.
        const conn = await db.connect();

        setState({ conn, ready: true, error: null });
      } catch (e) {
        setState({ conn: null, ready: false, error: String(e) });
      }
    }

    init();
  }, []);

  // Generic query helper: returns plain JS objects + measures latency.
  const query = useCallback(
    async <T = Record<string, unknown>>(sql: string): Promise<{ rows: T[]; ms: number }> => {
      if (!state.conn) throw new Error('DuckDB not ready');
      const start = performance.now(); // ← perf marker for Step 4.4
      const result = await state.conn.query(sql);
      const ms = performance.now() - start;
      const rows = result.toArray().map((r) => r.toJSON() as T);
      return { rows, ms };
    },
    [state.conn]
  );

  return { ...state, query };
}
