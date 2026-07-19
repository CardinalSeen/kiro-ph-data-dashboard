import { useEffect, useState, useCallback } from 'react';

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
  departmentFilter?: string;
}

const PAGE_SIZE = 50;

export function BudgetTable({ query, departmentFilter }: Props) {
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
    if (departmentFilter) {
      clauses.push(`department_short = '${departmentFilter.replace(/'/g, "''")}'`);
    }
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
  }, [departmentFilter, search, expenseFilter]);

  useEffect(() => {
    setPage(0);
  }, [search, expenseFilter, departmentFilter]);

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
  }, [query, page, search, expenseFilter, departmentFilter, sortCol, sortDir, buildWhere]);

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
    <div className="table-container">
      <div className="table-controls">
        <input
          type="text"
          placeholder="Search agencies, programs, objects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />
        <select
          value={expenseFilter}
          onChange={(e) => setExpenseFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">All Expense Classes</option>
          <option value="PS">Personnel Services</option>
          <option value="MOOE">MOOE</option>
          <option value="CO">Capital Outlays</option>
          <option value="FE">Financial Expenses</option>
        </select>
        <span className="table-meta">
          {total.toLocaleString()} results • Query: {perfMs.toFixed(0)}ms
        </span>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => toggleSort('department_short')}>
                Dept {sortCol === 'department_short' ? (sortDir === 'ASC' ? '↑' : '↓') : ''}
              </th>
              <th>Agency</th>
              <th>Program</th>
              <th>Expense</th>
              <th>Object</th>
              <th className="sortable num" onClick={() => toggleSort('amount_php')}>
                Amount {sortCol === 'amount_php' ? (sortDir === 'ASC' ? '↑' : '↓') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="cell-dept">{row.department_short}</td>
                <td>{row.agency_name}</td>
                <td>{row.program_description}</td>
                <td><span className={`badge badge-${row.expense_category.toLowerCase()}`}>{row.expense_category}</span></td>
                <td>{row.object_description}</td>
                <td className="num">{formatPHP(row.amount_php)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button disabled={page === 0} onClick={() => setPage(0)}>⟨⟨</button>
        <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>⟨</button>
        <span>
          Page {page + 1} of {totalPages || 1}
        </span>
        <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>⟩</button>
        <button disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>⟩⟩</button>
      </div>
    </div>
  );
}
