import { useEffect, useState } from 'react';

interface SummaryData {
  total_budget: number;
  department_count: number;
  agency_count: number;
  line_items: number;
  top_department: string;
  top_amount: number;
}

interface Props {
  query: <T>(sql: string) => Promise<T[]>;
}

export function SummaryCards({ query }: Props) {
  const [data, setData] = useState<SummaryData | null>(null);

  useEffect(() => {
    async function load() {
      const [summary] = await query<{
        total_budget: number;
        department_count: number;
        agency_count: number;
        line_items: number;
      }>(`
        SELECT 
          SUM(total_php) as total_budget,
          COUNT(*) as department_count,
          SUM(agency_count) as agency_count,
          SUM(line_items) as line_items
        FROM 'agg_department.parquet'
      `);

      const [top] = await query<{ department_short: string; total_php: number }>(`
        SELECT department_short, total_php 
        FROM 'agg_department.parquet' 
        ORDER BY total_php DESC LIMIT 1
      `);

      setData({
        total_budget: Number(summary.total_budget),
        department_count: Number(summary.department_count),
        agency_count: Number(summary.agency_count),
        line_items: Number(summary.line_items),
        top_department: top.department_short,
        top_amount: Number(top.total_php),
      });
    }
    load();
  }, [query]);

  if (!data) return <div className="loading-cards">Loading summary...</div>;

  const formatPHP = (val: number) => {
    if (val >= 1e12) return `₱${(val / 1e12).toFixed(2)}T`;
    if (val >= 1e9) return `₱${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `₱${(val / 1e6).toFixed(1)}M`;
    return `₱${val.toLocaleString()}`;
  };

  return (
    <div className="summary-cards">
      <div className="card card-primary">
        <div className="card-label">FY2026 Total Budget</div>
        <div className="card-value">{formatPHP(data.total_budget)}</div>
      </div>
      <div className="card">
        <div className="card-label">Departments</div>
        <div className="card-value">{data.department_count}</div>
      </div>
      <div className="card">
        <div className="card-label">Agencies</div>
        <div className="card-value">{data.agency_count}</div>
      </div>
      <div className="card">
        <div className="card-label">Budget Line Items</div>
        <div className="card-value">{Number(data.line_items).toLocaleString()}</div>
      </div>
      <div className="card">
        <div className="card-label">Top Department</div>
        <div className="card-value card-value-sm">{data.top_department}</div>
        <div className="card-sub">{formatPHP(data.top_amount)}</div>
      </div>
    </div>
  );
}
