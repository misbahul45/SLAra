import type { EventFeedItem } from "~/lib/types";

// Live event feed strip (Figma): red dot + "EVT-xxxx · Title · N shipments".
// Upright text (italic slows scanning) and "·" separators, matching the rest of
// the app's metadata rows.

export function EventFeed({ events }: { events: EventFeedItem[] }) {
  return (
    <div className="glass-card flex flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3">
      {events.map((e) => (
        <div
          key={e.event_id}
          className="flex items-center gap-2 text-[14px] text-ink"
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-danger" />
          <span className="font-semibold">{e.event_id}</span> · {e.title} ·{" "}
          {e.affected} {e.affected === 1 ? "shipment" : "shipments"}
        </div>
      ))}
    </div>
  );
}
