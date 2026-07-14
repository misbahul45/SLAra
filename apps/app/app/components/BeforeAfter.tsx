import type { BeforeAfterRow } from "~/lib/types";

// Before (red) vs After (green) impact bars, Plan A → Plan C (Figma 6-29).
// Bar widths are relative to the larger value in each row.

export function BeforeAfter({ rows }: { rows: BeforeAfterRow[] }) {
  return (
    <div className="glass-card space-y-4 p-5">
      {rows.map((r) => {
        const max = Math.max(r.before, r.after) || 1;
        return (
          <div key={r.label}>
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-semibold text-ink">{r.label}</span>
              <span className="text-muted">
                {r.before_display} →{" "}
                <span className="font-bold text-ink">{r.after_display}</span>
              </span>
            </div>
            <div className="mt-1.5 space-y-1">
              <div className="h-3 w-full overflow-hidden rounded-full bg-brand/20">
                <div
                  className="h-full rounded-full bg-danger"
                  style={{ width: `${(r.before / max) * 100}%` }}
                />
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-brand/20">
                <div
                  className="h-full rounded-full bg-safe"
                  style={{ width: `${(r.after / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
