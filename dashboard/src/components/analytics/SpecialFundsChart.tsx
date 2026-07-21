/**
 * LAYER 4: Unprogrammed Allocations & Special Funds
 * Horizontal bar showing where flexible/special funding is directed
 *
 * Executive Insight:
 * Beyond the core NGA budgets (₱3.57T), ₱256B flows through Subsidies and ₱82B through
 * Retirement/Insurance Premiums — the largest "off-grid" channels. International loans
 * (IBRD ₱38B, ADB ₱21B, Japan ₱31B) represent ₱90B in externally-funded program execution,
 * creating dependency on foreign lending institutions for capital projects.
 */
import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';

interface FundData {
  fund_subcategory: string;
  line_items: number;
  total_php: number;
}

interface Props {
  query: <T>(sql: string) => Promise<T[]>;
}

export function SpecialFundsChart({ query }: Props) {
  const [data, setData] = useState<FundData[]>([]);

  useEffect(() => {
    async function load() {
      const rows = await query<FundData>(`
        SELECT 
          fund_subcategory,
          COUNT(*) AS line_items,
          SUM(amount_php) AS total_php
        FROM 'budget_detail.parquet'
        WHERE fund_subcategory != 'Specific Budgets of National Government Agencies'
          AND fund_subcategory IS NOT NULL
        GROUP BY fund_subcategory
        ORDER BY total_php DESC
        LIMIT 15
      `);
      setData(rows.map(r => ({
        fund_subcategory: String(r.fund_subcategory),
        line_items: Number(r.line_items),
        total_php: Number(r.total_php),
      })).reverse());
    }
    load();
  }, [query]);

  if (data.length === 0) return <div className="chart-loading">Loading...</div>;

  const totalSpecial = data.reduce((s, r) => s + r.total_php, 0);

  return (
    <div className="analytics-card">
      <div className="analytics-header">
        <h3>💰 Special Funds & Unprogrammed Allocations</h3>
        <p className="analytics-insight">
          Beyond core NGA budgets, ₱{(totalSpecial / 1e9).toFixed(0)}B flows through special funds.
          Subsidies (₱256B) and foreign loans (IBRD, ADB, Japan = ₱90B combined) represent critical
          off-budget fiscal channels with distinct governance structures.
        </p>
      </div>
      <Plot
        data={[
          {
            type: 'bar',
            orientation: 'h',
            y: data.map(d => d.fund_subcategory.length > 40 
              ? d.fund_subcategory.slice(0, 38) + '…' 
              : d.fund_subcategory),
            x: data.map(d => d.total_php / 1e9),
            text: data.map(d => `₱${(d.total_php / 1e9).toFixed(1)}B`),
            textposition: 'outside',
            textfont: { size: 10, color: '#0F766E' },
            marker: {
              color: data.map(d => d.total_php / 1e9),
              colorscale: [[0, '#B2DFDB'], [0.5, '#26A69A'], [1, '#0F766E']],
              line: { width: 0 },
            },
            hovertemplate: '<b>%{y}</b><br>₱%{x:.1f}B<br>%{customdata} line items<extra></extra>',
            customdata: data.map(d => d.line_items.toLocaleString()),
          },
        ]}
        layout={{
          margin: { l: 250, r: 80, t: 20, b: 50 },
          xaxis: {
            title: { text: '₱ Billions', font: { size: 11, color: '#475569' } },
            gridcolor: '#f5f5f5',
          },
          yaxis: { automargin: true, tickfont: { size: 10 } },
          plot_bgcolor: 'white',
          paper_bgcolor: 'white',
          font: { family: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' },
          hoverlabel: { bgcolor: '#0F766E', font: { color: 'white' } },
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%', height: '450px' }}
      />
    </div>
  );
}
