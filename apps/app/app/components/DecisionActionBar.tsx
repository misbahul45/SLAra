import { useState } from "react";
import { Modal } from "./Modal";
import { useToast } from "./toast";

// Bottom decision bar (Figma 6-23): approve / reject / send-to-human, each confirmed
// via modal, then collapses into an outcome banner. Mock-first (no backend call).

type Action = "APPROVE" | "REJECT" | "REVIEW";

const ACTION_LABEL: Record<Action, string> = {
  APPROVE: "Approve & Execute",
  REJECT: "Reject",
  REVIEW: "Send to Human Review",
};

function outcomeText(action: Action, planTitle: string): string {
  switch (action) {
    case "APPROVE":
      return `${planTitle} executed — reroute pushed to TMS.`;
    case "REJECT":
      return "Recommendation rejected — flagged for follow-up.";
    case "REVIEW":
      return "Sent to the human review queue.";
  }
}

export function DecisionActionBar({
  affected,
  planTitle,
}: {
  affected: number;
  planTitle: string;
}) {
  const [pending, setPending] = useState<Action | null>(null);
  const [outcome, setOutcome] = useState<Action | null>(null);
  const { toast } = useToast();

  if (outcome) {
    return (
      <div className="rounded-[18px] bg-ink px-5 py-4">
        <span
          className={`font-semibold ${
            outcome === "REJECT" ? "text-[#ff9a9a]" : "text-[#8ce0b6]"
          }`}
        >
          {outcomeText(outcome, planTitle)}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-[18px] bg-ink px-5 py-4 text-white md:flex-row md:items-center md:justify-between">
        <span className="text-[15px]">
          Ready to execute {planTitle} for {affected} affected shipments?
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPending("APPROVE")}
            className="rounded-[12px] bg-safe px-4 py-2 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Approve &amp; Execute
          </button>
          <button
            type="button"
            onClick={() => setPending("REJECT")}
            className="rounded-[12px] bg-danger px-4 py-2 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => setPending("REVIEW")}
            className="rounded-[12px] bg-brand px-4 py-2 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
          >
            Send to Human Review
          </button>
        </div>
      </div>

      <Modal
        open={pending !== null}
        title={pending ? ACTION_LABEL[pending] : ""}
        onClose={() => setPending(null)}
      >
        <p className="text-[14px] text-muted">
          Confirm <span className="font-semibold text-ink">{pending ? ACTION_LABEL[pending] : ""}</span>{" "}
          for {affected} affected shipments?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPending(null)}
            className="rounded border-2 border-brand px-3 py-1.5 text-[14px] text-brand transition-colors hover:bg-brand/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (pending) {
                setOutcome(pending);
                toast(
                  outcomeText(pending, planTitle),
                  pending === "APPROVE"
                    ? "success"
                    : pending === "REJECT"
                      ? "error"
                      : "info",
                );
              }
              setPending(null);
            }}
            className="rounded bg-ink px-3 py-1.5 text-[14px] font-medium text-white"
          >
            Confirm
          </button>
        </div>
      </Modal>
    </>
  );
}
