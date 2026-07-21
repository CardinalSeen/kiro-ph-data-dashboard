/**
 * LAYER 2: National Budget Composition by Expense Class
 * Donut Chart — High-contrast corporate palette with centered total
 *
 * Executive Insight:
 * Personnel Services (39.3%) and MOOE (37.8%) consume 77% of the national budget,
 * leaving only 22.9% for Capital Outlays — a structural constraint on infrastructure growth
 * and long-term asset development.
 */
import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';

interface ExpenseData {
  expense_class: string;
  expense_category: string;
  total_php: number;
}

interface Props {
  query: <T>(sql: string) => Promise<T[]>;
}

const COLORS: Record<string, string> = {
  PS: '#1E3A8A',   // Deep Navy
  MOOE: '#0F766E', // Dark Teal
  CO: '#475569',   // Slate
  FE: '#92400E',   // Amber Dark
  Other: '#6B7280',
};

export function BudgetCompositionDonut({ query }: Props) {
  const [data, setData] = useState<ExpenseData[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);

  useEffect(() => {
    async function load() {
      const rows = await query<ExpenseData>(`
        SELECT expense_class, expense_category, total_php
        FROM 'agg_expense.parquet'
        ORDER BY total_php DESC
      `);
      const processed = rows.map(r => ({ ...r, total_php: Number(r.total_php) }));
      setData(processed);
      setGrandTotal(processed.reduce((sum, r) => sum + r.total_php, 0));
    }
    load();
  }, [query]);

  if (data.length === 0) return <div className="chart-loading">Loading...</div>;

  return (
    <div className="analytics-card">
      <div className="analytics-header">
        <h3>🍩 National Budget Composition by Expense Class</h3>
        <p className="analytics-insight">
          Personnel Services (39.3%) and MOOE (37.8%) consume 77% of the national budget,
          leaving only 22.9% for Capital Outlays — a structural constraint on infrastructure investment.
        </p>
      </div>
      <Plot
        data={[
          {
            type: 'pie',
            hole: 0.55,
            labels: data.map(d => d.expense_class),
            values: data.map(d => d.total_php / 1e9),
            textinfo: 'label+percent',
            textposition: 'outside',
            textfont: { size: 11 },
            marker: {
              colors: data.map(d => COLORS[d.expense_category] || COLORS.Other),
              line: { color: 'white', width: 2 },
            },
            hovertemplate: '<b>%{label}</b><br>₱%{value:.1f}B (%{percent})<extra></extra>',
          },
        ]}
        layout={{
          margin: { l: 20, r: 20, t: 20, b: 20 },
          showlegend: false,
          plot_bgcolor: 'white',
          paper_bgcolor: 'white',
          font: { family: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' },
          annotations: [
            {
              text: `₱${(grandTotal / 1e12).toFixed(2)}T<br><span style="font-size:11px;color:#666">Grand Total</span>`,
              showarrow: false,
              font: { size: 18, color: '#1E3A8A', family: 'system-ui' },
              x: 0.5,
              y: 0.5,
            },
          ],
          hoverlabel: { bgcolor: '#0F766E', font: { color: 'white' } },
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%', height: '380px' }}
      />
    </div>
  );
}
