import { useState } from 'react';
import { useDuckDB } from './hooks/useDuckDB';
import { Sidebar } from './components/layout/Sidebar';
import { OperationalDashboard } from './views/OperationalDashboard';
import { RegionalMapView } from './views/RegionalMapView';
import { ExecutiveAnalysis } from './views/ExecutiveAnalysis';
import './App.css';

function App() {
  const { loading, error, query } = useDuckDB();
  const [activeView, setActiveView] = useState('dashboard');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-alt">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-border-subtle border-t-brand-primary rounded-full animate-spin mx-auto" />
          <div>
            <p className="text-sm font-medium text-text-primary">Initializing DuckDB-WASM</p>
            <p className="text-xs text-text-muted mt-1">Loading Philippine budget data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-alt">
        <div className="bg-surface border border-negative/30 rounded-xl p-6 max-w-md">
          <h2 className="text-base font-bold text-negative mb-2">Data Load Error</h2>
          <pre className="text-xs text-text-secondary bg-surface-alt p-3 rounded overflow-auto">{error}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="flex-1 overflow-hidden flex flex-col">
        {activeView === 'dashboard' && <OperationalDashboard query={query} />}
        {activeView === 'map' && <RegionalMapView query={query} />}
        {activeView === 'executive' && <ExecutiveAnalysis query={query} />}
      </main>
    </div>
  );
}

export default App;
