import { useEffect, useState, useCallback } from 'react';
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

interface DeptRow {
  department_short: string;
  total_php: number;
  ps_php: number;
  mooe_php: number;
  co_php: number;
}

interface Props {
  query: <T>(sql: string) => Promise<T[]>;
  onDepartmentClick?: (dept: string) => void;
}

export function DepartmentChart({ query, onDepartmentClick }: Props) {
  const [data, setData] = useState<DeptRow[]>([]);
  const [limit, setLimit] = useState(15);

  useEffect(() => {
    async function load() {
      const rows = await query<DeptRow>(`
        SELECT department_short, total_php, ps_php, mooe_php, co_php
        FROM 'agg_department.parquet'
        ORDER BY total_php DESC
        LIMIT ${limit}
      `);
      setData(rows.map(r => ({
        ...r,
        total_php: Number(r.total_php),
        ps_php: Number(r.ps_php),
        mooe_php: Number(r.mooe_php),
        co_php: Number(r.co_php),
      })));
    }
    load();
  }, [query, limit]);

  const handleClick = useCallback(
    (_: unknown, elements: { index: number }[]) => {
      if (elements.length > 0 && onDepartmentClick) {
        onDepartmentClick(data[elements[0].index].department_short);
      }
    },
    [data, onDepartmentClick]
  );

  if (data.length === 0) return <div>Loading chart...</div>;

  const chartData = {
    labels: data.map((r) => r.department_short),
    datasets: [
      {
        label: 'Personnel Services',
        data: data.map((r) => r.ps_php / 1e9),
        backgroundColor: 'rgba(54, 162, 235, 0.8)',
      },
      {
        label: 'MOOE',
        data: data.map((r) => r.mooe_php / 1e9),
        backgroundColor: 'rgba(255, 159, 64, 0.8)',
      },
      {
        label: 'Capital Outlays',
        data: data.map((r) => r.co_php / 1e9),
        backgroundColor: 'rgba(75, 192, 192, 0.8)',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: handleClick,
    plugins: {
      title: { display: true, text: `Top ${limit} Departments by Budget Allocation (₱ Billions)` },
      tooltip: {
        callbacks: {
          label: (ctx: { dataset: { label: string }; parsed: { y: number } }) =>
            `${ctx.dataset.label}: ₱${ctx.parsed.y.toFixed(1)}B`,
        },
      },
    },
    scales: {
      x: { stacked: true },
      y: { stacked: true, title: { display: true, text: '₱ Billions' } },
    },
  };

  return (
    <div className="chart-container">
      <div className="chart-controls">
        <label>
          Show top{' '}
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
            <option value={37}>All 37</option>
          </select>{' '}
          departments
        </label>
        <span className="chart-hint">Click a bar to drill down</span>
      </div>
      <div className="chart-wrapper">
        <Bar data={chartData} options={options as never} />
      </div>
    </div>
  );
}
