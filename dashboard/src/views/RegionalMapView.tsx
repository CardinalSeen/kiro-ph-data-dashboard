import { lazy, Suspense, useState } from 'react';
import { useBudgetMap, type RegionBudget } from '../hooks/useBudgetMap';
import { RegionInsightCard } from '../components/RegionInsightCard';
import { TopBar } from '../components/layout/TopBar';

const RegionMap = lazy(() =>
  import('../components/RegionMap').then((m) => ({ default: m.RegionMap }))
);

interface Props {
  query: <T>(sql: string) => Promise<T[]>;
}

export function RegionalMapView({ query }: Props) {
  const mapData = useBudgetMap(query);
  const [selectedRegion, setSelectedRegion] = useState<RegionBudget | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleRegionClick = (regionId: string) => {
    const region = mapData.regions.find(r => r.region_id === regionId);
    if (region) {
      setSelectedRegion(region);
      setDrawerOpen(true);
    }
  };

  const formatPHP = (val: number) => {
    if (val >= 1e12) return `₱${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `₱${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `₱${(val / 1e6).toFixed(0)}M`;
    return `₱${val.toLocaleString()}`;
  };

  if (mapData.loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-text-muted">Loading map data...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Regional Map" subtitle="Geographic & spatial budget analytics across Philippine regions" />

      <div className="flex-1 flex overflow-hidden">
        {/* Main Map Area */}
        <div className="flex-1 relative">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full bg-surface-alt">
              <div className="text-text-muted">Loading interactive map...</div>
            </div>
          }>
            {mapData.geojson && (
              <RegionMap
                geojson={mapData.geojson}
                regions={mapData.regions}
                nationalTotal={mapData.nationalTotal}
                onRegionClick={handleRegionClick}
              />
            )}
          </Suspense>

          {/* Floating Insight Card (Top Right) */}
          <div className="absolute top-4 right-4 w-72 z-[500]">
            <RegionInsightCard
              regions={mapData.regions}
              nationalTotal={mapData.nationalTotal}
            />
          </div>
        </div>

        {/* Regional Drilldown Sliding Drawer */}
        <div className={`transition-all duration-300 border-l border-border-subtle bg-surface overflow-y-auto ${
          drawerOpen ? 'w-96' : 'w-0'
        }`}>
          {drawerOpen && selectedRegion && (
            <div className="p-5 space-y-5 w-96">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-text-primary">
                  {selectedRegion.region_name}
                </h3>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-surface-alt border border-border-subtle text-text-muted hover:text-negative hover:border-negative cursor-pointer text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs text-text-muted uppercase tracking-wide font-medium">
                {selectedRegion.region_short} • Rank #{selectedRegion.rank} of {mapData.regions.length}
              </div>

              {/* Budget Total */}
              <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-lg p-4">
                <div className="text-xs text-brand-primary font-medium">Total Budget</div>
                <div className="text-2xl font-bold text-brand-primary">
                  {formatPHP(selectedRegion.total_php)}
                </div>
                <div className="text-xs text-text-muted mt-1">
                  {selectedRegion.pct_of_national.toFixed(1)}% of national budget
                </div>
              </div>

              {/* Expense Breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
                  Expense Breakdown
                </h4>
                <ExpenseBar label="Personnel Services" value={selectedRegion.ps_php} total={selectedRegion.total_php} color="bg-blue-500" />
                <ExpenseBar label="MOOE" value={selectedRegion.mooe_php} total={selectedRegion.total_php} color="bg-amber-500" />
                <ExpenseBar label="Capital Outlays" value={selectedRegion.co_php} total={selectedRegion.total_php} color="bg-teal-500" />
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <StatBox label="Departments" value={String(selectedRegion.department_count)} />
                <StatBox label="Agencies" value={String(selectedRegion.agency_count)} />
                <StatBox label="Line Items" value={selectedRegion.line_items.toLocaleString()} />
                <StatBox label="Avg/Line" value={formatPHP(selectedRegion.total_php / selectedRegion.line_items)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExpenseBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = (value / total) * 100;
  const formatPHP = (val: number) => {
    if (val >= 1e9) return `₱${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `₱${(val / 1e6).toFixed(0)}M`;
    return `₱${val.toLocaleString()}`;
  };
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-text-secondary">{label}</span>
        <span className="font-medium text-text-primary">{formatPHP(value)} ({pct.toFixed(1)}%)</span>
      </div>
      <div className="h-2 bg-surface-alt rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-alt rounded-lg p-3 text-center border border-border-subtle">
      <div className="text-lg font-bold text-text-primary">{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  );
}
