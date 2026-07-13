import { useState } from "react";
import type { Route } from "./+types/home";
import { getKpi, getShipments, dataSource } from "~/lib/data";
import type { RiskTier } from "~/lib/types";
import { KpiStrip } from "~/components/KpiStrip";
import { ShipmentTable } from "~/components/ShipmentTable";
import { FilterTabs, type TierFilter } from "~/components/FilterTabs";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "SLAra — Risk Monitor" },
    { name: "description", content: "SLAra operations control tower" },
  ];
}

export async function loader(_: Route.LoaderArgs) {
  const [kpi, shipments] = await Promise.all([getKpi(), getShipments()]);
  return { kpi, shipments: shipments.shipments, total: shipments.total };
}

export default function RiskMonitor({ loaderData }: Route.ComponentProps) {
  const { kpi, shipments } = loaderData;
  const [filter, setFilter] = useState<TierFilter>("ALL");

  const counts: Record<RiskTier, number> = {
    SAFE: shipments.filter((s) => s.risk_tier === "SAFE").length,
    WARNING: shipments.filter((s) => s.risk_tier === "WARNING").length,
    CRITICAL: shipments.filter((s) => s.risk_tier === "CRITICAL").length,
  };

  // Shared ETA domain so band widths are comparable across rows (SAFE narrow vs
  // WARNING/CRITICAL wide). Padded 5%; guarded against an empty list.
  const domainMax = shipments.length
    ? Math.max(...shipments.map((s) => s.eta_p90_min)) * 1.05
    : 1;

  const visible =
    filter === "ALL"
      ? shipments
      : shipments.filter((s) => s.risk_tier === filter);

  return (
    <main className="min-h-screen bg-base px-4 py-6 text-ink">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-baseline justify-between border-b border-line pb-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-widest text-accent">
              SLAra · Control Tower
            </div>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight">
              Risk Monitor
            </h1>
          </div>
          <p className="text-sm text-muted">
            {shipments.length} active · source{" "}
            <span className="font-mono text-ink">{dataSource}</span>
          </p>
        </header>

        <KpiStrip kpi={kpi} />

        <section className="space-y-3">
          <FilterTabs
            active={filter}
            counts={counts}
            total={shipments.length}
            onChange={setFilter}
          />
          <ShipmentTable shipments={visible} domainMax={domainMax} />
        </section>
      </div>
    </main>
  );
}
