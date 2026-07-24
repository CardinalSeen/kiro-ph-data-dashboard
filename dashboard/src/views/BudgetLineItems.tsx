import { useEffect, useState, useCallback } from 'react';
import { TopBar } from '../components/layout/TopBar';

interface BudgetRow {
  department_short: string;
  agency_name: string;
  program_description: string;
  expense_category: string;
  object_description: string;
  amount_php: number;
}

interface Props {
  query: <T>(sql: string) => Promise<T[]>;
}

const PAGE_SIZE = 50;

export function BudgetLineItems({ query }: Props) {
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [expenseFilter, setExpenseFilter] = useState('');
  const [sortCol, setSortCol] = useState<'amount_php' | 'department_short'>('amount_php');
  const [sortDir, setSortDir] = useState<'ASC' | 'DESC'>('DESC');
  const [perfMs, setPerfMs] = useState(0);

  const buildWhere = useCallback(() => {
    const clauses: string[] = [];
    if (search.trim()) {
      const s = search.trim().replace(/'/g, "''");
      clauses.push(`(
        object_description ILIKE '%${s}%' OR
        agency_name ILIKE '%${s}%' OR
        program_description ILIKE '%${s}%' OR
        department_short ILIKE '%${s}%'
      )`);
    }
    if (expenseFilter) {
      clauses.push(`expense_category = '${expenseFilter}'`);
    }
    return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  }, [search, expenseFilter]);

  useEffect(() => {
    setPage(0);
  }, [search, expenseFilter]);

  useEffect(() => {
    async function load() {
      const where = buildWhere();
      const start = performance.now();

      const [countResult] = await query<{ cnt: number }>(`
        SELECT COUNT(*) as cnt FROM 'budget_detail.parquet' ${where}
      `);

      const dataRows = await query<BudgetRow>(`
        SELECT department_short, agency_name, program_description,
               expense_category, object_description, amount_php
        FROM 'budget_detail.parquet'
        ${where}
        ORDER BY ${sortCol} ${sortDir}
        LIMIT ${PAGE_SIZE} OFFSET ${page * PAGE_SIZE}
      `);

      setPerfMs(performance.now() - start);
      setTotal(Number(countResult.cnt));
      setRows(dataRows.map(r => ({ ...r, amount_php: Number(r.amount_php) })));
    }
    load();
  }, [query, page, search, expenseFilter, sortCol, sortDir, buildWhere]);

  const toggleSort = (col: 'amount_php' | 'department_short') => {
    if (sortCol === col) {
      setSortDir(d => (d === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortCol(col);
      setSortDir(col === 'amount_php' ? 'DESC' : 'ASC');
    }
  };

  const formatPHP = (val: number) => {
    if (val >= 1e9) return `₱${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `₱${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `₱${(val / 1e3).toFixed(0)}K`;
    return `₱${val.toLocaleString()}`;
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Budget Line Items" subtitle="FY2026 General Appropriations Act — Full financial detail" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Action Bar */}
        <div className="sticky top-0 z-10 bg-surface border-b border-border-subtle px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">🔍</span>
              <input
                type="text"
                placeholder="Search agencies, programs, objects..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-border-subtle rounded-lg text-sm bg-surface-alt focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition"
              />
            </div>

            {/* Expense Filter */}
            <select
              value={expenseFilter}
              onChange={(e) => setExpenseFilter(e.target.value)}
              className="px-3 py-2.5 border border-border-subtle rounded-lg text-sm bg-surface-alt focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
            >
              <option value="">All Expense Classes</option>
              <option value="PS">Personnel Services (PS)</option>
              <option value="MOOE">MOOE</option>
              <option value="CO">Capital Outlays (CO)</option>
              <option value="FE">Financial Expenses (FE)</option>
            </select>

            {/* Metadata */}
            <div className="flex items-center gap-2 text-xs shrink-0">
              <span className="px-2.5 py-1.5 bg-brand-primary/5 border border-brand-primary/20 rounded-md font-semibold text-brand-primary">
                {total.toLocaleString()} results
              </span>
              <span className="px-2.5 py-1.5 bg-positive/5 border border-positive/20 rounded-md font-semibold text-positive">
                Query: {perfMs.toFixed(0)}ms
              </span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            {/* Sticky Header */}
            <thead className="sticky top-0 z-5">
              <tr className="bg-surface-alt border-b border-border-subtle">
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted cursor-pointer hover:text-text-primary select-none w-[80px]"
                  onClick={() => toggleSort('department_short')}
                >
                  Dept {sortCol === 'department_short' ? (sortDir === 'ASC' ? '↑' : '↓') : ''}
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted w-[200px]">
                  Agency
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Program & Object Details
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted w-[80px]">
                  Expense
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-muted cursor-pointer hover:text-text-primary select-none w-[120px]"
                  onClick={() => toggleSort('amount_php')}
                >
                  Amount {sortCol === 'amount_php' ? (sortDir === 'ASC' ? '↑' : '↓') : ''}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-text-muted text-sm">
                    No data available for this selection
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border-subtle/50 hover:bg-brand-primary/[0.02] transition-colors"
                  >
                    {/* DEPT — Monospace bold badge */}
                    <td className="px-4 py-3 align-top">
                      <span className="inline-block px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-xs font-bold font-mono rounded">
                        {row.department_short}
                      </span>
                    </td>

                    {/* AGENCY — Bold text */}
                    <td className="px-4 py-3 align-top">
                      <span className="text-sm font-semibold text-text-primary leading-snug">
                        {row.agency_name}
                      </span>
                    </td>

                    {/* PROGRAM & OBJECT — Stacked two-line cell */}
                    <td className="px-4 py-3 align-top">
                      <div className="text-sm font-medium text-text-primary leading-snug">
                        {row.program_description}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5 leading-snug">
                        Object: {row.object_description}
                      </div>
                    </td>

                    {/* EXPENSE CLASS — Color-coded pill */}
                    <td className="px-4 py-3 align-top text-center">
                      <ExpenseBadge category={row.expense_category} />
                    </td>

                    {/* AMOUNT — Right-aligned bold */}
                    <td className="px-4 py-3 align-top text-right">
                      <span className="text-sm font-bold text-text-primary tabular-nums">
                        {formatPHP(row.amount_php)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="sticky bottom-0 bg-surface border-t border-border-subtle px-6 py-3 flex items-center justify-between">
          <div className="text-xs text-text-muted">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
          </div>
          <div className="flex items-center gap-1.5">
            <PaginationBtn onClick={() => setPage(0)} disabled={page === 0}>⟨⟨</PaginationBtn>
            <PaginationBtn onClick={() => setPage(p => p - 1)} disabled={page === 0}>⟨</PaginationBtn>
            <span className="px-3 py-1.5 text-xs font-medium text-text-primary">
              Page {page + 1} of {totalPages || 1}
            </span>
            <PaginationBtn onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>⟩</PaginationBtn>
            <PaginationBtn onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>⟩⟩</PaginationBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function ExpenseBadge({ category }: { category: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    PS: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'PS' },
    CO: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'CO' },
    MOOE: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'MOOE' },
    FE: { bg: 'bg-rose-100', text: 'text-rose-800', label: 'FE' },
  };
  const c = config[category] || { bg: 'bg-gray-100', text: 'text-gray-700', label: category };
  return (
    <span className={`inline-block px-2 py-0.5 ${c.bg} ${c.text} text-xs font-bold rounded-full`}>
      {c.label}
    </span>
  );
}

function PaginationBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-2.5 py-1.5 text-xs border border-border-subtle rounded-md bg-surface hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
    >
      {children}
    </button>
  );
}
