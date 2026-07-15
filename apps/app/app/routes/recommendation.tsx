import { lazy, Suspense, useState } from "react";
import type { Route } from "./+types/recommendation";
import { decide as decideApi, getShipments } from "~/lib/data";
import type { DecideResponse, Shipment } from "~/lib/types";
import { PageHeader } from "~/components/PageHeader";
import { DecideResult } from "~/components/DecideResult";
import { ClientOnly } from "~/components/ClientOnly";
import { TierBadge } from "~/components/TierBadge";

const RouteMap = lazy(() => import("~/components/RouteMap"));

export function meta(_: Route.MetaArgs) {
  return [{ title: "SLAra — AI Recommendation" }];
}

export async function loader(_: Route.LoaderArgs) {
  // Live: the agent enriches every shipment through M2 -> M1 -> M3 on first call.
  const { shipments } = await getShipments();
  return { shipments };
}

export default function Recommendation({ loaderData }: Route.ComponentProps) {
  const { shipments } = loaderData;
  const [selectedId, setSelectedId] = useState(
    shipments[0]?.shipment_id ?? "",
  );
  const [result, setResult] = useState<DecideResponse | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);

  // /decide returns route geometry but not the shipment's endpoints, so the map
  // takes those from the shipment record.
  const selectedShipment = shipments.find(
    (s: Shipment) => s.shipment_id === selectedId,
  );

  async function runDecide(id: string) {
    setSelectedId(id);
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const d = await decideApi(id);
      setResult(d);
      setRouteId(d.selected_route_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decide failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHeader
        title="AI Recommendation Detail"
        // ADR-002: M6 is a deterministic orchestration core. LangGraph is deferred,
        // so the page must not claim it.
        subtitle="M6 deterministic orchestration — M2 → M1 → M3 → M4 → M5"
      />

      <section className="glass-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[240px]">
            <span className="text-[12px] font-bold uppercase tracking-wide text-brand">
              Shipment
            </span>
            <select
              className="mt-1 w-full rounded-[10px] border-2 border-brand/40 bg-white p-2 text-[14px] text-ink"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {shipments.map((s: Shipment) => (
                <option key={s.shipment_id} value={s.shipment_id}>
                  {s.shipment_id} — {s.origin_hub.name ?? s.origin_hub.hub_id} →{" "}
                  {s.destination.label} ({s.risk_tier ?? "—"})
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => runDecide(selectedId)}
            disabled={pending || !selectedId}
            className="rounded-[10px] bg-accent px-5 py-2.5 text-[14px] font-bold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
            data-testid="decide-button"
          >
            {pending ? "Deciding…" : "Decide"}
          </button>
        </div>

        {/* Quick access to the two canonical demo paths. */}
        <div className="mt-3 flex flex-wrap gap-2">
          {shipments.slice(0, 12).map((s: Shipment) => (
            <button
              key={s.shipment_id}
              type="button"
              onClick={() => runDecide(s.shipment_id)}
              disabled={pending}
              className={`rounded-full border px-3 py-1 text-[12px] transition hover:-translate-y-0.5 disabled:opacity-60 ${
                s.shipment_id === selectedId
                  ? "border-ink bg-ink/5 font-semibold text-ink"
                  : "border-brand/40 text-ink/70"
              }`}
            >
              <span className="mr-1.5">{s.shipment_id.replace("SHP-2026-", "")}</span>
              {s.risk_tier && <TierBadge tier={s.risk_tier} />}
            </button>
          ))}
        </div>
      </section>

      {pending && <DecidePending />}

      {error && (
        <div className="rounded-[14px] border-2 border-danger/50 bg-danger/10 p-4 text-[13px] text-danger">
          <strong className="font-bold">Decide failed.</strong> {error}
          <div className="mt-1 text-ink/70">
            Is the agent up on :3000 (and ai on :8000)?
          </div>
        </div>
      )}

      {result && !pending && (
        <>
          <DecideResult d={result} />

          {result.routes.length > 0 && selectedShipment && (
            <section className="space-y-2">
              <h2 className="text-[22px] font-bold text-brand">
                Route geometry — {result.selected_route_id} selected
              </h2>
              <div className="glass-card h-[380px] p-0">
                <div className="h-full w-full overflow-hidden rounded-[21px]">
                  <ClientOnly fallback={<MapFallback />}>
                    {() => (
                      <Suspense fallback={<MapFallback />}>
                        <RouteMap
                          routes={result.routes}
                          origin={selectedShipment.origin_hub}
                          destination={selectedShipment.destination}
                          selectedRouteId={routeId ?? result.selected_route_id ?? ""}
                          onSelect={setRouteId}
                        />
                      </Suspense>
                    )}
                  </ClientOnly>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {!result && !pending && !error && (
        <div className="glass-card p-8 text-center text-[14px] text-muted">
          Pick a shipment and hit <strong className="text-ink">Decide</strong> to
          run the live M6 pipeline.
        </div>
      )}
    </div>
  );
}

function DecidePending() {
  return (
    <div className="glass-card p-8" data-testid="decide-pending">
      <div className="flex items-center justify-center gap-3">
        <span
          className="h-5 w-5 animate-spin rounded-full border-2 border-brand/30 border-t-accent"
          aria-hidden
        />
        <span className="text-[14px] text-brand">
          Running M6 pipeline — M2 dwell → M1 ETA → M3 carbon → M4 routes → M5
          explain…
        </span>
      </div>
    </div>
  );
}

function MapFallback() {
  return (
    <div className="flex h-full items-center justify-center bg-white/40 text-sm text-brand">
      Loading map…
    </div>
  );
}
