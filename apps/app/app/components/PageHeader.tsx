import type { ReactNode } from "react";

// Shared page title block (Figma: 32px bold navy + subtitle). Optional right slot for
// page-level controls (clock, range toggle, …).

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[32px] font-bold leading-tight text-ink">{title}</h1>
        {subtitle && <p className="text-[17px] text-ink/70">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </header>
  );
}
