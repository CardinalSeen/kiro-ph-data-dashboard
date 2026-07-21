/**
 * LAYER 3: Geographic Budget Distribution by Region
 * Treemap + Bar hybrid — shows spatial spending concentration
 *
 * Executive Insight:
 * NCR absorbs 62.7% (₱2.56T) of the national budget through centralized agency operations,
 * while the remaining 17 regions share just 37.3%. This geographic concentration reflects
 * organizational structure rather than deployment — a critical context for equitable allocation discourse.
 */
import { useEffect, useState } from 'react';
import Plot from 'react-plotly.js';

interface RegionData {
  region_id: string;
  total_php: number;
  ps_php: number;
  mooe_php: number;
  co_php: number;
}

interface Props {
  query: <T>(sql: string) => Promise<T[]>;
}

const REGION_NAMES: Record<string, string> = {
  '01': 'Region I (Ilocos)',
  '02': 'Region II (Cagayan Valley)',
  '03': 'Region III (Central Luzon)',
  '04': 'Region IV-A (CALABARZON)',
  '05': 'Region V (Bicol)',
  '06': 'Region VI (Western Visayas)',
  '07': 'Region VII (Central Visayas)',
  '08': 'Region VIII (Eastern Visayas)',
  '09': 'Region IX (Zamboanga)',
  '10': 'Region X (Northern Mindanao)',
  '11': 'Region XI (Davao)',
  '12': 'Region XII (SOCCSKSARGEN)',
  '13': 'NCR (Metro Manila)',
  '14': 'CAR (Cordillera)',
  '16': 'Region XVI (Caraga)',
  '17': 'Region IV-B (MIMAROPA)',
  '18': 'NIR (Negros Island)',
  '19': 'BARMM',
};

// Accessible gradient: light teal to deep navy
const COLOR_SCALE: [number, string][] = [
  [0, '#E0F2F1'],
  [0.2, '#80CBC4'],
  [0.4, '#26A69A'],
  [0.6, '#00796B'],
  [0.8, '#1E3A8A'],
  [1, '#0D1B4A'],
];

export function RegionalDistributionChart({ query }: Props) {
  const [data, setData] = useState<RegionData[]>([]);
  const [view, setView] = useState<'bar' | 'treemap'>('bar');

  useEffect(() => {
    async function load() {
      const rows = await query<RegionData>(`
        SELECT region_id, total_php, ps_php, mooe_php, co_php
        FROM 'agg_region.parquet'
        ORDER BY total_php DESC
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
  }, [query]);

  if (data.length === 0) return <div className="chart-loading">Loading...</div>;

  const nationalTotal = data.reduce((s, r) => s + r.total_php, 0);
  const labels = data.map(d => REGION_NAMES[d.region_id] || `Region ${d.region_id}`);
  const values = data.map(d => d.total_php / 1e9);
  const pcts = data.map(d => ((d.total_php / nationalTotal) * 100).toFixed(1));

  const barTrace = {
    type: 'bar' as const,
    x: labels,
    y: values,
    text: pcts.map(p => `${p}%`),
    textposition: 'outside' as const,
    textfont: { size: 9, color: '#475569' },
    marker: {
      color: values,
      colorscale: COLOR_SCALE,
      line: { width: 0 },
    },
    hovertemplate: '<b>%{x}</b><br>₱%{y:.1f}B (%{text})<extra></extra>',
  };

  const treemapTrace = {
    type: 'treemap' as const,
    labels: labels,
    parents: labels.map(() => ''),
    values: values,
    textinfo: 'label+value+percent root',
    texttemplate: '<b>%{label}</b><br>₱%{value:.0f}B<br>%{percentRoot:.1%}',
    marker: {
      colors: values,
      colorscale: COLOR_SCALE,
      line: { width: 1, color: 'white' },
    },
    hovertemplate: '<b>%{label}</b><br>₱%{value:.1f}B (%{percentRoot:.1%})<extra></extra>',
  };

  return (
    <div className="analytics-card">
      <div className="analytics-header">
        <h3>🗺️ Geographic Budget Distribution by Region</h3>
        <p className="analytics-insight">
          NCR absorbs 62.7% (₱2.56T) through centralized agency operations, while 17 other regions share 37.3%.
          This reflects organizational structure, not deployment — critical context for equitable allocation policy.
        </p>
        <div className="analytics-toggle">
          <button className={view === 'bar' ? 'active' : ''} onClick={() => setView('bar')}>Bar Chart</button>
          <button className={view === 'treemap' ? 'active' : ''} onClick={() => setView('treemap')}>Treemap</button>
        </div>
      </div>
      <Plot
        data={[view === 'bar' ? barTrace : treemapTrace]}
        layout={{
          margin: view === 'bar' ? { l: 60, r: 20, t: 20, b: 120 } : { l: 10, r: 10, t: 10, b: 10 },
          xaxis: view === 'bar' ? { tickangle: -45, tickfont: { size: 9 } } : undefined,
          yaxis: view === 'bar' ? {
            title: { text: '₱ Billions', font: { size: 11, color: '#475569' } },
            gridcolor: '#f5f5f5',
          } : undefined,
          plot_bgcolor: 'white',
          paper_bgcolor: 'white',
          font: { family: '-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif' },
          hoverlabel: { bgcolor: '#0F766E', font: { color: 'white' } },
        }}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: '100%', height: view === 'bar' ? '420px' : '450px' }}
      />
    </div>
  );
}
