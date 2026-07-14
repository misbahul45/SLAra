import type { MetricTone, PlanCard, PlanMetric } from "~/lib/types";

// Current-vs-AI plan comparison (Figma 6-23). Current plan uses maroon accents;
// the recommended plan uses navy + a gradient score bar.

const TONE_TEXT: Record<MetricTone, string> = {
  down: "text-safe",
  up: "text-warning",
  neutral: "text-muted",
};

function Metric({ metric, accent }: { metric: PlanMetric; accent: string }) {
  return (
    <div>
      <div className="text-[12px] uppercase tracking-wide text-brand">
        {metric.label}
      </div>
      <div className={`text-[20px] font-bold ${accent}`}>{metric.value}</div>
      {metric.delta && (
        <div className={`text-[12px] font-semibold ${TONE_TEXT[metric.tone ?? "neutral"]}`}>
          {metric.delta}
        </div>
      )}
    </div>
  );
}

function PlanCardView({ plan }: { plan: PlanCard }) {
  const recommended = plan.variant === "recommended";
  const accentText = recommended ? "text-ink" : "text-accent";

  return (
    <div
      className={`glass-card flex flex-col p-5 ${
        recommended ? "border-ink" : "border-accent/60"
      }`}
    >
      <div className={`text-[13px] font-bold uppercase tracking-wide ${accentText}`}>
        {plan.tag}
      </div>
      <div className={`mt-1 text-[19px] font-bold ${accentText}`}>
        {plan.route}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        {plan.metrics.map((m) => (
          <Metric key={m.label} metric={m} accent="text-ink" />
        ))}
      </div>

      {typeof plan.score === "number" && (
        <div className="mt-5 flex items-center justify-between rounded-[14px] bg-gradient-to-r from-accent to-ink px-4 py-2 text-white">
          <span className="text-[14px] font-semibold">Score</span>
          <span className="text-[22px] font-bold tabular-nums">
            {plan.score}/100
          </span>
        </div>
      )}
    </div>
  );
}

export function PlanComparison({
  current,
  ai,
}: {
  current: PlanCard;
  ai: PlanCard;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <PlanCardView plan={current} />
      <PlanCardView plan={ai} />
    </div>
  );
}
