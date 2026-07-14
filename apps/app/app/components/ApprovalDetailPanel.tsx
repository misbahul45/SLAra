import { Fragment, useState } from "react";
import type { ApprovalDetail } from "~/lib/types";
import { SeverityPill } from "./SeverityPill";
import { Modal } from "./Modal";
import { useToast } from "./toast";

// Right-hand approval detail (Figma 6-27): escalation trigger, AI recommendation,
// impact metrics, operator note, approve/reject, escalation timeline.
// Mount with key={approval_id} so note/outcome reset when the selection changes.

type Action = "APPROVE" | "REJECT";

export function ApprovalDetailPanel({ detail }: { detail: ApprovalDetail }) {
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const [outcome, setOutcome] = useState<Action | null>(null);
  const { toast } = useToast();

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] uppercase tracking-wide text-brand">
            Approval item
          </div>
          <div className="text-[19px] font-bold text-ink">
            {detail.approval_id} • {detail.title}
          </div>
        </div>
        <SeverityPill severity={detail.severity} />
      </div>

      <div className="mt-4 rounded-[14px] border-2 border-danger/40 bg-danger/10 px-4 py-3">
        <div className="text-[13px] font-bold text-danger">
          ⚠ ESCALATION TRIGGER : LOW CONFIDENCE
        </div>
        <div className="mt-0.5 text-[13px] text-ink/80">
          {detail.escalation_reason}
        </div>
      </div>

      <div className="mt-4 text-[12px] uppercase tracking-wide text-brand">
        AI Recommendation
      </div>
      <p className="text-[16px] font-semibold text-ink">{detail.recommendation}</p>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {detail.metrics.map((m) => (
          <div key={m.label}>
            <dt className="text-[12px] uppercase tracking-wide text-brand">
              {m.label}
            </dt>
            <dd className="text-[18px] font-bold text-ink">{m.value}</dd>
          </div>
        ))}
      </dl>

      {outcome ? (
        <div
          className={`mt-5 rounded-[14px] px-4 py-3 text-[14px] font-semibold ${
            outcome === "APPROVE"
              ? "bg-safe/15 text-safe"
              : "bg-danger/15 text-danger"
          }`}
        >
          {outcome === "APPROVE"
            ? `Approved & executed — ${detail.shipments} shipments reassigned.`
            : "Recommendation rejected — flagged for follow-up."}
        </div>
      ) : (
        <>
          <label className="mt-5 block">
            <span className="text-[12px] uppercase tracking-wide text-brand">
              Approval note (optional)
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Add a note for the audit trail…"
              className="mt-1 w-full resize-none rounded-[12px] border-2 border-brand/50 bg-white/70 px-3 py-2 text-[14px] text-ink placeholder:text-muted focus:border-brand focus:outline-none"
            />
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setPending("APPROVE")}
              className="rounded-[12px] bg-safe px-5 py-2.5 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
            >
              ✓ Approve &amp; Execute
            </button>
            <button
              type="button"
              onClick={() => setPending("REJECT")}
              className="rounded-[12px] bg-danger px-5 py-2.5 text-[14px] font-bold text-white transition-opacity hover:opacity-90"
            >
              ✕ Reject Recommendation
            </button>
          </div>
        </>
      )}

      <div className="mt-6">
        <div className="text-[12px] uppercase tracking-wide text-brand">
          Escalation timeline
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] font-semibold text-ink">
          {detail.timeline.map((step, i) => (
            <Fragment key={step}>
              <span className={i === detail.timeline.length - 1 ? "text-accent" : ""}>
                {step}
              </span>
              {i < detail.timeline.length - 1 && (
                <span className="text-brand">→</span>
              )}
            </Fragment>
          ))}
        </div>
      </div>

      <Modal
        open={pending !== null}
        title={pending === "APPROVE" ? "Approve & execute" : "Reject recommendation"}
        onClose={() => setPending(null)}
      >
        <p className="text-[14px] text-muted">
          {pending === "APPROVE"
            ? `Execute the AI recommendation for ${detail.approval_id} (${detail.shipments} shipments)?`
            : `Reject ${detail.approval_id}? It will be flagged for follow-up.`}
        </p>
        {note && <p className="mt-2 text-[12px] text-muted">Note: “{note}”</p>}
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
                  pending === "APPROVE"
                    ? `Approved & executed — ${detail.shipments} shipments reassigned.`
                    : "Recommendation rejected — flagged for follow-up.",
                  pending === "APPROVE" ? "success" : "error",
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
    </div>
  );
}
