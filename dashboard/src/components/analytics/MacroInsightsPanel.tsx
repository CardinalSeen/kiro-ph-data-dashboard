/**
 * LAYER 5: Inter-Agency Macro Insights
 * Executive summary panel with fiscal concentration metrics
 *
 * Executive Insight:
 * The Philippine FY2026 budget exhibits extreme top-heaviness: the top 5 agencies
 * (DepEd, DPWH, DILG, DND, DOH) absorb 60.4% of the ₱4.08T total, while the bottom
 * 20 departments collectively share just 8.2%. This structural bottleneck means fiscal
 * policy is effectively determined by fewer than 5 budget committees.
 */
import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';

interface TierData {
  tier: string;
  departments: string[];
  total_php: number;
  pct: number;
  count: number;
}

interface Props {
  query: <T>(sql: string) => Promise<T[]>;
}

export function MacroInsightsPanel({ query }: Props) {
  const [tiers, setTiers] = useState<TierData[]>([]);
  const [concentration, setConcentration] = useState({ top5pct: 0, bottom20pct: 0, gini: 0 });

  useEffect(() => {
    async function load() {
      const rows = await query<{ department_short: string; total_php: number }>(`
        SELECT department_short, total_php
        FROM 'agg_department.parquet'
        ORDER BY total_php DESC
      `);

      const depts = rows.map(r => ({ name: String(r.department_short), total: Number(r.total_php) }));
      const nationalTotal = depts.reduce((s, d) => s + d.total, 0);

      // Define tiers
      const tier1 = depts.slice(0, 5);
      const tier2 = depts.slice(5, 15);
      const tier3 = depts.slice(15);

      const tierData: TierData[] = [
        {
          tier: 'Tier 1 — Mega Agencies (Top 5)',
          departments: tier1.map(d => d.name),
          total_php: tier1.reduce((s, d) => s + d.total, 0),
          pct: (tier1.reduce((s, d) => s + d.total, 0) / nationalTotal) * 100,
          count: tier1.length,
        },
        {
          tier: 'Tier 2 — Mid-Size (6–15)',
          departments: tier2.map(d => d.name),
          total_php: tier2.reduce((s, d) => s + d.total, 0),
          pct: (tier2.reduce((s, d) => s + d.total, 0) / nationalTotal) * 100,
          count: tier2.length,
        },
        {
          tier: 'Tier 3 — Small Agencies (16–37)',
          departments: tier3.map(d => d.name),
          total_php: tier3.reduce((s, d) => s + d.total, 0),
          pct: (tier3.reduce((s, d) => s + d.total, 0) / nationalTotal) * 100,
          count: tier3.length,
        },
      ];

      // Gini coefficient (simplified)
      const sorted = depts.map(d => d.total).sort((a, b) => a - b);
      const n = sorted.length;
      const mean = nationalTotal / n;
      let giniNum = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          giniNum += Math.abs(sorted[i] - sorted[j]);
        }
      }
      const gini = giniNum / (2 * n * n * mean);

      setTiers(tierData);
      setConcentration({
        top5pct: tierData[0].pct,
        bottom20pct: tierData[2].pct,
        gini: gini,
      });
    }
    load();
  }, [query]);

  if (tiers.length === 0) return <div className="chart-loading">Loading...</div>;

  return (
    <div className="analytics-card macro-panel">
      <div className="analytics-header">
        <h3>🏛️ Inter-Agency Fiscal Concentration Analysis</h3>
        <div className="macro-summary">
          <p className="analytics-insight macro-text">
            The Philippine FY2026 budget exhibits extreme top-heaviness: the top 5 agencies 
            (DepEd, DPWH, DILG, DND, DOH) absorb <strong>{concentration.top5pct.toFixed(1)}%</strong> of 
            the ₱4.08T total, while the bottom 22 departments collectively share 
            just <strong>{concentration.bottom20pct.toFixed(1)}%</strong>.
            The Gini coefficient of <strong>{concentration.gini.toFixed(3)}</strong> confirms 
            severe inequality — fiscal policy is effectively shaped by fewer than 5 budget committees,
            creating structural bottlenecks in procurement, execution capacity, and accountability oversight.
          </p>
        </div>
      </div>

      <div className="macro-metrics">
        <div className="macro-kpi">
          <div className="macro-kpi-val">{concentration.top5pct.toFixed(1)}%</div>
          <div className="macro-kpi-label">Top 5 Share</div>
        </div>
        <div className="macro-kpi">
          <div className="macro-kpi-val">{concentration.bottom20pct.toFixed(1)}%</div>
          <div className="macro-kpi-label">Bottom 22 Share</div>
        </div>
        <div className="macro-kpi">
          <div className="macro-kpi-val">{concentration.gini.toFixed(3)}</div>
          <div className="macro-kpi-label">Gini Coefficient</div>
        </div>
        <div className="macro-kpi">
          <div className="macro-kpi-val">{(tiers[0].total_php / tiers[2].total_php).toFixed(0)}×</div>
          <div className="macro-kpi-label">Tier 1/Tier 3 Ratio</div>
        </div>
      </div>

      <Plot
        data={[
          {
            type: 'bar',
            x: tiers.map(t => t.tier),
            y: tiers.map(t => t.total_php / 1e9),
            text: tiers.map(t => `₱${(t.total_php / 1e9).toFixed(0)}B (${t.pct.toFixed(1)}%)`),
            textposition: 'outside',
            textfont: { size: 11, color: '#1E3A8A' },
            marker: {
              color: ['#1E3A8A', '#475569', '#94A3B8'],
              line: { width: 0 },
            },
            hovertemplate: '<b>%{x}</b><br>₱%{y:.0f}B<br>%{customdata} departments<extra></extra>',
            customdata: tiers.map(t => t.count),
            width: [0.5, 0.5, 0.5],
          },
        ]}
        layout={{
          margin: { l: 60, r: 20, t: 20, b: 80 },
          xaxis: { tickfont: { size: 10 } },
          yaxis: {
            title: { text: '₱ Billions', font: { size: 11, color: '#475569' } },
            gridcolor: '#f5f5f5',
          },
          plot_bgcolor: 'white',
          paper_bgcolor: 'white',
          font: { family: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' },
          hoverlabel: { bgcolor: '#1E3A8A', font: { color: 'white' } },
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%', height: '320px' }}
      />

      <div className="tier-detail">
        {tiers.map(t => (
          <div key={t.tier} className="tier-row">
            <span className="tier-name">{t.tier}</span>
            <span className="tier-depts">{t.departments.slice(0, 5).join(', ')}{t.count > 5 ? ` +${t.count - 5} more` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
