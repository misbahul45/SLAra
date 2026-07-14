import type { DecisionPerformanceData, PerfBar } from "~/lib/types";

// Decision performance panel (Figma 6-29): auto-resolution vs target, latency
// percentiles, and quality bars.

function PerfBarRow({ bar }: { bar: PerfBar }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[13px]">
        <span className="text-brand">{bar.label}</span>
        <span className="font-bold tabular-nums text-ink">{bar.display}</span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-brand/30">
        <div
          className="h-full rounded-full bg-ink"
          style={{ width: `${Math.min(Math.max(bar.value_pct, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}

export function DecisionPerformance({
  perf,
}: {
  perf: DecisionPerformanceData;
}) {
  return (
    <div className="glass-card space-y-4 p-5">
      <PerfBarRow bar={perf.auto_resolution} />

      <div className="grid grid-cols-3 gap-3">
        {perf.percentiles.map((p) => (
          <div key={p.label} className="text-center">
            <div className="text-[12px] text-brand">{p.label}</div>
            <div className="text-[20px] font-bold tabular-nums text-ink">
              {p.value}
            </div>
          </div>
        ))}
      </div>

      {perf.bars.map((b) => (
        <PerfBarRow key={b.label} bar={b} />
      ))}
    </div>
  );
}
