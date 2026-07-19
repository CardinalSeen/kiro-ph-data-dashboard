# Product Requirements Document — PH Budget Data Dashboard

## Overview

A two-part system that ingests Philippine government budget data (FY2026 GAA Excel file), transforms it into an optimized format, and presents it through an interactive browser-based dashboard.

## Goals

1. Make Philippine national budget data explorable and understandable by non-technical users.
2. Enable fast, client-side querying of budget data without a backend server at runtime.
3. Maintain a clean separation between data preparation (pipeline) and data presentation (dashboard).

## Architecture

Refer to `.kiro/steering/stack.md` for full stack conventions. Summary:

- **Pipeline (Node.js + DuckDB):** Reads `FY2026_GAA.xlsx`, cleans/transforms data, exports `.parquet` files.
- **Dashboard (Vite + React/TS + DuckDB-WASM):** Loads `.parquet` files at runtime, queries them in-browser, renders charts and tables.
- **Hand-off format:** Apache Parquet — the pipeline writes it, the dashboard reads it.

## Data Pipeline Requirements

| # | Requirement |
|---|-------------|
| P1 | Ingest `FY2026_GAA.xlsx` from project root |
| P2 | Parse all relevant sheets/tabs (department allocations, program breakdowns) |
| P3 | Clean column names (snake_case, no special characters) |
| P4 | Normalize monetary values to a consistent unit (PHP thousands or millions — document choice) |
| P5 | Export one or more `.parquet` files to `pipeline/output/` |
| P6 | Provide an `npm start` script that runs the full pipeline end-to-end |
| P7 | Log progress and row counts to stdout |

## Dashboard Requirements

| # | Requirement |
|---|-------------|
| D1 | Load `.parquet` files from `public/data/` (copied from pipeline output) |
| D2 | Initialize DuckDB-WASM and register parquet files on app start |
| D3 | Display a summary view: total budget, number of departments, top allocations |
| D4 | Bar chart of budget by department (Chart.js) |
| D5 | Searchable/filterable table of all line items |
| D6 | Responsive layout that works on desktop and tablet |
| D7 | Loading and error states for data initialization |

## Workflow

1. Run `npm start` in `pipeline/` → produces `pipeline/output/*.parquet`
2. Copy parquet files to `dashboard/public/data/`
3. Run `npm run dev` in `dashboard/` → serves the interactive dashboard

## Non-Goals (for now)

- Real-time data updates or live API connections
- User authentication or multi-tenancy
- Server-side rendering
- Historical year comparisons (future enhancement)

## Conventions

All implementation must follow the stack and conventions defined in `.kiro/steering/stack.md`. Key points:

- Parquet is the only data exchange format between pipeline and dashboard.
- Pipeline code lives in `pipeline/src/`, exposed via npm scripts.
- Dashboard follows standard Vite/React-TS structure.
- Prefer explicit TypeScript types over `any`.
- Keep dependencies minimal.
