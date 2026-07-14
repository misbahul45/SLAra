import type { ImpactSummaryData } from "~/lib/types";

// AI decision impact summary (Figma 6-29): headline + trade-off bullets + footnote.

export function ImpactSummary({ summary }: { summary: ImpactSummaryData }) {
  return (
    <div className="glass-card p-5">
      <p className="text-[14px] text-ink/80">{summary.headline}</p>
      <ul className="mt-3 space-y-2">
        {summary.bullets.map((b) => (
          <li key={b.text} className="flex items-start gap-2 text-[14px]">
            <span
              className={`shrink-0 font-bold ${
                b.tone === "good" ? "text-safe" : "text-warning"
              }`}
            >
              {b.tone === "good" ? "✓" : "↗"}
            </span>
            <span className="font-medium text-ink">{b.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[13px] text-muted">{summary.footnote}</p>
    </div>
  );
}
