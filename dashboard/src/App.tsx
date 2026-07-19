import { useState } from 'react';
import { useDuckDB } from './hooks/useDuckDB';
import { SummaryCards } from './components/SummaryCards';
import { DepartmentChart } from './components/DepartmentChart';
import { ExpenseChart } from './components/ExpenseChart';
import { DrillDown } from './components/DrillDown';
import { BudgetTable } from './components/BudgetTable';
import './App.css';

function App() {
  const { loading, error, query } = useDuckDB();
  const [selectedDept, setSelectedDept] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Initializing DuckDB-WASM and loading budget data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <h2>Failed to load data</h2>
        <pre>{error}</pre>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🇵🇭 Philippine FY2026 National Budget Dashboard</h1>
        <p className="subtitle">
          General Appropriations Act — Interactive Explorer
          {selectedDept && (
            <span className="active-filter">
              {' '}• Filtered: <strong>{selectedDept}</strong>
              <button className="btn-clear" onClick={() => setSelectedDept(null)}>✕</button>
            </span>
          )}
        </p>
      </header>

      <main>
        <SummaryCards query={query} />

        <div className="charts-row">
          <DepartmentChart query={query} onDepartmentClick={setSelectedDept} />
          <ExpenseChart query={query} />
        </div>

        {selectedDept && (
          <DrillDown
            query={query}
            department={selectedDept}
            onClose={() => setSelectedDept(null)}
          />
        )}

        <section className="table-section">
          <h2>📋 Budget Line Items {selectedDept ? `— ${selectedDept}` : ''}</h2>
          <BudgetTable query={query} departmentFilter={selectedDept ?? undefined} />
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Data source: FY2026 General Appropriations Act (GAA) • 
          Powered by DuckDB-WASM • All queries run client-side
        </p>
      </footer>
    </div>
  );
}

export default App;
