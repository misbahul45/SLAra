import type { AgentTraceItem } from "~/lib/types";

// Per-agent reasoning trace (Figma 6-23): 8 cards with latency, confidence, reasoning
// and an optional top-SHAP chip.

export function AgentReasoningTrace({ trace }: { trace: AgentTraceItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {trace.map((t) => (
        <div key={t.key} className="glass-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-safe" />
              <span className="text-[15px] font-bold text-ink">{t.name}</span>
              <span className="text-[12px] text-muted">| {t.latency_ms}ms</span>
            </div>
            <span className="text-[13px] font-bold tabular-nums text-brand">
              {t.confidence}%
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-snug text-ink/80">{t.reasoning}</p>
          {t.top_shap && (
            <div className="mt-2 inline-block rounded-md bg-brand/15 px-2 py-1 text-[12px] text-ink/80">
              Top SHAP: {t.top_shap}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
