import { lazy, Suspense } from "react";
import type { Route } from "./+types/fleet";
import { getFleet } from "~/lib/data";
import { PageHeader } from "~/components/PageHeader";
import { ClientOnly } from "~/components/ClientOnly";
import { VehicleTelemetryPanel } from "~/components/VehicleTelemetryPanel";
import { MapFallback } from "~/components/Fallbacks";

export { RouteErrorBoundary as ErrorBoundary } from "~/components/RouteError";

const MiniMap = lazy(() => import("~/components/MiniMap"));

export function meta(_: Route.MetaArgs) {
  return [{ title: "SLAra — Live Fleet Map" }];
}

export async function loader(_: Route.LoaderArgs) {
  return { fleet: await getFleet() };
}

export default function Fleet({ loaderData }: Route.ComponentProps) {
  const { fleet } = loaderData;

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title="Live Fleet Map" subtitle="Real-time vehicle telemetry" />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="glass-card h-[500px] p-0 lg:h-[760px]">
            <div className="h-full w-full overflow-hidden rounded-[21px]">
              <ClientOnly fallback={<MapFallback />}>
                {() => (
                  <Suspense fallback={<MapFallback />}>
                    <MiniMap
                      center={fleet.selected.map_center}
                      zoom={12}
                      markers={fleet.markers}
                    />
                  </Suspense>
                )}
              </ClientOnly>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 lg:h-[760px]">
          <VehicleTelemetryPanel v={fleet.selected} />
        </div>
      </div>
    </div>
  );
}
