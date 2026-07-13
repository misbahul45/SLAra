import type { KpiSummary } from "~/lib/types";

// Slice 1: functional KPI strip from the loader. Final styling in Slice 2 (§2).

interface KpiItem {
  label: string;
  value: string | number;
}

export function KpiStrip({ kpi }: { kpi: KpiSummary }) {
  const items: KpiItem[] = [
    { label: "Active", value: kpi.active_shipments },
    { label: "SAFE", value: kpi.tier_counts.SAFE },
    { label: "WARNING", value: kpi.tier_counts.WARNING },
    { label: "CRITICAL", value: kpi.tier_counts.CRITICAL },
    { label: "On-time", value: `${kpi.on_time_rate_pct}%` },
    { label: "Auto-exec", value: `${kpi.auto_execute_rate_pct}%` },
    { label: "CO₂ saved", value: `${kpi.co2_saved_today_kg} kg` },
    { label: "Avg latency", value: `${kpi.avg_decision_latency_ms} ms` },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded border border-slate-700 bg-slate-800/40 p-3"
        >
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {item.label}
          </div>
          <div className="mt-1 font-mono text-xl tabular-nums text-slate-100">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
