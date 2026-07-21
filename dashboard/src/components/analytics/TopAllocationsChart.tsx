/**
 * LAYER 1: Top 10 Departments by Budget Allocation
 * Horizontal Bar Chart — Deep Navy corporate palette
 *
 * Executive Insight:
 * The Department of Education commands ₱1.02T (25% of the national budget),
 * followed by DPWH at ₱531B — the top 3 agencies alone consume 46% of all allocations,
 * signaling extreme fiscal concentration in education and infrastructure.
 */
import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';

interface DeptData {
  department_short: string;
  total_php: number;
}

interface Props {
  query: <T>(sql: string) => Promise<T[]>;
}

export function TopAllocationsChart({ query }: Props) {
  const [data, setData] = useState<DeptData[]>([]);

  useEffect(() => {
    async function load() {
      const rows = await query<DeptData>(`
        SELECT department_short, total_php
        FROM 'agg_department.parquet'
        ORDER BY total_php DESC
        LIMIT 10
      `);
      // Reverse for horizontal bar (bottom to top)
      setData(rows.map(r => ({ ...r, total_php: Number(r.total_php) })).reverse());
    }
    load();
  }, [query]);

  if (data.length === 0) return <div className="chart-loading">Loading...</div>;

  const colors = data.map((_, i) => {
    const intensity = 0.4 + (i / data.length) * 0.6;
    return `rgba(30, 58, 138, ${intensity})`; // Deep Navy gradient
  });

  return (
    <div className="analytics-card">
      <div className="analytics-header">
        <h3>📊 Top 10 Departments by Budget Allocation</h3>
        <p className="analytics-insight">
          DepEd commands ₱1.02T (25% of national budget). The top 3 agencies consume 46% of all allocations — 
          extreme fiscal concentration in education and infrastructure.
        </p>
      </div>
      <Plot
        data={[
          {
            type: 'bar',
            orientation: 'h',
            y: data.map(d => d.department_short),
            x: data.map(d => d.total_php / 1e9),
            text: data.map(d => `₱${(d.total_php / 1e9).toFixed(0)}B`),
            textposition: 'outside',
            textfont: { size: 11, color: '#1E3A8A' },
            marker: { color: colors, line: { width: 0 } },
            hovertemplate: '<b>%{y}</b><br>Budget: ₱%{x:.1f}B<extra></extra>',
          },
        ]}
        layout={{
          margin: { l: 100, r: 80, t: 20, b: 50 },
          xaxis: {
            title: { text: 'Budget Allocation (₱ Billions)', font: { size: 12, color: '#475569' } },
            gridcolor: '#f0f0f0',
            tickformat: ',.0f',
            ticksuffix: 'B',
          },
          yaxis: { automargin: true, tickfont: { size: 11 } },
          plot_bgcolor: 'white',
          paper_bgcolor: 'white',
          font: { family: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' },
          hoverlabel: { bgcolor: '#1E3A8A', font: { color: 'white' } },
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%', height: '400px' }}
      />
    </div>
  );
}
