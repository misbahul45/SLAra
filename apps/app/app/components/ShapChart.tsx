import type { ShapFeature } from "~/lib/types";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// M5 lazy explainability: top-5 SHAP drivers. Red = increases ETA, green = decreases.
// `null` (selected route is SAFE) → the honest "not required" message.

const RED = "#e5484d";
const GREEN = "#2fbf71";

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ShapChart({ shap }: { shap: ShapFeature[] | null }) {
  if (!shap || shap.length === 0) {
    return (
      <div>
        <div className="text-xs uppercase tracking-wide text-muted">
          ETA drivers (SHAP)
        </div>
        <p className="mt-3 text-sm text-muted">
          Model confident — explanation not required for SAFE routes.
        </p>
      </div>
    );
  }

  const data = shap.map((f) => ({
    name: humanize(f.feature),
    impact_min: f.impact_min,
    color: f.direction === "increases_eta" ? RED : GREEN,
  }));

  return (
    <div className="rounded border border-line bg-surface/40 p-4">
      <div className="text-xs uppercase tracking-wide text-muted">
        Top ETA drivers (SHAP · minutes)
      </div>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
          >
            <XAxis
              type="number"
              tick={{ fill: "#6f86a0", fontSize: 11 }}
              stroke="#669bbb"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fill: "#01304a", fontSize: 11 }}
              stroke="#669bbb"
            />
            <ReferenceLine x={0} stroke="#669bbb" />
            <Tooltip
              cursor={{ fill: "#669bbb", fillOpacity: 0.1 }}
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #669bbb",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#01304a" }}
              formatter={(value) => [`${Number(value).toFixed(1)} min`, "impact"]}
            />
            <Bar dataKey="impact_min" radius={2}>
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: RED }} />
          increases ETA
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: GREEN }} />
          decreases ETA
        </span>
      </div>
    </div>
  );
}
