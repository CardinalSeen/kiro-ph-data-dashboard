# 🇵🇭 Philippine FY2026 Budget Data Dashboard

An interactive, fully client-side analytics dashboard for exploring the **Philippine FY2026 General Appropriations Act (GAA)** — ₱4.08 Trillion across 37 departments and 522,159 budget line items.

Data is prepared once by a Node.js + DuckDB pipeline, exported to Parquet, and queried **entirely in the browser** via DuckDB-WASM. No backend server, no per-query cost — just a static site on Vercel.

> **Live queries run in <100ms, client-side.** The full 522K-row dataset compresses to a 6MB Parquet file that DuckDB-WASM loads and queries in-memory.

---

## Architecture

```
┌─────────────────────┐        Parquet         ┌──────────────────────────┐
│   pipeline/         │  ───────────────────▶  │   dashboard/             │
│   Node.js + DuckDB  │   (hand-off format)    │   Vite + React + TS      │
│                     │                        │   DuckDB-WASM (in-browser)│
│  FY2026_GAA.xlsx    │                        │                          │
│      ↓ ingest       │                        │  Queries run client-side │
│      ↓ clean        │                        │  Charts: Chart.js,       │
│      ↓ aggregate    │                        │  Plotly, Recharts, Leaflet│
│      ↓ validate     │                        │                          │
│   *.parquet         │                        │  Deployed on Vercel      │
└─────────────────────┘                        └──────────────────────────┘
```

**Why this design?**
- **Pipeline (server-side prep):** DuckDB's vectorized engine cleans and aggregates the 64MB Excel file into compact Parquet without loading it all into memory.
- **Dashboard (client-side query):** DuckDB-WASM runs SQL directly in the user's browser. Filtering and drill-downs are in-memory scans, not network calls — so there's zero API infrastructure to pay for or scale.
- **Parquet** is the single hand-off format: columnar, compressed (ZSTD/SNAPPY), and natively readable by both DuckDB and DuckDB-WASM.

---

## Project Structure

```
kiro-ph-data-dashboard/
├── pipeline/                     # Node.js + DuckDB data pipeline
│   ├── src/
│   │   ├── ingest.js             # Excel → clean → aggregate → Parquet
│   │   ├── inspect.js            # Schema inspection utility
│   │   ├── validate.js           # 26-gate data quality validation suite
│   │   └── convert-to-parquet.js # Raw xlsx → parquet converter
│   ├── output/                   # Generated Parquet files
│   └── workshop/                 # Teaching materials (audit, clean, charts)
├── dashboard/                    # Vite + React/TS frontend
│   ├── public/data/              # Parquet + GeoJSON served to the browser
│   └── src/
│       ├── hooks/                # useDuckDB, useBudgetMap
│       ├── components/           # Charts, table, map, layout
│       ├── views/                # 4 navigation views
│       └── workshop/             # DuckDB-WASM workshop demo
├── FY2026_GAA.parquet            # Raw dataset (Parquet, GitHub-friendly)
└── .kiro/steering/               # Project conventions & PRD
```

---

## Data Pipeline

Transforms `FY2026_GAA.xlsx` (64MB, 736,848 raw rows) into optimized Parquet files.

| Output file | Rows | Purpose |
|-------------|------|---------|
| `budget_detail.parquet` | 522,159 | Full cleaned line items |
| `agg_department.parquet` | 37 | Department totals + expense breakdown |
| `agg_expense.parquet` | 4 | Expense class totals (PS/MOOE/CO/FE) |
| `agg_agency.parquet` | 983 | Agency-level breakdown |
| `agg_region.parquet` | 18 | Regional aggregates (for the map) |

**Cleaning applied:** snake_case columns, type casting, deduplication, removal of meta/category rows and zero-value placeholders, derived columns (`amount_php`, `expense_category`, `department_short`).

### Run the pipeline

```bash
cd pipeline
npm install
npm start          # ingest + transform + export Parquet
npm run validate   # run 26 data-quality gates (also `npm test`)
```

### Data Quality

`npm run validate` enforces 7 quality gates (26 assertions): file existence, zero-null completeness, value validity, row uniqueness, cross-table consistency, accuracy anchors, and expense-split integrity. All must pass before deploy.

---

## Dashboard

A 4-view single-page app with a persistent sidebar.

| View | Description |
|------|-------------|
| **📊 Operational Dashboard** | KPI cards, department bar chart, expense donut, top-performers list |
| **💰 Budget Line Items** | Full-screen searchable/filterable table, two-line rows, sticky headers, pagination |
| **🗺️ Regional Map** | Leaflet choropleth (quantile scale, NCR outlier handling) + sliding drilldown drawer |
| **📈 Executive Analysis** | AI-style brief, tabbed Plotly charts, opportunity/risk/action cards |

### Run the dashboard

```bash
cd dashboard
npm install
npm run dev        # → http://localhost:5173
npm run build      # production build
```

---

## Tech Stack

**Pipeline:** Node.js · DuckDB (native) · SheetJS (xlsx)
**Dashboard:** React 19 · TypeScript · Vite · Tailwind CSS · DuckDB-WASM
**Visualization:** Chart.js · Plotly.js · Recharts · Leaflet
**Hosting:** Vercel (static)

---

## Deployment (Vercel)

The frontend lives in the `dashboard/` subdirectory. In your Vercel project settings:

- **Root Directory:** `dashboard`
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

SPA routing is handled by `dashboard/vercel.json`.

---

## Data Source

FY2026 General Appropriations Act (GAA), Republic of the Philippines. Monetary values in the source are expressed in PHP thousands; the pipeline derives `amount_php` as the full peso value.

> **Note on regional figures:** `region_id` reflects allocation by *operating unit*, not deployment location. NCR appears dominant (~63%) because most national agencies are headquartered there while deploying budgets nationwide.

---

## License

For educational and analytical use. Built as part of a KIRO data engineering & visualization workshop.
