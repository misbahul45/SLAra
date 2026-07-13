import { Link } from "react-router";
import type { Shipment } from "~/lib/types";

// Slice 1: raw shipment table from the loader. TierBadge + EtaBand + filter tabs
// arrive in Slice 2; the /decide route the link points to arrives in Slice 3.

const COLUMNS = [
  "Shipment",
  "Destination",
  "SLA",
  "ETA P50→P90 (min)",
  "Tier",
  "Dwell (min)",
  "CO₂ (kg)",
  "Status",
  "",
] as const;

export function ShipmentTable({ shipments }: { shipments: Shipment[] }) {
  return (
    <div className="overflow-x-auto rounded border border-slate-700">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-800/60 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            {COLUMNS.map((col) => (
              <th key={col} className="whitespace-nowrap px-3 py-2 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {shipments.map((s) => (
            <tr key={s.shipment_id} className="hover:bg-slate-800/30">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-200">
                {s.shipment_id}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-300">
                {s.destination.label}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                {s.sla_type}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-slate-200">
                {s.eta_p50_min.toFixed(1)} → {s.eta_p90_min.toFixed(1)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-slate-200">
                {s.risk_tier}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-slate-300">
                {s.hub_dwell_p50_min.toFixed(1)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums text-slate-300">
                {s.co2_kg.toFixed(2)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-400">
                {s.decision_status}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                <Link
                  to={`/decide/${s.shipment_id}`}
                  className="text-sky-400 underline-offset-2 hover:underline"
                >
                  Decide →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
