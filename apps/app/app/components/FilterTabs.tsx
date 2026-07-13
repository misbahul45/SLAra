import type { RiskTier } from "~/lib/types";

export type TierFilter = RiskTier | "ALL";

interface FilterTabsProps {
  active: TierFilter;
  counts: Record<RiskTier, number>;
  total: number;
  onChange: (filter: TierFilter) => void;
}

export function FilterTabs({ active, counts, total, onChange }: FilterTabsProps) {
  const tabs: { key: TierFilter; label: string; count: number }[] = [
    { key: "ALL", label: "All", count: total },
    { key: "SAFE", label: "SAFE", count: counts.SAFE },
    { key: "WARNING", label: "WARNING", count: counts.WARNING },
    { key: "CRITICAL", label: "CRITICAL", count: counts.CRITICAL },
  ];

  return (
    <div className="flex gap-1 border-b border-line">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-accent text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 font-mono text-xs tabular-nums text-muted">
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
