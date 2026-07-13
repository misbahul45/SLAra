import type { RiskTier } from "~/lib/types";
import { TIER_BADGE_CLASS } from "~/lib/tier";

export function TierBadge({ tier }: { tier: RiskTier }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${TIER_BADGE_CLASS[tier]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {tier}
    </span>
  );
}
