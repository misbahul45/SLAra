import type { RouteOption } from "~/lib/types";
import { TierBadge } from "./TierBadge";

// Shown when the pipeline ESCALATES. The operator picks the route via the map/cards
// (shared selectedRouteId), adds a note, then approves (executes the selected route)
// or rejects. Both open a confirm modal in View B.

interface OperatorPanelProps {
  selectedRoute: RouteOption | undefined;
  note: string;
  onNoteChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

export function OperatorPanel({
  selectedRoute,
  note,
  onNoteChange,
  onApprove,
  onReject,
}: OperatorPanelProps) {
  return (
    <div className="rounded border border-warning/40 bg-warning/5 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">
          Operator review required
        </h2>
        <span className="text-xs text-muted">
          Pick a route above, then decide
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded border border-line bg-surface/60 px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-muted">
          Selected
        </span>
        {selectedRoute ? (
          <>
            <span className="text-sm font-medium text-ink">
              {selectedRoute.label}
            </span>
            <span className="font-mono text-xs text-muted">
              {selectedRoute.route_id}
            </span>
            <TierBadge tier={selectedRoute.risk_tier} />
          </>
        ) : (
          <span className="text-sm text-muted">none</span>
        )}
      </div>

      <label className="mt-3 block">
        <span className="text-xs uppercase tracking-wide text-muted">
          Operator note
        </span>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          rows={2}
          placeholder="e.g. picked greenest, SLA buffer ok"
          className="mt-1 w-full resize-none rounded border border-line bg-base px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onApprove}
          disabled={!selectedRoute}
          className="rounded border border-safe/50 bg-safe/10 px-4 py-2 text-sm font-medium text-safe transition-colors hover:bg-safe/20 disabled:opacity-50"
        >
          Approve &amp; execute
        </button>
        <button
          type="button"
          onClick={onReject}
          className="rounded border border-critical/50 bg-critical/10 px-4 py-2 text-sm font-medium text-critical transition-colors hover:bg-critical/20"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
