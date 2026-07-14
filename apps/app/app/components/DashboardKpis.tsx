import type { DashboardKpi, KpiIconKind } from "~/lib/types";

// 6 glass KPI cards (Figma). Icon top-left, delta top-right, label + big value below.

const svg = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

function KpiGlyph({ kind }: { kind: KpiIconKind }) {
  const cls = "h-7 w-7 text-brand";
  switch (kind) {
    case "box":
      return (
        <svg className={cls} {...svg} aria-hidden="true">
          <path d="M3 8l9-5 9 5v8l-9 5-9-5V8Z" />
          <path d="M3 8l9 5 9-5M12 13v8" />
        </svg>
      );
    case "warning":
      return (
        <svg className={cls} {...svg} aria-hidden="true">
          <path d="M12 4 3 20h18L12 4Z" />
          <path d="M12 10v4M12 17.5v.5" />
        </svg>
      );
    case "target":
      return (
        <svg className={cls} {...svg} aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      );
    case "leaf":
      return (
        <svg className={cls} {...svg} aria-hidden="true">
          <path d="M5 19c0-8 6-13 14-13 0 8-6 13-14 13Z" />
          <path d="M5 19c3-5 7-8 11-9" />
        </svg>
      );
    case "latency":
      return (
        <svg className={cls} {...svg} aria-hidden="true">
          <path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" />
        </svg>
      );
    case "auto":
      return (
        <svg className={cls} {...svg} aria-hidden="true">
          <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v3.5h-3.5" />
        </svg>
      );
    case "truck":
      return (
        <svg className={cls} {...svg} aria-hidden="true">
          <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" />
          <circle cx="7" cy="18" r="1.6" />
          <circle cx="17.5" cy="18" r="1.6" />
        </svg>
      );
    case "fuel":
      return (
        <svg className={cls} {...svg} aria-hidden="true">
          <path d="M4 20V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v15M3 20h11" />
          <path d="M13 8h3l2 2v6a2 2 0 0 0 2 2 2 2 0 0 0 2-2v-7l-3-3" />
          <path d="M6 8h5" />
        </svg>
      );
  }
}

export function DashboardKpis({
  kpis,
  columns = 6,
}: {
  kpis: DashboardKpi[];
  columns?: 4 | 6;
}) {
  const grid =
    columns === 4
      ? "grid grid-cols-2 gap-3 md:grid-cols-4"
      : "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6";
  return (
    <div className={grid}>
      {kpis.map((k) => (
        <div key={k.label} className="glass-card p-4">
          <div className="flex items-start justify-between gap-2">
            <KpiGlyph kind={k.icon} />
            <span className="text-right text-[12px] font-semibold text-ink/80">
              {k.delta}
            </span>
          </div>
          <div className="mt-4 text-[13px] text-brand">{k.label}</div>
          <div className="text-[28px] font-bold leading-tight text-ink">
            {k.value}
          </div>
        </div>
      ))}
    </div>
  );
}
