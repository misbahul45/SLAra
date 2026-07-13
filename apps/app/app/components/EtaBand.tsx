import type { RiskTier } from "~/lib/types";
import { TIER_HEX } from "~/lib/tier";

// The signature uncertainty visual: P50→P90 rendered as a range bar, not one number.
// `domainMax` is shared across all rows so a wide (uncertain) band reads visibly wider
// than a narrow (confident) one — no rule-based dashboard can show this.

interface EtaBandProps {
  p50: number;
  p90: number;
  domainMax: number;
  tier: RiskTier;
}

export function EtaBand({ p50, p90, domainMax, tier }: EtaBandProps) {
  const left = Math.max((p50 / domainMax) * 100, 0);
  const width = Math.max(((p90 - p50) / domainMax) * 100, 1.5);
  const hex = TIER_HEX[tier];

  return (
    <div className="w-44">
      <div className="mb-1 flex items-baseline justify-between font-mono text-[11px] tabular-nums">
        <span className="text-muted">{p50.toFixed(0)}</span>
        <span className="text-ink">Δ{(p90 - p50).toFixed(0)}m</span>
        <span className="text-muted">{p90.toFixed(0)}</span>
      </div>
      <div className="relative h-1.5 w-full rounded-full bg-line">
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            left: `${left}%`,
            width: `${width}%`,
            backgroundColor: hex,
            boxShadow: `0 0 6px ${hex}66`,
          }}
        />
      </div>
    </div>
  );
}
