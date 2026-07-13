import { lazy, Suspense, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/decide.$shipmentId";
import { getShipments, decide } from "~/lib/data";
import type { DecideResponse } from "~/lib/types";
import { TierBadge } from "~/components/TierBadge";
import { RouteCards } from "~/components/RouteCards";
import { ConfidencePanel } from "~/components/ConfidencePanel";
import { ShapChart } from "~/components/ShapChart";

// RouteMap is client-only (leaflet touches `window`); lazy so its module isn't
// evaluated during SSR. It only ever renders inside the client-set `result` block.
const RouteMap = lazy(() => import("~/components/RouteMap"));

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `SLAra — Decide ${params.shipmentId}` }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const { shipments } = await getShipments();
  const shipment = shipments.find((s) => s.shipment_id === params.shipmentId);
  if (!shipment) {
    throw new Response("Shipment not found", { status: 404 });
  }
  return { shipment };
}

export default function DecisionView({ loaderData }: Route.ComponentProps) {
  const { shipment } = loaderData;
  const [result, setResult] = useState<DecideResponse | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runDecide() {
    setLoading(true);
    setError(null);
    try {
      const res = await decide(shipment.shipment_id);
      setResult(res);
      setSelectedRouteId(res.selected_route_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decide failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-base px-4 py-6 text-ink">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-baseline justify-between border-b border-line pb-4">
          <div>
            <Link
              to="/"
              className="text-xs font-medium uppercase tracking-widest text-accent hover:underline"
            >
              ← Risk Monitor
            </Link>
            <h1 className="mt-0.5 font-mono text-xl font-semibold tracking-tight">
              {shipment.shipment_id}
            </h1>
          </div>
          <TierBadge tier={shipment.risk_tier} />
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryItem label="Destination" value={shipment.destination.label} />
          <SummaryItem label="SLA" value={shipment.sla_type} />
          <SummaryItem
            label="Distance"
            value={`${shipment.distance_km.toFixed(1)} km`}
            mono
          />
          <SummaryItem label="Vehicle" value={shipment.vehicle_type} />
        </section>

        {!result && (
          <div>
            <button
              type="button"
              onClick={runDecide}
              disabled={loading}
              className="rounded border border-accent/50 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
            >
              {loading ? "Deciding…" : "Run decision (M6)"}
            </button>
          </div>
        )}

        {error && (
          <p className="rounded border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical">
            {error}
          </p>
        )}

        {result && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Left column: map + route comparison (Slice 4) */}
            <div className="space-y-4">
              <div className="h-[420px] overflow-hidden rounded border border-line">
                <Suspense fallback={<MapSkeleton />}>
                  <RouteMap
                    routes={result.routes}
                    origin={shipment.origin_hub}
                    destination={shipment.destination}
                    selectedRouteId={selectedRouteId}
                    onSelect={setSelectedRouteId}
                  />
                </Suspense>
              </div>
              <RouteCards
                routes={result.routes}
                selectedRouteId={selectedRouteId}
                onSelect={setSelectedRouteId}
              />
            </div>

            {/* Right column: confidence panel + SHAP (Slice 5) */}
            <aside className="space-y-4">
              <ConfidencePanel result={result} />
              <ShapChart shap={result.shap_top5} />
              <div className="text-right font-mono text-xs text-muted">
                pipeline latency {result.latency_ms} ms
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

function MapSkeleton() {
  return (
    <div className="flex h-full items-center justify-center bg-surface text-sm text-muted">
      Loading map…
    </div>
  );
}

function SummaryItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded border border-line bg-surface/40 p-3">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 text-sm text-ink${mono ? " font-mono tabular-nums" : ""}`}>
        {value}
      </div>
    </div>
  );
}
