import { Link } from "react-router";
import type { VehicleTelemetry } from "~/lib/types";

// Right-hand telemetry panel on the Live Fleet Map (Figma 6-21): status pill, spec rows,
// progress bars, and a maroon CTA into the AI Recommendation page.

function clamp(n: number): number {
  return Math.min(Math.max(n, 0), 100);
}

export function VehicleTelemetryPanel({ v }: { v: VehicleTelemetry }) {
  return (
    <div className="glass-card flex h-full flex-col p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-gradient-to-r from-brand to-accent px-4 py-1 text-[15px] font-bold text-white">
          <span className="h-2.5 w-2.5 rounded-full bg-white/90" />
          {v.status}
        </span>
        <span className="text-[16px] text-brand">{v.shipment_id}</span>
      </div>

      <dl className="mt-6 space-y-4">
        {v.rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4">
            <dt className="shrink-0 text-[15px] text-brand">{r.label}</dt>
            <dd
              className={`text-right text-[15px] font-bold ${
                r.accent === "gold" ? "text-[#dcb30d]" : "text-ink"
              }`}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="my-6 h-px bg-brand/40" />

      <div className="space-y-4">
        {v.bars.map((b) => (
          <div key={b.label}>
            <div className="flex items-center justify-between text-[14px]">
              <span className="font-semibold text-brand">{b.label}</span>
              <span className="font-bold text-ink">{b.display}</span>
            </div>
            <div className="mt-1 h-4 w-full overflow-hidden rounded-full bg-brand/50">
              <div
                className="h-full rounded-full bg-ink"
                style={{ width: `${clamp(b.bar_pct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/recommendation"
        className="mt-8 w-full rounded-[16px] bg-accent px-4 py-3 text-center text-[16px] font-bold text-white transition-colors hover:bg-accent/90"
      >
        View AI Recommendation →
      </Link>
    </div>
  );
}
