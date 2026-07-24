import { useEffect, useState, useCallback } from 'react';
import { DepartmentChart } from '../components/DepartmentChart';
import { ExpenseChart } from '../components/ExpenseChart';
import { BudgetTable } from '../components/BudgetTable';
import { TopBar } from '../components/layout/TopBar';

interface Props {
  query: <T>(sql: string) => Promise<T[]>;
}

interface KPIData {
  total_budget: number;
  department_count: number;
  agency_count: number;
  line_items: number;
  avg_per_dept: number;
  top_dept: string;
  top_dept_pct: number;
}

export function OperationalDashboard({ query }: Props) {
  const [kpi, setKpi] = useState<KPIData | null>(null);
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
      const total = Number(summary.total_budget);
      setKpi({
        total_budget: total,
        department_count: Number(summary.department_count),
        agency_count: Number(summary.agency_count),
        line_items: Number(summary.line_items),
        avg_per_dept: total / Number(summary.department_count),
        top_dept: String(top.department_short),
        top_dept_pct: (Number(top.total_php) / total) * 100,
      });
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
      <TopBar title="Operational Dashboard" subtitle="Daily monitoring & tactical performance tracking" />
      
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Summary Row */}
        {kpi && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <KPICard
              label="Total National Budget"
              value={formatPHP(kpi.total_budget)}
              trend="+4.2%"
              trendUp={true}
              primary
            />
            <KPICard label="Departments" value={String(kpi.department_count)} />
            <KPICard label="Agencies" value={String(kpi.agency_count)} />
            <KPICard
              label="Budget Lines"
              value={kpi.line_items.toLocaleString()}
              trend="522K items"
              trendUp={true}
            />
            <KPICard
              label={`Top: ${kpi.top_dept}`}
              value={`${kpi.top_dept_pct.toFixed(1)}%`}
              trend="of total budget"
              trendUp={false}
            />
          </div>
        )}

        {/* Main Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-surface border border-border-subtle rounded-xl p-5 shadow-xs">
            <DepartmentChart query={query} onDepartmentClick={setSelectedDept} />
          </div>
          <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-xs">
            <ExpenseChart query={query} />
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-text-primary">
              Budget Line Items {selectedDept && <span className="text-brand-primary">— {selectedDept}</span>}
            </h3>
            {selectedDept && (
              <button
                onClick={() => setSelectedDept(null)}
                className="text-xs px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded-md hover:bg-red-100 cursor-pointer"
              >
                Clear Filter
              </button>
            )}
          </div>
          <BudgetTable query={query} departmentFilter={selectedDept ?? undefined} />
        </div>
      </div>
    </div>
  );
}

/* ─── KPI Card Sub-component ─── */
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
          primary ? 'text-blue-200'
            : trendUp ? 'text-positive' : 'text-text-muted'
        }`}>
          {trendUp && '↑ '}{trend}
        </div>
      )}
    </div>
  );
}
