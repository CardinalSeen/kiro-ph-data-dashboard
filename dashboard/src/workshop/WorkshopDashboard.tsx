/**
 * ═══════════════════════════════════════════════════════════════════
 * WORKSHOP STEP 4.2 & 4.3 — CLIENT-SIDE SQL DRILL-DOWNS + RECHARTS
 * ═══════════════════════════════════════════════════════════════════
 *
 * Every dropdown change rewrites the SQL WHERE clause and re-queries
 * DuckDB-WASM in-browser. Results flow straight into Recharts.
 *
 * Data Engineering Insight:
 * Filtering happens in-process via SQL over columnar Arrow data, so a
 * "region = NCR" drill-down is a memory scan — not a network round-trip.
 * On Vercel this means no API routes, no cold starts, and no per-query cost.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useWorkshopDB } from './useWorkshopDB';

// Accessible, high-contrast palette (WCAG AA on white)
const PALETTE = ['#1E3A8A', '#0F766E', '#B45309', '#7C3AED', '#BE123C', '#0369A1', '#4D7C0F'];

interface AggRow {
  label: string;
  total: number;
}

// SQL-injection-safe single-quote escaping for the demo
const esc = (s: string) => s.replace(/'/g, "''");

export function WorkshopDashboard() {
  const { ready, error, query } = useWorkshopDB();

  // ── Filter state (drives the SQL) ────────────────────────────────
  const [region, setRegion] = useState('All');
  const [category, setCategory] = useState('All');
  const [groupBy, setGroupBy] = useState<'department' | 'category' | 'region' | 'agency'>('department');

  // ── Dropdown option state (populated from the data itself) ───────
  const [regions, setRegions] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // ── Result state ─────────────────────────────────────────────────
  const [data, setData] = useState<AggRow[]>([]);
  const [lastMs, setLastMs] = useState(0);
  const [rowCount, setRowCount] = useState(0);

  // STEP A: Populate dropdowns from DISTINCT values in the dataset.
  useEffect(() => {
    if (!ready) return;
    (async () => {
      const { rows: r } = await query<{ region: string }>(
        `SELECT DISTINCT region FROM 'cleaned_dataset.parquet' ORDER BY region`
      );
      const { rows: c } = await query<{ category: string }>(
        `SELECT DISTINCT category FROM 'cleaned_dataset.parquet' ORDER BY category`
      );
      setRegions(r.map((x) => x.region));
      setCategories(c.map((x) => x.category));
    })();
  }, [ready, query]);

  // STEP B: Build the WHERE clause from active filters.
  const whereClause = useMemo(() => {
    const clauses: string[] = [];
    if (region !== 'All') clauses.push(`region = '${esc(region)}'`);
    if (category !== 'All') clauses.push(`category = '${esc(category)}'`);
    return clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  }, [region, category]);

  // STEP C: Re-run the aggregation whenever a filter or grouping changes.
  useEffect(() => {
    if (!ready) return;
    (async () => {
      // Optimized aggregation: SUM + GROUP BY + ORDER BY + LIMIT
      const sql = `
        SELECT ${groupBy} AS label, SUM(amount) AS total
        FROM 'cleaned_dataset.parquet'
        ${whereClause}
        GROUP BY ${groupBy}
        ORDER BY total DESC
        LIMIT 20
      `;
      const { rows, ms } = await query<{ label: string; total: number }>(sql);
      setData(rows.map((r) => ({ label: String(r.label), total: Number(r.total) })));
      setLastMs(ms);

      // Also fetch the filtered row count for the metadata badge
      const { rows: cnt } = await query<{ n: number }>(
        `SELECT COUNT(*) AS n FROM 'cleaned_dataset.parquet' ${whereClause}`
      );
      setRowCount(Number(cnt[0].n));
    })();
  }, [ready, query, whereClause, groupBy]);

  const formatPHP = useCallback((v: number) => {
    if (v >= 1e9) return `₱${(v / 1e9).toFixed(2)}B`;
    if (v >= 1e6) return `₱${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `₱${(v / 1e3).toFixed(0)}K`;
    return `₱${v.toLocaleString()}`;
  }, []);

  if (error) return <div className="p-6 text-red-600">DuckDB error: {error}</div>;
  if (!ready) return <div className="p-6 text-slate-500">Booting DuckDB-WASM…</div>;

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Workshop: Client-Side Analytics</h2>
        <p className="text-sm text-slate-500">Every filter runs SQL in your browser via DuckDB-WASM.</p>
      </div>

      {/* ── Interactive Controls ─────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <Dropdown label="Group by" value={groupBy} onChange={(v) => setGroupBy(v as typeof groupBy)}
          options={['department', 'category', 'region', 'agency']} />
        <Dropdown label="Region" value={region} onChange={setRegion} options={['All', ...regions]} />
        <Dropdown label="Category" value={category} onChange={setCategory} options={['All', ...categories]} />

        {/* Metadata: proves live result count + sub-100ms latency */}
        <div className="ml-auto flex gap-2 text-xs">
          <span className="px-2.5 py-1.5 bg-blue-50 border border-blue-200 rounded-md font-semibold text-blue-800">
            {rowCount.toLocaleString()} rows
          </span>
          <span className={`px-2.5 py-1.5 rounded-md font-semibold border ${
            lastMs < 100 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            Query: {lastMs.toFixed(1)}ms {lastMs < 100 ? '✓' : '⚠'}
          </span>
        </div>
      </div>

      {/* ── Recharts Bar Chart ───────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4" style={{ height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 40, right: 40, top: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tickFormatter={formatPHP} tick={{ fontSize: 11, fill: '#475569' }} />
            <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11, fill: '#334155' }} />
            <Tooltip
              formatter={(v) => [formatPHP(Number(v)), 'Total']}
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
              cursor={{ fill: 'rgba(30,58,138,0.05)' }}
            />
            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Reusable accessible dropdown ── */
function Dropdown({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
