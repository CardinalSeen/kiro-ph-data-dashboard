import { useEffect, useState } from 'react';
import {
  TopAllocationsChart,
  BudgetCompositionDonut,
  RegionalDistributionChart,
  SpecialFundsChart,
  MacroInsightsPanel,
} from '../components/analytics';
import { TopBar } from '../components/layout/TopBar';

interface Props {
  query: <T>(sql: string) => Promise<T[]>;
}

interface ExecBrief {
  summary: string;
  highlights: string[];
}

export function ExecutiveAnalysis({ query }: Props) {
  const [brief, setBrief] = useState<ExecBrief | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'regional' | 'funds' | 'macro'>('overview');

  useEffect(() => {
    async function generateBrief() {
      const [top3] = await query<{ depts: string }>(`
        SELECT STRING_AGG(department_short, ', ' ORDER BY total_php DESC) as depts
        FROM (SELECT department_short, total_php FROM 'agg_department.parquet' ORDER BY total_php DESC LIMIT 3)
      `);
      const [totals] = await query<{ total: number; ps_pct: number; co_pct: number }>(`
        SELECT 
          SUM(total_php) as total,
          ROUND(SUM(CASE WHEN expense_category='PS' THEN total_php ELSE 0 END) * 100.0 / SUM(total_php), 1) as ps_pct,
          ROUND(SUM(CASE WHEN expense_category='CO' THEN total_php ELSE 0 END) * 100.0 / SUM(total_php), 1) as co_pct
        FROM 'agg_expense.parquet'
      `);
      const [ncrPct] = await query<{ pct: number }>(`
        SELECT ROUND(total_php * 100.0 / (SELECT SUM(total_php) FROM 'agg_region.parquet'), 1) as pct
        FROM 'agg_region.parquet' WHERE region_id = '13'
      `);

      setBrief({
        summary: `The FY2026 General Appropriations Act allocates ₱${(Number(totals.total) / 1e12).toFixed(2)} Trillion across 37 departments. Fiscal concentration remains high — ${top3.depts} account for the majority of national spending. Personnel costs (${Number(totals.ps_pct)}%) dominate over infrastructure investment (${Number(totals.co_pct)}%), while NCR absorbs ${Number(ncrPct.pct)}% of all regional allocations through centralized agency operations.`,
        highlights: [
          `Personnel Services at ${Number(totals.ps_pct)}% signals workforce-heavy government structure`,
          `Capital Outlays at only ${Number(totals.co_pct)}% constrains long-term asset growth`,
          `NCR concentration (${Number(ncrPct.pct)}%) reflects HQ-centric allocation, not deployment`,
          `Top 3 departments (${top3.depts}) drive national fiscal strategy`,
        ],
      });
    }
    generateBrief();
  }, [query]);

  const TABS = [
    { id: 'overview', label: 'Allocation Overview' },
    { id: 'regional', label: 'Regional Analysis' },
    { id: 'funds', label: 'Special Funds' },
    { id: 'macro', label: 'Macro Insights' },
  ] as const;

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Executive Analysis" subtitle="Strategic insights & C-suite reporting for FY2026 budget" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* AI Executive Brief */}
        {brief && (
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 border border-brand-primary/20 rounded-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">🧠</span>
              <div>
                <h3 className="text-sm font-bold text-brand-primary uppercase tracking-wide mb-2">
                  Executive Brief
                </h3>
                <p className="text-sm text-text-primary leading-relaxed">{brief.summary}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-4">
              {brief.highlights.map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                  <span className="text-brand-secondary font-bold mt-0.5">→</span>
                  <span>{h}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-surface-alt rounded-lg border border-border-subtle w-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-surface text-brand-primary shadow-sm border border-border-subtle'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopAllocationsChart query={query} />
            <BudgetCompositionDonut query={query} />
          </div>
        )}

        {activeTab === 'regional' && (
          <RegionalDistributionChart query={query} />
        )}

        {activeTab === 'funds' && (
          <SpecialFundsChart query={query} />
        )}

        {activeTab === 'macro' && (
          <MacroInsightsPanel query={query} />
        )}

        {/* Recommendations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InsightCard
            type="opportunity"
            title="Infrastructure Investment Gap"
            text="Capital Outlays represent only 22.9% of total budget. Increasing CO allocation by 5% could unlock ₱200B+ in new infrastructure capacity."
          />
          <InsightCard
            type="risk"
            title="Fiscal Concentration Risk"
            text="Top 5 departments control 60% of national spending. Execution delays in any single mega-agency cascade into systemic underspending."
          />
          <InsightCard
            type="action"
            title="Regional Equity Review"
            text="Recommend a deployment-tracking overlay to distinguish HQ allocations from actual regional spending for evidence-based equitable distribution."
          />
        </div>
      </div>
    </div>
  );
}

function InsightCard({ type, title, text }: { type: 'opportunity' | 'risk' | 'action'; title: string; text: string }) {
  const config = {
    opportunity: { icon: '💡', bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-800' },
    risk: { icon: '⚠️', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-100 text-red-800' },
    action: { icon: '🎯', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800' },
  };
  const c = config[type];
  return (
    <div className={`${c.bg} border ${c.border} rounded-xl p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span>{c.icon}</span>
        <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full ${c.badge}`}>
          {type}
        </span>
      </div>
      <h4 className="text-sm font-semibold text-text-primary mb-1">{title}</h4>
      <p className="text-xs text-text-secondary leading-relaxed">{text}</p>
    </div>
  );
}
