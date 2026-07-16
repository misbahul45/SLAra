import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { GaPoint } from "~/lib/types";

// NSGA-II hypervolume convergence over generations (live M4: convergence_hv).
// Maroon filled area. Rendered inside ClientOnly so ResponsiveContainer measures
// on the client. `fitness` here carries the per-generation hypervolume value.

export function GaConvergenceChart({ data }: { data: GaPoint[] }) {
  // Hypervolume is not a 0..100 scale (here ~0.4..1.4), so fit the Y-domain to the
  // data with a little padding instead of hardcoding — otherwise the trace flatlines.
  const ys = data.map((d) => d.fitness);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const pad = (hi - lo) * 0.1 || 0.1;
  const domain: [number, number] = [
    Number(Math.max(0, lo - pad).toFixed(3)),
    Number((hi + pad).toFixed(3)),
  ];

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 4 }}>
          <defs>
            <linearGradient id="gaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#780001" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#780001" stopOpacity={0.12} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#669bbb" strokeOpacity={0.25} />
          <XAxis
            dataKey="generation"
            tick={{ fill: "#6f86a0", fontSize: 12 }}
            stroke="#669bbb"
          />
          <YAxis
            domain={domain}
            tick={{ fill: "#6f86a0", fontSize: 12 }}
            stroke="#669bbb"
          />
          <Tooltip
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #669bbb",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(l) => `Generation ${l}`}
            formatter={(value) => [`${value}`, "hypervolume"]}
          />
          <Area
            type="monotone"
            dataKey="fitness"
            stroke="#780001"
            strokeWidth={2}
            fill="url(#gaFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
