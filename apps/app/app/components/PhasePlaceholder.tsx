// Temporary page body used in Phase 0 so the nav is fully navigable before each page
// is built out in its own phase.

export function PhasePlaceholder({
  phase,
  note,
}: {
  phase: number;
  note?: string;
}) {
  return (
    <div className="glass-card flex min-h-[280px] items-center justify-center p-8 text-center">
      <div>
        <div className="text-[18px] font-semibold text-ink">
          Coming in Phase {phase}
        </div>
        {note && <p className="mt-1 text-[15px] text-muted">{note}</p>}
      </div>
    </div>
  );
}
