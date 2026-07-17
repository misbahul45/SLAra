import { useState } from "react";
import { useRevalidator } from "react-router";
import type { Route } from "./+types/approvals";
import {
  decide as decideApi,
  getShipments,
  resolve as resolveApi,
} from "~/lib/data";
import type { DecideResponse, Shipment } from "~/lib/types";
import { PageHeader } from "~/components/PageHeader";
import { DecideResult } from "~/components/DecideResult";
import { TierBadge } from "~/components/TierBadge";

export { RouteErrorBoundary as ErrorBoundary } from "~/components/RouteError";

// Human-in-the-loop queue, live against the agent. A shipment lands here when
// /decide returns ESCALATE (the agent sets decision_status = ESCALATED); Approve /
// Reject call POST /shipments/:id/resolve with the operator's chosen route.

export function meta(_: Route.MetaArgs) {
  return [{ title: "SLAra — Human Approval" }];
}

export async function loader(_: Route.LoaderArgs) {
  const { shipments } = await getShipments();
  return { shipments };
}

const QUEUED = ["ESCALATED"];
const RESOLVED = ["APPROVED", "REJECTED"];

export default function Approvals({ loaderData }: Route.ComponentProps) {
  const { shipments } = loaderData;
  const revalidator = useRevalidator();

  const queue = shipments.filter((s: Shipment) =>
    QUEUED.includes(s.decision_status),
  );
  const resolved = shipments.filter((s: Shipment) =>
    RESOLVED.includes(s.decision_status),
  );

  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<DecideResponse | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function openDetail(id: string) {
    setSelectedId(id);
    setDetail(null);
    setError(null);
    setPending(true);
    try {
      // Re-run the pipeline to show the operator the evidence behind the escalation.
      const d = await decideApi(id);
      setDetail(d);
      setRouteId(d.selected_route_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load decision");
    } finally {
      setPending(false);
    }
  }

  async function submit(action: "APPROVE" | "REJECT") {
    if (!selectedId) return;
    setResolving(true);
    setError(null);
    try {
      await resolveApi(selectedId, {
        action,
        // route_id only carries meaning for APPROVE; REJECT executes nothing.
        ...(action === "APPROVE" && routeId ? { route_id: routeId } : {}),
        ...(note.trim() ? { operator_note: note.trim() } : {}),
      });
      setDetail(null);
      setSelectedId("");
      setNote("");
      revalidator.revalidate(); // pull fresh decision_status from the agent
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resolve failed");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title="Human Approval"
        subtitle="Human-in-the-loop queue — decisions M6 was not confident enough to auto-execute (confidence < 0.70)"
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-1">
          <h2 className="text-[22px] font-bold text-brand">
            Pending Queue{" "}
            <span className="text-[15px] font-normal text-muted">
              ({queue.length})
            </span>
          </h2>

          {queue.length === 0 && (
            <div className="glass-card p-5 text-[13px] text-muted">
              Queue empty. Run <strong className="text-ink">Decide</strong> on the
              AI Recommendation view — anything scoring below the 0.70 threshold
              escalates to here.
            </div>
          )}

          {queue.map((s: Shipment) => (
            <button
              key={s.shipment_id}
              type="button"
              onClick={() => openDetail(s.shipment_id)}
              className={`w-full rounded-[14px] border-2 p-3 text-left transition hover:-translate-y-0.5 ${
                s.shipment_id === selectedId
                  ? "border-ink bg-ink/5"
                  : "border-brand/40 hover:border-brand"
              }`}
              data-testid="queue-item"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-bold text-ink">
                  {s.shipment_id}
                </span>
                {s.risk_tier && <TierBadge tier={s.risk_tier} />}
              </div>
              <div className="mt-1 text-[12px] text-muted">
                {s.origin_hub.name ?? s.origin_hub.hub_id} → {s.destination.label}
              </div>
              {s.eta_p50_min != null && (
                <div className="mt-1 text-[12px] tabular-nums text-ink/70">
                  ETA {s.eta_p50_min}–{s.eta_p90_min} min
                </div>
              )}
            </button>
          ))}

          {resolved.length > 0 && (
            <div className="pt-2">
              <h3 className="text-[13px] font-bold uppercase tracking-wide text-brand">
                Resolved
              </h3>
              <ul className="mt-2 space-y-1">
                {resolved.map((s: Shipment) => (
                  <li
                    key={s.shipment_id}
                    className="flex items-center justify-between rounded-[10px] border border-brand/30 px-3 py-2 text-[12px]"
                    data-testid="resolved-item"
                  >
                    <span className="text-ink">{s.shipment_id}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${
                        s.decision_status === "APPROVED" ? "bg-safe" : "bg-danger"
                      }`}
                    >
                      {s.decision_status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="space-y-4 lg:col-span-2">
          {pending && (
            <div className="glass-card p-8 text-center">
              <span
                className="mx-auto block h-5 w-5 animate-spin rounded-full border-2 border-brand/30 border-t-accent"
                aria-hidden
              />
              <p className="mt-2 text-[13px] text-brand">
                Loading decision evidence…
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-[14px] border-2 border-danger/50 bg-danger/10 p-4 text-[13px] text-danger">
              {error}
            </div>
          )}

          {!detail && !pending && !error && (
            <div className="glass-card p-8 text-center text-[14px] text-muted">
              Select an escalation to review the evidence.
            </div>
          )}

          {detail && !pending && (
            <>
              <DecideResult d={detail} />

              <div className="glass-card p-4">
                <div className="text-[12px] font-bold uppercase tracking-wide text-brand">
                  Operator decision
                </div>

                <label className="mt-2 block">
                  <span className="text-[12px] text-muted">Execute route</span>
                  <select
                    className="mt-1 w-full rounded-[10px] border-2 border-brand/40 bg-white p-2 text-[14px] text-ink"
                    value={routeId ?? ""}
                    onChange={(e) => setRouteId(e.target.value)}
                  >
                    {detail.routes.map((r) => (
                      <option key={r.route_id} value={r.route_id}>
                        {r.label} ({r.route_id})
                        {r.route_id === detail.selected_route_id
                          ? " — AI proposed"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-2 block">
                  <span className="text-[12px] text-muted">Note (optional)</span>
                  <input
                    className="mt-1 w-full rounded-[10px] border-2 border-brand/40 bg-white p-2 text-[14px] text-ink"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Why you approved or rejected…"
                  />
                </label>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => submit("APPROVE")}
                    disabled={resolving || !routeId}
                    className="rounded-[10px] bg-safe px-5 py-2.5 text-[14px] font-bold text-white transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
                    data-testid="approve-button"
                  >
                    {resolving ? "Submitting…" : "Approve & Execute"}
                  </button>
                  <button
                    type="button"
                    onClick={() => submit("REJECT")}
                    disabled={resolving}
                    className="rounded-[10px] border-2 border-danger px-5 py-2.5 text-[14px] font-bold text-danger transition hover:-translate-y-0.5 disabled:opacity-60"
                    data-testid="reject-button"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
