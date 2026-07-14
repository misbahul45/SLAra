import type { ConfidenceBreakdown as Breakdown } from "~/lib/types";

// Five-component decision confidence (value × weight), matching the contract's
// confidence_breakdown field. Contributions sum to the aggregate confidence.

const ORDER: (keyof Breakdown)[] = [
  "conf_m1",
  "conf_m2",
  "cs_m4",
  "data_freshness",
  "audit_validity",
];

export function ConfidenceBreakdown({ breakdown }: { breakdown: Breakdown }) {
  const total = ORDER.reduce(
    (sum, key) => sum + breakdown[key].value * breakdown[key].weight,
    0,
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-bold uppercase tracking-wide text-brand">
          Confidence breakdown
        </span>
        <span className="text-[12px] tabular-nums text-muted">
          Σ = {total.toFixed(2)}
        </span>
      </div>
      <ul className="mt-2 space-y-2">
        {ORDER.map((key) => {
          const c = breakdown[key];
          const contribution = c.value * c.weight;
          return (
            <li key={key}>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-ink/80">{c.label}</span>
                <span className="tabular-nums text-ink">
                  {c.value.toFixed(2)}
                  <span className="text-muted"> × {c.weight.toFixed(2)} = </span>
                  {contribution.toFixed(3)}
                </span>
              </div>
              <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-brand/25">
                <div
                  className="h-full rounded-full bg-ink"
                  style={{ width: `${Math.min(Math.max(c.value, 0), 1) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
