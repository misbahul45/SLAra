import type { Route } from "./+types/home";
import { getKpi, getShipments, dataSource } from "~/lib/data";
import { KpiStrip } from "~/components/KpiStrip";
import { ShipmentTable } from "~/components/ShipmentTable";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "SLAra — Risk Monitor" },
    { name: "description", content: "SLAra operations control tower" },
  ];
}

export async function loader(_: Route.LoaderArgs) {
  const [kpi, shipments] = await Promise.all([getKpi(), getShipments()]);
  return { kpi, shipments: shipments.shipments, total: shipments.total };
}

export default function RiskMonitor({ loaderData }: Route.ComponentProps) {
  const { kpi, shipments, total } = loaderData;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              Risk Monitor
            </h1>
            <p className="text-sm text-slate-400">
              {total} active shipments · data source:{" "}
              <span className="font-mono">{dataSource}</span>
            </p>
          </div>
        </header>

        <KpiStrip kpi={kpi} />
        <ShipmentTable shipments={shipments} />
      </div>
    </main>
  );
}
