import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DistributionBar } from "~/lib/types";

// Decision distribution over the last 24h (Figma 6-29). Maroon bars.
// Rendered inside ClientOnly on the page (recharts ResponsiveContainer needs the client).

export function DecisionDistributionChart({ data }: { data: DistributionBar[] }) {
  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#669bbb" strokeOpacity={0.25} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "#6f86a0", fontSize: 11 }}
            stroke="#669bbb"
          />
          <YAxis tick={{ fill: "#6f86a0", fontSize: 11 }} stroke="#669bbb" />
          <Tooltip
            cursor={{ fill: "#669bbb", fillOpacity: 0.1 }}
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #669bbb",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" fill="#780001" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
