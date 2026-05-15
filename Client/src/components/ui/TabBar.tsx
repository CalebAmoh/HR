interface TabBarProps {
  tabs: string[];
  activeTab: string;
  onChange: (tab: string) => void;
  className?: string;
}

export function TabBar({ tabs, activeTab, onChange, className = 'flex flex-wrap items-center gap-2 mt-2 mb-4' }: TabBarProps) {
  return (
    <div className={className}>
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
