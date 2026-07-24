interface Props {
  title: string;
  subtitle: string;
}

export function TopBar({ title, subtitle }: Props) {
  return (
    <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border-subtle px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
          <p className="text-sm text-text-muted">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-full">
            <span className="w-2 h-2 rounded-full bg-positive animate-pulse" />
            <span className="text-xs font-medium text-positive">Live Data</span>
          </div>
        </div>
      </div>
    </header>
  );
}
