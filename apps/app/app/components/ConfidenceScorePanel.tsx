import type { ConfidenceScore } from "~/lib/types";

// Aggregate decision confidence + SHAP feature importance (Figma 6-23).

export function ConfidenceScorePanel({ c }: { c: ConfidenceScore }) {
  const maxShap = Math.max(...c.shap.map((s) => Math.abs(s.value)), 0.01);

  return (
    <div className="glass-card p-5">
      <div className="text-center">
        <div className="text-[44px] font-bold leading-none text-accent">
          {c.aggregate_pct}%
        </div>
        <div className="mt-1 text-[13px] text-brand">
          Aggregate Decision Confidence
        </div>
      </div>

      <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-brand/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-brand"
          style={{ width: `${Math.min(Math.max(c.aggregate_pct, 0), 100)}%` }}
        />
      </div>
      <div
        className={`mt-2 text-center text-[13px] font-semibold ${
          c.passed ? "text-safe" : "text-danger"
        }`}
      >
        Auto-Execute Threshold (≥{c.threshold_pct}%) {c.passed ? "PASSED" : "NOT MET"}
      </div>

      <div className="mt-5 text-[14px] font-bold text-ink">
        SHAP Feature Importance
      </div>
      <ul className="mt-2 space-y-2">
        {c.shap.map((s) => (
          <li key={s.feature}>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-brand">{s.feature}</span>
              <span className="font-bold tabular-nums text-ink">
                +{s.value.toFixed(2)}
              </span>
            </div>
            <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-brand/30">
              <div
                className="h-full rounded-full bg-ink"
                style={{ width: `${(Math.abs(s.value) / maxShap) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
