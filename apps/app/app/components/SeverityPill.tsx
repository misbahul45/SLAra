import type { Severity } from "~/lib/types";

const SEVERITY_BG: Record<Severity, string> = {
  HIGH: "bg-danger",
  MEDIUM: "bg-warning",
  CRITICAL: "bg-critical",
};

export function SeverityPill({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[13px] font-bold text-white ${SEVERITY_BG[severity]}`}
    >
      <span className="h-2 w-2 rounded-full bg-white/90" />
      {severity}
    </span>
  );
}
