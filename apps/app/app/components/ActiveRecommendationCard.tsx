import { Link } from "react-router";
import type { ActiveRecommendation } from "~/lib/types";
import { SeverityPill } from "./SeverityPill";

// Active recommendation card (Figma): severity pill + event id, plan title, route,
// three progress metrics, maroon CTA → AI Recommendation page.

export function ActiveRecommendationCard({
  rec,
}: {
  rec: ActiveRecommendation;
}) {
  return (
    <div className="glass-card flex h-full flex-col p-5">
      <div className="flex items-center gap-3">
        <SeverityPill severity={rec.severity} />
        <span className="text-[17px] text-brand">{rec.event_id}</span>
      </div>

      <div className="mt-3 text-[19px] font-bold text-ink">
        {rec.plan_title}
      </div>
      <div className="mt-1 text-[14px] text-ink/80">{rec.route_text}</div>

      <div className="mt-5 space-y-4">
        {rec.metrics.map((m) => (
          <div key={m.label}>
            <div className="flex items-center justify-between text-[14px] text-brand">
              <span>{m.label}</span>
              <span>{m.display}</span>
            </div>
            <div className="mt-1 h-3.5 w-full overflow-hidden rounded-full bg-brand/50">
              <div
                className="h-full rounded-full bg-ink"
                style={{ width: `${Math.min(Math.max(m.bar_pct, 0), 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/recommendation"
        className="mt-6 w-full rounded-[16px] bg-accent px-4 py-3 text-center text-[16px] font-bold text-white transition-colors hover:bg-accent/90"
      >
        View Detail →
      </Link>
    </div>
  );
}
