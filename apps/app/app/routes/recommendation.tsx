import { lazy, Suspense, useState } from "react";
import type { Route } from "./+types/recommendation";
import { getRecommendation } from "~/lib/data";
import { PageHeader } from "~/components/PageHeader";
import { EventBanner } from "~/components/EventBanner";
import { PlanComparison } from "~/components/PlanComparison";
import { AgentNetwork } from "~/components/AgentNetwork";
import { ConfidenceScorePanel } from "~/components/ConfidenceScorePanel";
import { AgentReasoningTrace } from "~/components/AgentReasoningTrace";
import { DecisionActionBar } from "~/components/DecisionActionBar";
import { ClientOnly } from "~/components/ClientOnly";
import { TierBadge } from "~/components/TierBadge";
import { EtaBand } from "~/components/EtaBand";
import { ShapChart } from "~/components/ShapChart";

const RouteMap = lazy(() => import("~/components/RouteMap"));
const idr = new Intl.NumberFormat("id-ID");

export function meta(_: Route.MetaArgs) {
  return [{ title: "SLAra — AI Recommendation" }];
}

export async function loader(_: Route.LoaderArgs) {
  return { detail: await getRecommendation() };
}

export default function Recommendation({ loaderData }: Route.ComponentProps) {
  const { detail } = loaderData;
  const rv = detail.route_view;
  const [selectedRouteId, setSelectedRouteId] = useState(rv.selected_route_id);

  const domainMax =
    Math.max(...rv.routes.map((r) => r.eta_p90_min), 1) * 1.05;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHeader
        title="AI Recommendation Detail"
        subtitle="LangGraph multi-agent reasoning"
      />

      <EventBanner event={detail.event} />
      <PlanComparison current={detail.current_plan} ai={detail.ai_plan} />

      {/* Route comparison + ETA explainability (reused RouteMap / EtaBand / TierBadge / ShapChart) */}
      <section className="space-y-2">
        <h2 className="text-[22px] font-bold text-brand">
          Route Comparison &amp; ETA Explainability
        </h2>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="glass-card h-[380px] p-0">
            <div className="h-full w-full overflow-hidden rounded-[21px]">
              <ClientOnly fallback={<MapFallback />}>
                {() => (
                  <Suspense fallback={<MapFallback />}>
                    <RouteMap
                      routes={rv.routes}
                      origin={rv.origin}
                      destination={rv.destination}
                      selectedRouteId={selectedRouteId}
                      onSelect={setSelectedRouteId}
                    />
                  </Suspense>
                )}
              </ClientOnly>
            </div>
          </div>

          <div className="space-y-3">
            {rv.routes.map((r) => {
              const selected = r.route_id === selectedRouteId;
              return (
                <button
                  key={r.route_id}
                  type="button"
                  onClick={() => setSelectedRouteId(r.route_id)}
                  className={`w-full rounded-[14px] border-2 p-3 text-left transition duration-150 hover:-translate-y-0.5 hover:shadow-md ${
                    selected
                      ? "border-ink bg-ink/5"
                      : "border-brand/40 hover:border-brand"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[15px] font-bold text-ink">
                      {r.label}
                    </span>
                    <TierBadge tier={r.risk_tier} />
                  </div>
                  <div className="mt-2">
                    <EtaBand
                      p50={r.eta_p50_min}
                      p90={r.eta_p90_min}
                      domainMax={domainMax}
                      tier={r.risk_tier}
                    />
                  </div>
                  <div className="mt-2 flex gap-4 text-[12px] text-muted">
                    <span>Rp {idr.format(r.cost_idr)}</span>
                    <span>{r.co2_kg} kg</span>
                    <span>{r.distance_km} km</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="glass-card p-4">
          <div className="text-[13px] font-bold uppercase tracking-wide text-brand">
            ETA drivers — {detail.recommended_plan} (SHAP · minutes)
          </div>
          <ClientOnly fallback={<ChartFallback />}>
            {() => <ShapChart shap={detail.eta_shap} />}
          </ClientOnly>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-[22px] font-bold text-brand">
            LangGraph Agent Network
          </h2>
          <div className="glass-card p-5">
            <AgentNetwork agents={detail.agents} />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-[22px] font-bold text-brand">Confidence Score</h2>
          <ConfidenceScorePanel c={detail.confidence} />
        </section>
      </div>

      <section className="space-y-2">
        <h2 className="text-[22px] font-bold text-brand">
          Agent Reasoning Trace
        </h2>
        <AgentReasoningTrace trace={detail.trace} />
      </section>

      <DecisionActionBar
        affected={detail.event.affected}
        planTitle={detail.recommended_plan}
      />
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

function ChartFallback() {
  return (
    <div className="flex h-56 items-center justify-center text-sm text-brand">
      Loading chart…
    </div>
  );
}
