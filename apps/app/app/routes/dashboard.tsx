import { lazy, Suspense } from "react";
import type { Route } from "./+types/dashboard";
import { getDashboard, getKpi } from "~/lib/data";
import { buildKpiCards } from "~/lib/kpi-cards";
import { PageHeader } from "~/components/PageHeader";
import { Clock } from "~/components/Clock";
import { ProcessSteps } from "~/components/ProcessSteps";
import { DashboardKpis } from "~/components/DashboardKpis";
import { EventFeed } from "~/components/EventFeed";
import { ActiveRecommendationCard } from "~/components/ActiveRecommendationCard";
import { ClientOnly } from "~/components/ClientOnly";

const MiniMap = lazy(() => import("~/components/MiniMap"));

export function meta(_: Route.MetaArgs) {
  return [{ title: "SLAra — Dashboard" }];
}

export async function loader(_: Route.LoaderArgs) {
  // KPI numbers come live from the agent; the rest of the page (process steps,
  // map, event feed) is still fixture-backed.
  const [data, kpi] = await Promise.all([getDashboard(), getKpi()]);
  return { data, kpi };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { data, kpi } = loaderData;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHeader
        title="AI Logistic Control Tower"
        subtitle="Jabodetabek Region"
        right={<Clock />}
      />

      <ProcessSteps steps={data.process_steps} />
      <DashboardKpis kpis={buildKpiCards(kpi)} />

      <section className="space-y-2">
        <h2 className="text-[22px] font-bold text-brand">Live Event Feed</h2>
        <EventFeed events={data.events} />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-2 lg:col-span-2">
          <h2 className="text-[22px] font-bold text-brand">
            Fleet Intelligence Panel
          </h2>
          <p className="text-[14px] text-ink/70">
            All trucks are monitored lightly. AI performs deep analysis only for
            affected or high-risk trucks.
          </p>
          <div className="glass-card h-[420px] p-0">
            <div className="h-full w-full overflow-hidden rounded-[21px]">
              <ClientOnly fallback={<MapFallback />}>
                {() => (
                  <Suspense fallback={<MapFallback />}>
                    <MiniMap
                      center={data.map.center}
                      zoom={12}
                      markers={data.map.markers}
                    />
                  </Suspense>
                )}
              </ClientOnly>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-[22px] font-bold text-brand">
            Active Recommendation
          </h2>
          <ActiveRecommendationCard rec={data.recommendation} />
        </section>
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
