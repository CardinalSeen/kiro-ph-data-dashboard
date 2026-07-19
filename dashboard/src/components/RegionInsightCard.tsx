import type { RegionBudget } from '../hooks/useBudgetMap';

interface Props {
  regions: RegionBudget[];
  nationalTotal: number;
}

const formatPHP = (val: number) => {
  if (val >= 1e12) return `₱${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `₱${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `₱${(val / 1e6).toFixed(0)}M`;
  return `₱${val.toLocaleString()}`;
};

export function RegionInsightCard({ regions, nationalTotal }: Props) {
  if (regions.length === 0) return null;

  const top = regions[0];
  const second = regions[1];
  const gap = top.total_php - (second?.total_php ?? 0);
  const multiplier = second ? (top.total_php / second.total_php).toFixed(1) : '∞';
  const concentrationPct = ((top.total_php / nationalTotal) * 100).toFixed(1);

  // Check for ties (within 0.1% of each other)
  const isTied = second && Math.abs(top.total_php - second.total_php) / top.total_php < 0.001;

  return (
    <div className="insight-card">
      <div className="insight-header">
        <span className="insight-icon">🏆</span>
        <span className="insight-title">Highest Budget Allocation</span>
      </div>

      <div className="insight-body">
        {isTied ? (
          <div className="insight-tied">
            <div className="insight-region">Tied: {top.region_short} & {second.region_short}</div>
            <div className="insight-amount">{formatPHP(top.total_php)} each</div>
          </div>
        ) : (
          <>
            <div className="insight-region">{top.region_name} ({top.region_short})</div>
            <div className="insight-amount">{formatPHP(top.total_php)}</div>
            <div className="insight-pct">{concentrationPct}% of national budget</div>

            <div className="insight-bar">
              <div
                className="insight-bar-fill"
                style={{ width: `${Math.min(Number(concentrationPct), 100)}%` }}
              />
            </div>

            {second && (
              <div className="insight-gap">
                Gap to #{2} ({second.region_short}): {formatPHP(gap)} ({multiplier}× larger)
              </div>
            )}
          </>
        )}
      </div>

      <div className="insight-footer">
        <div className="insight-stat">
          <span className="insight-stat-val">{top.department_count}</span>
          <span className="insight-stat-label">Departments</span>
        </div>
        <div className="insight-stat">
          <span className="insight-stat-val">{top.agency_count}</span>
          <span className="insight-stat-label">Agencies</span>
        </div>
        <div className="insight-stat">
          <span className="insight-stat-val">{top.line_items.toLocaleString()}</span>
          <span className="insight-stat-label">Line Items</span>
        </div>
      </div>
    </div>
  );
}
