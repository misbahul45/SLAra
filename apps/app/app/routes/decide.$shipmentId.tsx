import { lazy, Suspense, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/decide.$shipmentId";
import { getShipments, decide, resolve } from "~/lib/data";
import type { DecideResponse, ResolveAction, ResolveResponse } from "~/lib/types";
import { TierBadge } from "~/components/TierBadge";
import { RouteCards } from "~/components/RouteCards";
import { ConfidencePanel } from "~/components/ConfidencePanel";
import { ShapChart } from "~/components/ShapChart";
import { OperatorPanel } from "~/components/OperatorPanel";
import { Modal } from "~/components/Modal";

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

  // Operator resolve flow
  const [resolved, setResolved] = useState<ResolveResponse | null>(null);
  const [pendingAction, setPendingAction] = useState<ResolveAction | null>(null);
  const [note, setNote] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const selectedRoute = result?.routes.find(
    (r) => r.route_id === selectedRouteId,
  );

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

  async function confirmResolve() {
    if (!pendingAction) return;
    setResolving(true);
    setResolveError(null);
    try {
      const res = await resolve(shipment.shipment_id, {
        action: pendingAction,
        route_id: selectedRouteId,
        operator_note: note || undefined,
      });
      setResolved(res);
      setPendingAction(null);
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setResolving(false);
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
          <div className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Left column: map + route comparison */}
              <div className="space-y-4">
                <div className="h-105 overflow-hidden rounded border border-line">
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

              {/* Right column: confidence panel + SHAP */}
              <aside className="space-y-4">
                <ConfidencePanel result={result} />
                <ShapChart shap={result.shap_top5} />
                <div className="text-right font-mono text-xs text-muted">
                  pipeline latency {result.latency_ms} ms
                </div>
              </aside>
            </div>

            {/* Full-width decision outcome / operator flow */}
            {result.decision === "AUTO_EXECUTE" ? (
              <Banner tone="safe">
                Executed automatically — route{" "}
                <span className="font-mono">{result.selected_route_id}</span> (
                {selectedRoute?.label}). Confidence{" "}
                {result.confidence.toFixed(2)} cleared the{" "}
                {result.threshold.toFixed(2)} threshold.
              </Banner>
            ) : resolved ? (
              <Banner tone={resolved.decision_status === "APPROVED" ? "safe" : "critical"}>
                {resolved.decision_status === "APPROVED" ? (
                  <>
                    Approved &amp; executed — route{" "}
                    <span className="font-mono">
                      {resolved.executed_route_id}
                    </span>
                    .
                  </>
                ) : (
                  <>Rejected — flagged for follow-up.</>
                )}{" "}
                <span className="text-muted">
                  {new Date(resolved.resolved_at).toLocaleTimeString()}
                </span>
              </Banner>
            ) : (
              <OperatorPanel
                selectedRoute={selectedRoute}
                note={note}
                onNoteChange={setNote}
                onApprove={() => setPendingAction("APPROVE")}
                onReject={() => setPendingAction("REJECT")}
              />
            )}
          </div>
        )}
      </div>

      <Modal
        open={pendingAction !== null}
        title={
          pendingAction === "APPROVE"
            ? "Approve & execute route"
            : "Reject decision"
        }
        onClose={() => {
          if (!resolving) setPendingAction(null);
        }}
      >
        <p className="text-sm text-muted">
          {pendingAction === "APPROVE" ? (
            <>
              Execute route{" "}
              <span className="font-mono text-ink">{selectedRouteId}</span> (
              {selectedRoute?.label}) for{" "}
              <span className="font-mono text-ink">{shipment.shipment_id}</span>?
            </>
          ) : (
            <>
              Reject the recommendation for{" "}
              <span className="font-mono text-ink">{shipment.shipment_id}</span>?
              It will be flagged for follow-up.
            </>
          )}
        </p>
        {note && (
          <p className="mt-2 text-xs text-muted">Note: “{note}”</p>
        )}
        {resolveError && (
          <p className="mt-2 text-sm text-critical">{resolveError}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPendingAction(null)}
            disabled={resolving}
            className="rounded border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmResolve}
            disabled={resolving}
            className={`rounded px-3 py-1.5 text-sm font-medium text-[#0e1420] disabled:opacity-50 ${
              pendingAction === "APPROVE" ? "bg-safe" : "bg-critical"
            }`}
          >
            {resolving ? "Working…" : "Confirm"}
          </button>
        </div>
      </Modal>
    </main>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "safe" | "critical";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "safe"
      ? "border-safe/40 bg-safe/10 text-safe"
      : "border-critical/40 bg-critical/10 text-critical";
  return (
    <div className={`rounded border px-4 py-3 text-sm ${toneClass}`}>
      {children}
    </div>
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
