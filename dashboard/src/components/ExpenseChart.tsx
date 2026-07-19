import { useEffect, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ExpenseRow {
  expense_category: string;
  total_php: number;
}

interface Props {
  query: <T>(sql: string) => Promise<T[]>;
}

const COLORS = ['#36A2EB', '#FF9F40', '#4BC0C0', '#FF6384'];

export function ExpenseChart({ query }: Props) {
  const [data, setData] = useState<ExpenseRow[]>([]);

  useEffect(() => {
    async function load() {
      const rows = await query<ExpenseRow>(`
        SELECT expense_category, total_php
        FROM 'agg_expense.parquet'
        ORDER BY total_php DESC
      `);
      setData(rows.map(r => ({ ...r, total_php: Number(r.total_php) })));
    }
    load();
  }, [query]);

  if (data.length === 0) return null;

  const total = data.reduce((sum, r) => sum + r.total_php, 0);

  const chartData = {
    labels: data.map((r) => `${r.expense_category} (${((r.total_php / total) * 100).toFixed(1)}%)`),
    datasets: [
      {
        data: data.map((r) => r.total_php / 1e9),
        backgroundColor: COLORS,
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: { display: true, text: 'Budget by Expense Class' },
      tooltip: {
        callbacks: {
          label: (ctx: { label: string; parsed: number }) =>
            `${ctx.label}: ₱${ctx.parsed.toFixed(1)}B`,
        },
      },
    },
  };

  return (
    <div className="chart-container chart-sm">
      <div className="chart-wrapper chart-wrapper-sm">
        <Doughnut data={chartData} options={options as never} />
      </div>
    </div>
  );
}
