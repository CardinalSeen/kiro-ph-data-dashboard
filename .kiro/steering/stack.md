# Stack & Conventions

## Project Structure

```
pipeline/   – Node.js data pipeline
dashboard/  – Vite + React/TypeScript frontend
```

## Pipeline (`pipeline/`)

- **Runtime:** Node.js
- **Database:** DuckDB (native Node bindings via `duckdb` package)
- **Purpose:** Ingest raw data (Excel, CSV), transform, and export to Parquet files
- **Output format:** Apache Parquet (the hand-off format between pipeline and dashboard)

## Dashboard (`dashboard/`)

- **Framework:** React with TypeScript
- **Build tool:** Vite
- **Data layer:** DuckDB-WASM (query Parquet files directly in the browser)
- **Styling:** CSS Modules or plain CSS (no heavy UI framework unless added later)

## Conventions

- Parquet is the single hand-off format between the pipeline and the dashboard. The pipeline writes `.parquet` files; the dashboard reads them via DuckDB-WASM.
- Keep pipeline scripts in `pipeline/src/` and expose them through npm scripts in `pipeline/package.json`.
- Dashboard source lives in `dashboard/src/`. Follow the standard Vite/React-TS conventions (components in `src/components/`, hooks in `src/hooks/`, etc.).
- Use ESM (`"type": "module"`) in the pipeline when possible; the dashboard already uses ESM via Vite.
- Prefer explicit TypeScript types over `any`.
- Keep dependencies minimal — only add packages when clearly needed.
