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

// NSGA-II fitness convergence over generations (Figma 6-25). Maroon filled area.
// Rendered inside ClientOnly on the page so ResponsiveContainer measures on the client.

export function GaConvergenceChart({ data }: { data: GaPoint[] }) {
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
            domain={[0, 100]}
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
            formatter={(value) => [`${value}`, "fitness"]}
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
