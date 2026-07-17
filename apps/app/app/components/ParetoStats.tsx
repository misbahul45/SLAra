import type { LabeledValue, WeightTuning } from "~/lib/types";

// Pareto statistics + active weight tuning side panels (Figma 6-25).

export function ParetoStats({ stats }: { stats: LabeledValue[] }) {
  return (
    <div className="glass-card p-4">
      <div className="text-[13px] font-bold uppercase tracking-wide text-brand">
        Pareto Statistics
      </div>
      <dl className="mt-3 space-y-2">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-[14px]">
            <dt className="text-brand">{s.label}</dt>
            <dd className="font-bold tabular-nums text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function WeightTuningPanel({ weights }: { weights: WeightTuning[] }) {
  return (
    <div className="glass-card p-4">
      {/* "Selection Weights", not "Weight Tuning": nothing here is user-tunable,
          and a title that promises a control the page doesn't have erodes trust. */}
      <div className="text-[13px] font-bold uppercase tracking-wide text-brand">
        Selection Weights
      </div>
      <div className="text-[12px] text-ink/70">
        how the agent picks one plan from the Pareto set — fixed, not tunable
      </div>
      <div className="mt-3 space-y-3">
        {weights.map((w) => (
          <div key={w.label}>
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-brand">{w.label}</span>
              <span className="font-bold tabular-nums text-ink">
                {w.value.toFixed(1)}
              </span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-brand/40">
              <div
                className="h-full rounded-full bg-ink"
                style={{ width: `${Math.min(Math.max(w.value, 0), 1) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
