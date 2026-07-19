import { useState, useEffect, useRef, useCallback } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';

interface DuckDBState {
  db: duckdb.AsyncDuckDB | null;
  conn: duckdb.AsyncDuckDBConnection | null;
  loading: boolean;
  error: string | null;
}

const PARQUET_FILES = [
  'budget_detail.parquet',
  'agg_department.parquet',
  'agg_expense.parquet',
  'agg_agency.parquet',
];

export function useDuckDB() {
  const [state, setState] = useState<DuckDBState>({
    db: null,
    conn: null,
    loading: true,
    error: null,
  });
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        // Select bundle based on browser capabilities
        const DUCKDB_BUNDLES = await duckdb.selectBundle({
          mvp: {
            mainModule: new URL('@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm', import.meta.url).href,
            mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js', import.meta.url).href,
          },
          eh: {
            mainModule: new URL('@duckdb/duckdb-wasm/dist/duckdb-eh.wasm', import.meta.url).href,
            mainWorker: new URL('@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js', import.meta.url).href,
          },
        });

        const worker = new Worker(DUCKDB_BUNDLES.mainWorker!);
        const logger = new duckdb.ConsoleLogger();
        const db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(DUCKDB_BUNDLES.mainModule);

        // Register parquet files
        for (const file of PARQUET_FILES) {
          const response = await fetch(`/data/${file}`);
          const buffer = await response.arrayBuffer();
          await db.registerFileBuffer(file, new Uint8Array(buffer));
        }

        const conn = await db.connect();

        setState({ db, conn, loading: false, error: null });
      } catch (err) {
        setState({ db: null, conn: null, loading: false, error: String(err) });
      }
    }

    init();
  }, []);

  const query = useCallback(
    async <T = Record<string, unknown>>(sql: string): Promise<T[]> => {
      if (!state.conn) throw new Error('DuckDB not initialized');
      const result = await state.conn.query(sql);
      return result.toArray().map((row) => row.toJSON() as T);
    },
    [state.conn]
  );

  return { ...state, query };
}
