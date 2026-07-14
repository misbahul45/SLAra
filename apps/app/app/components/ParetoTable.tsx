import type { MetricTone, ParetoPlan } from "~/lib/types";

// Pareto plan comparison table (Figma 6-25): 4 plans with tags + score bars.

const TAG_CLASS: Record<string, string> = {
  CURRENT: "bg-ink text-white",
  FASTEST: "bg-warning text-white",
  RECOMMENDED: "bg-safe text-white",
  "LOW CARBON": "bg-[#2f9fb0] text-white",
};

const DELAY_TONE: Record<MetricTone, string> = {
  down: "text-safe",
  up: "text-danger",
  neutral: "text-ink",
};

const HEAD = ["Plan", "Route via", "ETA", "Delay Risk", "Fuel", "CO₂", "Score", "Tag"];

function ScoreCell({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-brand/30">
        <div
          className="h-full rounded-full bg-ink"
          style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
        />
      </div>
      <span className="font-bold tabular-nums text-ink">{score}</span>
    </div>
  );
}

export function ParetoTable({ plans }: { plans: ParetoPlan[] }) {
  return (
    <div className="glass-card overflow-x-auto p-0">
      <table className="w-full text-left text-[14px]">
        <thead className="text-[12px] uppercase tracking-wide text-brand">
          <tr>
            {HEAD.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr
              key={p.plan}
              className={`border-t border-brand/20 ${
                p.tag === "RECOMMENDED" ? "bg-safe/10" : ""
              }`}
            >
              <td className="whitespace-nowrap px-4 py-3 font-bold text-ink">
                {p.plan}
              </td>
              <td className="px-4 py-3 text-ink/80">{p.route_via}</td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-ink">
                {p.eta}
              </td>
              <td
                className={`whitespace-nowrap px-4 py-3 font-semibold tabular-nums ${
                  DELAY_TONE[p.delay_tone ?? "neutral"]
                }`}
              >
                {p.delay_risk}
              </td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink">
                {p.fuel}
              </td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink">
                {p.co2}
              </td>
              <td className="px-4 py-3">
                <ScoreCell score={p.score} />
              </td>
              <td className="px-4 py-3">
                <span
                  className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                    TAG_CLASS[p.tag] ?? "bg-brand text-white"
                  }`}
                >
                  {p.tag}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
