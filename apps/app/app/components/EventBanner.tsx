import type { RecoEvent } from "~/lib/types";
import { SeverityPill } from "./SeverityPill";

// Event context bar at the top of the AI Recommendation page (Figma 6-23).

export function EventBanner({ event }: { event: RecoEvent }) {
  return (
    <div className="glass-card flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      <span className="text-[16px] font-bold text-ink">{event.event_id}</span>
      <span className="text-brand">|</span>
      <span className="text-[16px] font-semibold text-ink">{event.title}</span>
      <SeverityPill severity={event.severity} />
      <span className="text-[14px] text-muted">
        {event.affected} shipments affected
      </span>
      <span className="ml-auto text-[14px] text-muted">
        Detected: {event.detected_at}
      </span>
    </div>
  );
}
