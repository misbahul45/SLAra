import type { EventFeedItem } from "~/lib/types";

// Live event feed strip (Figma): red dot + italic "EVT-xxxx: Title - N shipments".

export function EventFeed({ events }: { events: EventFeedItem[] }) {
  return (
    <div className="glass-card flex flex-wrap items-center gap-x-8 gap-y-2 px-6 py-3">
      {events.map((e) => (
        <div
          key={e.event_id}
          className="flex items-center gap-2 text-[14px] italic text-ink"
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-danger" />
          {e.event_id}: {e.title} - {e.affected} shipments
        </div>
      ))}
    </div>
  );
}
