interface Props {
  activeView: string;
  onNavigate: (view: string) => void;
}

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Operational Dashboard', icon: '📊', desc: 'Daily monitoring' },
  { id: 'map', label: 'Regional Map', icon: '🗺️', desc: 'Spatial analytics' },
  { id: 'executive', label: 'Executive Analysis', icon: '📈', desc: 'Strategic insights' },
];

export function Sidebar({ activeView, onNavigate }: Props) {
  return (
    <aside className="w-64 h-screen sticky top-0 bg-surface border-r border-border-subtle flex flex-col shrink-0">
      {/* Brand */}
      <div className="p-5 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🇵🇭</span>
          <div>
            <h1 className="text-sm font-bold text-brand-primary leading-tight">PH Budget</h1>
            <p className="text-xs text-text-muted">FY2026 GAA Dashboard</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150 cursor-pointer ${
              activeView === item.id
                ? 'bg-brand-primary text-white shadow-sm'
                : 'text-text-secondary hover:bg-surface-alt hover:text-text-primary'
            }`}
            aria-current={activeView === item.id ? 'page' : undefined}
          >
            <span className="text-lg" aria-hidden="true">{item.icon}</span>
            <div>
              <div className={`text-sm font-medium ${activeView === item.id ? 'text-white' : ''}`}>
                {item.label}
              </div>
              <div className={`text-xs ${activeView === item.id ? 'text-blue-200' : 'text-text-muted'}`}>
                {item.desc}
              </div>
            </div>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border-subtle">
        <div className="text-xs text-text-muted text-center">
          <div>Powered by DuckDB-WASM</div>
          <div className="mt-0.5">All queries run client-side</div>
        </div>
      </div>
    </aside>
  );
}
