import type { KpiSummary } from "~/lib/types";
import { TIER_HEX } from "~/lib/tier";

// KPI strip from the loader. Tier counts are colored to match the semantic palette.

interface KpiItem {
  label: string;
  value: string | number;
  color?: string;
}

/** Null = not measured. Show a dash rather than inventing a number ("null%"). */
const or = (v: number | null, unit: string) => (v === null ? "—" : `${v}${unit}`);

export function KpiStrip({ kpi }: { kpi: KpiSummary }) {
  const items: KpiItem[] = [
    { label: "Active", value: kpi.active_shipments },
    { label: "SAFE", value: kpi.tier_counts.SAFE, color: TIER_HEX.SAFE },
    { label: "WARNING", value: kpi.tier_counts.WARNING, color: TIER_HEX.WARNING },
    { label: "CRITICAL", value: kpi.tier_counts.CRITICAL, color: TIER_HEX.CRITICAL },
    { label: "On-time", value: or(kpi.on_time_rate_pct, "%") },
    { label: "Auto-exec", value: or(kpi.auto_execute_rate_pct, "%") },
    { label: "CO₂ saved", value: or(kpi.co2_saved_today_kg, " kg") },
    { label: "Avg latency", value: or(kpi.avg_decision_latency_ms, " ms") },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded border border-line bg-surface/40 p-3"
        >
          <div className="text-xs uppercase tracking-wide text-muted">
            {item.label}
          </div>
          <div
            className="mt-1 font-mono text-xl tabular-nums"
            style={item.color ? { color: item.color } : undefined}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
