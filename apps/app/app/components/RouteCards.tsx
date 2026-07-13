import type { RouteOption } from "~/lib/types";
import { EtaBand } from "./EtaBand";
import { TierBadge } from "./TierBadge";

// 3-way Pareto route comparison. Selected card is highlighted and kept in sync with
// the map via shared selectedRouteId state in View B.

const idr = new Intl.NumberFormat("id-ID");

interface RouteCardsProps {
  routes: RouteOption[];
  selectedRouteId: string;
  onSelect: (routeId: string) => void;
}

export function RouteCards({
  routes,
  selectedRouteId,
  onSelect,
}: RouteCardsProps) {
  // Shared ETA domain across the 3 routes so band widths are comparable.
  const domainMax = routes.length
    ? Math.max(...routes.map((r) => r.eta_p90_min)) * 1.05
    : 1;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {routes.map((r) => {
        const selected = r.route_id === selectedRouteId;
        return (
          <button
            key={r.route_id}
            type="button"
            onClick={() => onSelect(r.route_id)}
            className={`rounded border p-3 text-left transition-colors ${
              selected
                ? "border-accent bg-accent/5 ring-1 ring-accent/40"
                : "border-line bg-surface/40 hover:border-muted"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-ink">{r.label}</span>
              <TierBadge tier={r.risk_tier} />
            </div>
            <div className="mt-0.5 font-mono text-xs text-muted">
              {r.route_id}
            </div>

            <div className="mt-3">
              <EtaBand
                p50={r.eta_p50_min}
                p90={r.eta_p90_min}
                domainMax={domainMax}
                tier={r.risk_tier}
              />
            </div>

            <dl className="mt-3 space-y-1 text-xs">
              <MetricRow label="Cost" value={`Rp ${idr.format(r.cost_idr)}`} />
              <MetricRow label="CO₂" value={`${r.co2_kg.toFixed(2)} kg`} />
              <MetricRow label="Distance" value={`${r.distance_km.toFixed(1)} km`} />
            </dl>
          </button>
        );
      })}
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-mono tabular-nums text-ink">{value}</dd>
    </div>
  );
}
