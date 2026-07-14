import { lazy, Suspense, useState } from "react";
import type { Route } from "./+types/optimization";
import { getOptimization } from "~/lib/data";
import { PageHeader } from "~/components/PageHeader";
import { ClientOnly } from "~/components/ClientOnly";
import { GaConvergenceChart } from "~/components/GaConvergenceChart";
import { ParetoStats, WeightTuningPanel } from "~/components/ParetoStats";
import { ParetoTable } from "~/components/ParetoTable";

const RouteMap = lazy(() => import("~/components/RouteMap"));

export function meta(_: Route.MetaArgs) {
  return [{ title: "SLAra — Route Optimization" }];
}

export async function loader(_: Route.LoaderArgs) {
  return { result: await getOptimization() };
}

export default function Optimization({ loaderData }: Route.ComponentProps) {
  const { result } = loaderData;
  const rv = result.route_view;
  const [selectedRouteId, setSelectedRouteId] = useState(rv.selected_route_id);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHeader
        title="Route Optimization Result"
        subtitle="NSGA-II Genetic Algorithm"
      />

      <div className="space-y-1 text-[14px]">
        <div>
          <span className="font-bold text-brand">Objectives: </span>
          <span className="text-ink">{result.objectives.join(" · ")}</span>
        </div>
        <div>
          <span className="font-bold text-brand">Constraints: </span>
          <span className="text-ink">{result.constraints.join(" · ")}</span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-2 lg:col-span-2">
          <h2 className="text-[22px] font-bold text-brand">GA Convergence</h2>
          <p className="text-[14px] text-ink/70">Fitness evolution over generations</p>
          <div className="glass-card p-4">
            <ClientOnly fallback={<ChartFallback />}>
              {() => <GaConvergenceChart data={result.convergence} />}
            </ClientOnly>
          </div>
        </section>

        <div className="space-y-5">
          <ParetoStats stats={result.stats} />
          <WeightTuningPanel weights={result.weights} />
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-[22px] font-bold text-brand">
          Pareto Plan Comparison
        </h2>
        <p className="text-[14px] text-ink/70">
          Click a route on the map or a table row — the two stay in sync
        </p>
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="glass-card h-[360px] p-0 lg:col-span-2">
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
                      colorMode="selection"
                    />
                  </Suspense>
                )}
              </ClientOnly>
            </div>
          </div>
          <div className="lg:col-span-3">
            <ParetoTable
              plans={result.plans}
              selectedId={selectedRouteId}
              onSelect={setSelectedRouteId}
            />
          </div>
        </div>
      </section>

      <div className="glass-card border-accent/50 p-5">
        <div className="flex items-center gap-2 text-[15px] font-bold text-accent">
          <span aria-hidden="true">⚙️</span> Optimizer Note
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-ink/80">
          {result.note}
        </p>
      </div>
    </div>
  );
}

function ChartFallback() {
  return (
    <div className="flex h-[300px] items-center justify-center text-sm text-brand">
      Loading chart…
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
