import { Link } from "react-router";
import type { Shipment } from "~/lib/types";
import { TierBadge } from "./TierBadge";
import { EtaBand } from "./EtaBand";

// View A table (Slice 2 polish): TierBadge + EtaBand range bar + control-tower styling.
// The /decide route the action link points to arrives in Slice 3.

const COLUMNS = [
  "Shipment",
  "Destination",
  "SLA",
  "ETA band",
  "Tier",
  "Dwell",
  "CO₂",
  "Status",
  "",
] as const;

interface ShipmentTableProps {
  shipments: Shipment[];
  domainMax: number;
}

export function ShipmentTable({ shipments, domainMax }: ShipmentTableProps) {
  return (
    <div className="overflow-x-auto rounded border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
          <tr>
            {COLUMNS.map((col, i) => (
              <th
                key={col || `col-${i}`}
                className="whitespace-nowrap px-3 py-2.5 font-medium"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {shipments.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-muted">
                No shipments in this tier.
              </td>
            </tr>
          ) : (
            shipments.map((s) => (
              <tr key={s.shipment_id} className="transition-colors hover:bg-surface/60">
                <td className="whitespace-nowrap px-3 py-2.5 font-mono text-ink">
                  {s.shipment_id}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-ink">
                  {s.destination.label}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                  {s.sla_type}
                </td>
                <td className="px-3 py-2.5">
                  <EtaBand
                    p50={s.eta_p50_min}
                    p90={s.eta_p90_min}
                    domainMax={domainMax}
                    tier={s.risk_tier}
                  />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <TierBadge tier={s.risk_tier} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono tabular-nums text-muted">
                  {s.hub_dwell_p50_min.toFixed(1)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono tabular-nums text-muted">
                  {s.co2_kg.toFixed(2)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                  {s.decision_status}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <Link
                    to={`/decide/${s.shipment_id}`}
                    className="font-medium text-accent underline-offset-2 hover:underline"
                  >
                    Decide →
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
