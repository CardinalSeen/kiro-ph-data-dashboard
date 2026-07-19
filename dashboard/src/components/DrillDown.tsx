import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface AgencyRow {
  agency_name: string;
  expense_category: string;
  total_php: number;
}

interface Props {
  query: <T>(sql: string) => Promise<T[]>;
  department: string;
  onClose: () => void;
}

export function DrillDown({ query, department, onClose }: Props) {
  const [data, setData] = useState<AgencyRow[]>([]);
  const [perfMs, setPerfMs] = useState<number>(0);

  useEffect(() => {
    async function load() {
      const start = performance.now();
      const rows = await query<AgencyRow>(`
        SELECT agency_name, expense_category, total_php
        FROM 'agg_agency.parquet'
        WHERE department_short = '${department.replace(/'/g, "''")}'
        ORDER BY total_php DESC
      `);
      setPerfMs(performance.now() - start);
      setData(rows.map(r => ({ ...r, total_php: Number(r.total_php) })));
    }
    load();
  }, [query, department]);

  if (data.length === 0) return <div className="drilldown">Loading {department} breakdown...</div>;

  // Pivot: group by agency, split by expense category
  const agencies = [...new Set(data.map((r) => r.agency_name))].slice(0, 15);
  const categories = [...new Set(data.map((r) => r.expense_category))];
  const colors = ['#36A2EB', '#FF9F40', '#4BC0C0', '#FF6384', '#9966FF'];

  const datasets = categories.map((cat, i) => ({
    label: cat,
    data: agencies.map((agy) => {
      const row = data.find((r) => r.agency_name === agy && r.expense_category === cat);
      return row ? row.total_php / 1e9 : 0;
    }),
    backgroundColor: colors[i % colors.length],
  }));

  const chartData = { labels: agencies.map(a => a.length > 30 ? a.slice(0, 28) + '…' : a), datasets };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: { display: true, text: `${department} — Agency Breakdown (₱ Billions)` },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label: string }; parsed: { x: number } }) =>
            `${ctx.dataset.label}: ₱${ctx.parsed.x.toFixed(2)}B`,
        },
      },
    },
    scales: {
      x: { stacked: true, title: { display: true, text: '₱ Billions' } },
      y: { stacked: true },
    },
  };

  return (
    <div className="drilldown">
      <div className="drilldown-header">
        <h3>🔍 {department} — Drill Down</h3>
        <div className="drilldown-meta">
          <span className="perf-badge">Query: {perfMs.toFixed(0)}ms</span>
          <button className="btn-close" onClick={onClose}>✕ Close</button>
        </div>
      </div>
      <div className="chart-wrapper chart-wrapper-drill">
        <Bar data={chartData} options={options as never} />
      </div>
    </div>
  );
}
