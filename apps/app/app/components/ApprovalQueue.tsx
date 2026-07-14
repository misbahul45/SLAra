import type { ApprovalDetail } from "~/lib/types";
import { SeverityPill } from "./SeverityPill";

// Pending approval queue (Figma 6-27). Confidence bar is amber below the 70% threshold,
// green at/above it. Cards are selectable; the selected one drives the detail panel.

export function ApprovalQueue({
  items,
  selectedId,
  onSelect,
}: {
  items: ApprovalDetail[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((it) => {
        const active = it.approval_id === selectedId;
        const low = it.ai_confidence < 70;
        return (
          <button
            key={it.approval_id}
            type="button"
            onClick={() => onSelect(it.approval_id)}
            className={`glass-card w-full p-4 text-left transition duration-150 hover:-translate-y-0.5 hover:shadow-md ${
              active ? "border-ink ring-1 ring-ink/30" : "hover:border-brand"
            }`}
          >
            <SeverityPill severity={it.severity} />
            <div className="mt-2 text-[16px] font-bold text-ink">{it.title}</div>
            <div className="text-[13px] text-muted">{it.shipments} shipments</div>

            <div className="mt-3 flex items-center justify-between text-[13px]">
              <span className="text-brand">AI Confidence</span>
              <span className="font-bold tabular-nums text-ink">
                {it.ai_confidence}%
              </span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-brand/30">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${it.ai_confidence}%`,
                  backgroundColor: low ? "#e0a83a" : "#2f9e6b",
                }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
