import type { AgentNode, AgentStatus } from "~/lib/types";

// LangGraph multi-agent topology (Figma 6-23): a supervisor at the center with the
// worker agents on a ring, colored by status.

const STATUS_COLOR: Record<AgentStatus, string> = {
  completed: "#2f9e6b",
  active: "#4c9ad0",
  pending: "#8b98a9",
};

const STATUS_LABEL: { status: AgentStatus; label: string }[] = [
  { status: "completed", label: "Completed" },
  { status: "active", label: "Active" },
  { status: "pending", label: "Pending" },
];

export function AgentNetwork({ agents }: { agents: AgentNode[] }) {
  const w = 460;
  const h = 380;
  const cx = w / 2;
  const cy = h / 2;
  const R = 132;
  const r = 30;

  const nodes = agents.map((a, i) => {
    const ang = ((-90 + i * (360 / agents.length)) * Math.PI) / 180;
    return { ...a, x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
  });

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img" aria-label="LangGraph agent network">
        {nodes.map((n) => (
          <line
            key={`edge-${n.key}`}
            x1={cx}
            y1={cy}
            x2={n.x}
            y2={n.y}
            stroke="#669bbb"
            strokeOpacity={0.5}
            strokeWidth={1.5}
          />
        ))}

        <circle cx={cx} cy={cy} r={42} fill="#01304a" />
        <text x={cx} y={cy - 3} textAnchor="middle" fill="#ffffff" fontSize={13} fontWeight={700}>
          Supervisor
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle" fill="#cfe0ee" fontSize={10}>
          LangGraph
        </text>

        {nodes.map((n) => {
          const color = STATUS_COLOR[n.status];
          return (
            <g key={n.key}>
              <circle cx={n.x} cy={n.y} r={r} fill="#ffffff" stroke={color} strokeWidth={2.5} />
              <text x={n.x} y={n.y + 4} textAnchor="middle" fill={color} fontSize={13} fontWeight={700}>
                {n.confidence}%
              </text>
              <text x={n.x} y={n.y + r + 15} textAnchor="middle" fill="#01304a" fontSize={11}>
                {n.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex justify-center gap-5">
        {STATUS_LABEL.map(({ status, label }) => (
          <span key={status} className="flex items-center gap-1.5 text-[12px] text-muted">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STATUS_COLOR[status] }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
