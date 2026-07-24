import { useEffect, useState, useCallback } from 'react';
import { DepartmentChart } from '../components/DepartmentChart';
import { ExpenseChart } from '../components/ExpenseChart';
import { DrillDown } from '../components/DrillDown';
import { TopBar } from '../components/layout/TopBar';

interface Props {
  query: <T>(sql: string) => Promise<T[]>;
}

interface KPIData {
  total_budget: number;
  department_count: number;
  agency_count: number;
  line_items: number;
  top_dept: string;
  top_dept_amount: number;
  top_dept_pct: number;
  co_pct: number;
}

interface TopPerformer {
  department_short: string;
  total_php: number;
  agency_count: number;
}

export function OperationalDashboard({ query }: Props) {
  const [kpi, setKpi] = useState<KPIData | null>(null);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const [summary] = await query<{
        total_budget: number; department_count: number;
        agency_count: number; line_items: number;
      }>(`
        SELECT SUM(total_php) as total_budget, COUNT(*) as department_count,
               SUM(agency_count) as agency_count, SUM(line_items) as line_items
        FROM 'agg_department.parquet'
      `);
      const [top] = await query<{ department_short: string; total_php: number }>(`
        SELECT department_short, total_php FROM 'agg_department.parquet' ORDER BY total_php DESC LIMIT 1
      `);
      const [coPct] = await query<{ pct: number }>(`
        SELECT ROUND(SUM(CASE WHEN expense_category='CO' THEN total_php ELSE 0 END) * 100.0 / SUM(total_php), 1) as pct
        FROM 'agg_expense.parquet'
      `);

      const total = Number(summary.total_budget);
      setKpi({
        total_budget: total,
        department_count: Number(summary.department_count),
        agency_count: Number(summary.agency_count),
        line_items: Number(summary.line_items),
        top_dept: String(top.department_short),
        top_dept_amount: Number(top.total_php),
        top_dept_pct: (Number(top.total_php) / total) * 100,
        co_pct: Number(coPct.pct),
      });

      // Top performers
      const performers = await query<TopPerformer>(`
        SELECT department_short, total_php, agency_count
        FROM 'agg_department.parquet'
        ORDER BY total_php DESC
        LIMIT 10
      `);
      setTopPerformers(performers.map(r => ({
        department_short: String(r.department_short),
        total_php: Number(r.total_php),
        agency_count: Number(r.agency_count),
      })));
    }
    load();
  }, [query]);

  const formatPHP = useCallback((val: number) => {
    if (val >= 1e12) return `₱${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `₱${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `₱${(val / 1e6).toFixed(0)}M`;
    return `₱${val.toLocaleString()}`;
  }, []);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Operational Dashboard" subtitle="Tactical monitoring & daily operational performance" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Summary Row */}
        {kpi && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard
              label="Total National Budget"
              value={formatPHP(kpi.total_budget)}
              trend="+4.2% YoY"
              trendUp
              primary
            />
            <KPICard label="Active Departments" value={String(kpi.department_count)} />
            <KPICard label="Active Agencies" value={String(kpi.agency_count)} />
            <KPICard
              label="Capital Outlay Rate"
              value={`${kpi.co_pct}%`}
              trend="Infrastructure share"
            />
            <KPICard
              label={`Top: ${kpi.top_dept}`}
              value={formatPHP(kpi.top_dept_amount)}
              trend={`${kpi.top_dept_pct.toFixed(1)}% of total`}
              trendUp
            />
          </div>
        )}

        {/* Main Chart Area + Expense */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface border border-border-subtle rounded-xl p-5 shadow-xs">
            <DepartmentChart query={query} onDepartmentClick={setSelectedDept} />
          </div>
          <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-xs">
            <ExpenseChart query={query} />
          </div>
        </div>

        {/* Drill Down */}
        {selectedDept && (
          <DrillDown query={query} department={selectedDept} onClose={() => setSelectedDept(null)} />
        )}

        {/* Quick Status List — Top Performing Departments */}
        <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-text-primary">Top 10 Departments — Quick View</h3>
            <span className="text-xs text-text-muted">Click a row to drill down</span>
          </div>
          <div className="space-y-1.5">
            {topPerformers.map((dept, i) => (
              <button
                key={dept.department_short}
                onClick={() => setSelectedDept(dept.department_short)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left cursor-pointer transition ${
                  selectedDept === dept.department_short
                    ? 'bg-brand-primary/5 border border-brand-primary/20'
                    : 'hover:bg-surface-alt border border-transparent'
                }`}
              >
                <span className="w-6 h-6 flex items-center justify-center text-xs font-bold text-text-muted bg-surface-alt rounded-full border border-border-subtle">
                  {i + 1}
                </span>
                <span className="text-xs font-bold font-mono text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded">
                  {dept.department_short}
                </span>
                <span className="flex-1 text-sm text-text-primary">{dept.agency_count} agencies</span>
                <span className="text-sm font-bold text-text-primary tabular-nums">
                  {formatPHP(dept.total_php)}
                </span>
                <div className="w-24 h-1.5 bg-surface-alt rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-primary/60 rounded-full"
                    style={{ width: `${(dept.total_php / (topPerformers[0]?.total_php || 1)) * 100}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── KPI Card ─── */
function KPICard({ label, value, trend, trendUp, primary }: {
  label: string; value: string; trend?: string; trendUp?: boolean; primary?: boolean;
}) {
  return (
    <div className={`rounded-xl p-4 border transition-all ${
      primary
        ? 'bg-brand-primary text-white border-brand-primary shadow-md'
        : 'bg-surface border-border-subtle hover:shadow-sm'
    }`}>
      <div className={`text-xs font-medium uppercase tracking-wide mb-1 ${
        primary ? 'text-blue-200' : 'text-text-muted'
      }`}>
        {label}
      </div>
      <div className={`text-xl font-bold ${primary ? 'text-white' : 'text-text-primary'}`}>
        {value}
      </div>
      {trend && (
        <div className={`text-xs mt-1 font-medium ${
          primary ? 'text-blue-200' : trendUp ? 'text-positive' : 'text-text-muted'
        }`}>
          {trendUp && '↑ '}{trend}
        </div>
      )}
    </div>
  );
}
