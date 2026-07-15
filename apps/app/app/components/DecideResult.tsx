import type { DecideResponse } from "~/lib/types";
import { TIER_HEX } from "~/lib/tier";
import { ConfidenceBreakdown } from "./ConfidenceBreakdown";
import { ShapChart } from "./ShapChart";
import { TierBadge } from "./TierBadge";
import { EtaBand } from "./EtaBand";
import { ClientOnly } from "./ClientOnly";

// Renders a live POST /shipments/:id/decide response. Field mapping is fixed by
// services/agent/README.md "Pemetaan response /decide -> UI"; the agent's field
// names are the contract, so everything here reads them as-is.

const idr = new Intl.NumberFormat("id-ID");

function humanizeDriver(d: string): string {
  return d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Escalation banner — carries `explanation` + `primary_uncertainty_driver`. */
function ExplanationBanner({ d }: { d: DecideResponse }) {
  const auto = d.decision === "AUTO_EXECUTE";
  return (
    <div
      className={`rounded-[14px] border-2 p-4 ${
        auto
          ? "border-safe/50 bg-safe/10"
          : "border-danger/50 bg-danger/10"
      }`}
      data-testid="decision-banner"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-[13px] font-bold text-white ${
            auto ? "bg-safe" : "bg-danger"
          }`}
        >
          {d.decision.replace("_", " ")}
        </span>
        <span className="text-[13px] tabular-nums text-ink">
          confidence {d.confidence.toFixed(3)}{" "}
          <span className="text-muted">
            {auto ? "≥" : "<"} threshold {d.threshold.toFixed(2)}
          </span>
        </span>
        {d.primary_uncertainty_driver && (
          <span className="rounded-full border border-danger/40 px-2 py-0.5 text-[12px] font-semibold text-danger">
            driver: {humanizeDriver(d.primary_uncertainty_driver)}
          </span>
        )}
        <LatencyBadge ms={d.latency_ms} />
        {d.degraded?.map((x) => (
          <span
            key={x}
            className="rounded-full border border-warning/50 px-2 py-0.5 text-[12px] font-semibold text-warning"
            title="Failure cascade: this model degraded during the decision"
          >
            degraded: {x}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-ink/80">
        {d.explanation}
      </p>
    </div>
  );
}

/** `latency_ms` is the agent's own measurement of the full M2→M1→M3→M4→[M5] fan-out. */
function LatencyBadge({ ms }: { ms: number }) {
  return (
    <span
      className="rounded-full border border-brand/40 px-2 py-0.5 text-[12px] tabular-nums text-brand"
      title="End-to-end M6 orchestration latency measured by the agent (budget: 3000ms)"
    >
      {ms} ms
    </span>
  );
}

/** Live per-shipment ETA (M1 with M2 dwell injected) — not the plan-level numbers. */
function EtaPanel({ d }: { d: DecideResponse }) {
  const eta = d.eta;
  if (!eta) {
    return (
      <div className="glass-card p-4 text-[13px] text-muted">
        ETA unavailable — M1 did not respond (forced escalation).
      </div>
    );
  }
  const slackPositive = eta.slack_p90_min >= 0;
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wide text-brand">
          Live ETA (M1)
        </span>
        <TierBadge tier={eta.risk_tier} />
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[32px] font-bold leading-none tabular-nums text-ink">
          {eta.p50_min}
        </span>
        <span className="text-[13px] text-muted">min P50</span>
        <span className="text-[15px] tabular-nums text-ink/70">
          → {eta.p90_min} min P90
        </span>
      </div>

      <div className="mt-3">
        <EtaBand
          p50={eta.p50_min}
          p90={eta.p90_min}
          domainMax={eta.p90_min * 1.15}
          tier={eta.risk_tier}
        />
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
        <div>
          <dt className="text-muted">Slack @P90</dt>
          <dd
            className={`tabular-nums font-semibold ${
              slackPositive ? "text-safe" : "text-danger"
            }`}
          >
            {slackPositive ? "+" : ""}
            {eta.slack_p90_min} min
          </dd>
        </div>
        <div>
          <dt className="text-muted">CO₂ (M3)</dt>
          <dd className="tabular-nums text-ink">
            {eta.co2_kg === null ? "—" : `${eta.co2_kg} kg`}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Dwell source</dt>
          <dd
            className={
              eta.dwell_source === "m2_live" ? "text-ink" : "text-warning"
            }
          >
            {eta.dwell_source === "m2_live" ? "M2 live" : "fallback"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** Live hub state from M2 (dwell + queue). Null when M2 degraded. */
function HubPanel({ d }: { d: DecideResponse }) {
  const hub = d.hub;
  if (!hub) {
    return (
      <div className="glass-card p-4 text-[13px] text-muted">
        Hub telemetry unavailable — M2 degraded; dwell fell back to the baked
        median and conf_m2 dropped to 0.5.
      </div>
    );
  }
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wide text-brand">
          Hub dwell (M2) — {hub.hub_id}
        </span>
        {hub.dwell_above_threshold && (
          <span className="rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-bold text-warning">
            ABOVE THRESHOLD
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-[32px] font-bold leading-none tabular-nums text-ink">
          {hub.dwell_p50_min}
        </span>
        <span className="text-[13px] text-muted">min P50</span>
        <span className="text-[15px] tabular-nums text-ink/70">
          → {hub.dwell_p90_min} min P90
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
        <div>
          <dt className="text-muted">Queue</dt>
          <dd className="tabular-nums text-ink">{hub.queue.queue_length}</dd>
        </div>
        <div>
          <dt className="text-muted">Trucks</dt>
          <dd className="tabular-nums text-ink">{hub.queue.truck_count}</dd>
        </div>
        <div>
          <dt className="text-muted">Dock util.</dt>
          <dd className="tabular-nums text-ink">
            {Math.round(hub.queue.dock_utilization * 100)}%
          </dd>
        </div>
      </dl>
    </div>
  );
}

/**
 * M4 plan comparison. These are PLAN-LEVEL tour metrics, not this shipment's risk —
 * the agent is explicit about that and so is the heading, to keep the two from being
 * read as the same number.
 */
function RoutesTable({ d }: { d: DecideResponse }) {
  if (d.routes.length === 0) {
    return (
      <div className="glass-card p-4 text-[13px] text-muted">
        No route plans — M4 did not respond (forced escalation).
      </div>
    );
  }
  return (
    <div className="glass-card p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wide text-brand">
          Pareto plan comparison (M4)
        </span>
        <span className="text-[11px] text-muted">
          tour-level metrics · precomputed
        </span>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[12px]">
          <thead>
            <tr className="text-left text-muted">
              <th className="py-1 pr-2 font-medium">Plan</th>
              <th className="py-1 pr-2 text-right font-medium">Tour P50</th>
              <th className="py-1 pr-2 text-right font-medium">Tour P90</th>
              <th className="py-1 pr-2 text-right font-medium">Late @P90</th>
              <th className="py-1 pr-2 text-right font-medium">Cost</th>
              <th className="py-1 pr-2 text-right font-medium">CO₂</th>
              <th className="py-1 pr-2 text-right font-medium">Tier</th>
            </tr>
          </thead>
          <tbody>
            {d.routes.map((r) => {
              const selected = r.route_id === d.selected_route_id;
              return (
                <tr
                  key={r.route_id}
                  className={`border-t border-brand/20 ${
                    selected ? "bg-ink/5 font-semibold" : ""
                  }`}
                  data-selected={selected || undefined}
                >
                  <td className="py-1.5 pr-2">
                    <span className="flex items-center gap-1.5">
                      {selected && (
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ background: TIER_HEX[r.risk_tier] }}
                          aria-hidden
                        />
                      )}
                      <span className="text-ink">{r.label}</span>
                      {selected && (
                        <span className="rounded-full bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">
                          SELECTED
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-ink">
                    {r.eta_p50_min}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-ink">
                    {r.eta_p90_min}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-ink">
                    {r.late_share_p90 == null
                      ? "—"
                      : `${Math.round(r.late_share_p90 * 100)}%`}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-ink">
                    Rp {idr.format(r.cost_idr)}
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums text-ink">
                    {r.co2_kg}
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    <TierBadge tier={r.risk_tier} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DecideResult({ d }: { d: DecideResponse }) {
  return (
    <div className="space-y-4" data-testid="decide-result">
      <ExplanationBanner d={d} />

      <div className="grid gap-4 lg:grid-cols-2">
        <EtaPanel d={d} />
        <HubPanel d={d} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card p-4">
          <div className="text-center">
            <div
              className={`text-[44px] font-bold leading-none tabular-nums ${
                d.decision === "AUTO_EXECUTE" ? "text-safe" : "text-danger"
              }`}
            >
              {(d.confidence * 100).toFixed(1)}%
            </div>
            <div className="mt-1 text-[13px] text-brand">
              Aggregate decision confidence
            </div>
          </div>

          {/* Gauge with the 0.70 threshold marked, so pass/fail is visible not asserted. */}
          <div className="relative mt-3 h-4 w-full overflow-hidden rounded-full bg-brand/25">
            <div
              className={`h-full rounded-full ${
                d.decision === "AUTO_EXECUTE" ? "bg-safe" : "bg-danger"
              }`}
              style={{
                width: `${Math.min(Math.max(d.confidence, 0), 1) * 100}%`,
              }}
            />
            <div
              className="absolute inset-y-0 w-0.5 bg-ink"
              style={{ left: `${d.threshold * 100}%` }}
              title={`Threshold ${d.threshold}`}
            />
          </div>
          <div
            className="mt-1 text-[11px] text-muted"
            style={{ marginLeft: `${d.threshold * 100}%` }}
          >
            ↑ {d.threshold.toFixed(2)}
          </div>

          {d.confidence_breakdown ? (
            <div className="mt-4">
              <ConfidenceBreakdown breakdown={d.confidence_breakdown} />
            </div>
          ) : (
            <p className="mt-4 text-[13px] text-muted">
              No breakdown — a critical model was unavailable, so the decision was
              escalated without scoring.
            </p>
          )}
        </div>

        <div className="glass-card p-4">
          <div className="text-[12px] font-bold uppercase tracking-wide text-brand">
            ETA drivers (M5 · SHAP top-5)
          </div>
          <ClientOnly fallback={<ChartFallback />}>
            {() => <ShapChart shap={d.shap_top5} />}
          </ClientOnly>
        </div>
      </div>

      <RoutesTable d={d} />
    </div>
  );
}

function ChartFallback() {
  return (
    <div className="flex h-56 items-center justify-center text-sm text-brand">
      Loading chart…
    </div>
  );
}
