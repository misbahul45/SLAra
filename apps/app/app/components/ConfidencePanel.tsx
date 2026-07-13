import type { DecideResponse, ConfidenceBreakdown } from "~/lib/types";

// The signature element (§2): a confidence gauge with a firm 0.70 threshold tick, plus a
// per-component breakdown whose contributions (value × weight) sum to the gauge number —
// a technical judge can verify the M6 formula live.

const ORDER: (keyof ConfidenceBreakdown)[] = [
  "conf_m1",
  "conf_m2",
  "cs_m4",
  "data_freshness",
  "audit_validity",
];

const SEG_COLOR: Record<keyof ConfidenceBreakdown, string> = {
  conf_m1: "#4cc9f0",
  conf_m2: "#38bdf8",
  cs_m4: "#818cf8",
  data_freshness: "#64748b",
  audit_validity: "#2fbf71",
};

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Semicircular gauge (SVG) ─────────────────────────────────────────────────

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p0 = polar(cx, cy, r, a0);
  const p1 = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
}

function Gauge({
  confidence,
  threshold,
  met,
}: {
  confidence: number;
  threshold: number;
  met: boolean;
}) {
  const w = 220;
  const h = 128;
  const cx = 110;
  const cy = 116;
  const r = 92;
  const color = met ? "#2fbf71" : "#f5a623";
  const valEnd = 180 - 180 * Math.min(Math.max(confidence, 0), 1);
  const thrDeg = 180 - 180 * threshold;
  const tIn = polar(cx, cy, r - 10, thrDeg);
  const tOut = polar(cx, cy, r + 10, thrDeg);

  return (
    <div className="relative mx-auto" style={{ width: w }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <path
          d={arc(cx, cy, r, 180, 0)}
          fill="none"
          stroke="#22303f"
          strokeWidth={12}
          strokeLinecap="round"
        />
        <path
          d={arc(cx, cy, r, 180, valEnd)}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
        />
        {/* firm threshold tick */}
        <line
          x1={tIn.x}
          y1={tIn.y}
          x2={tOut.x}
          y2={tOut.y}
          stroke="#e6edf3"
          strokeWidth={3}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
        <div
          className="font-mono text-4xl font-semibold tabular-nums"
          style={{ color }}
        >
          {confidence.toFixed(2)}
        </div>
        <div className="font-mono text-xs text-muted">
          threshold {threshold.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

// ── Panel ────────────────────────────────────────────────────────────────────

export function ConfidencePanel({ result }: { result: DecideResponse }) {
  const met = result.confidence >= result.threshold;
  const decisionClass = met
    ? "border-safe/40 bg-safe/10 text-safe"
    : "border-warning/40 bg-warning/10 text-warning";

  // Contributions in axis order; cumulative offset drives the stacked bar.
  let offset = 0;
  const segments = ORDER.map((key) => {
    const c = result.confidence_breakdown[key];
    const contribution = c.value * c.weight;
    const seg = { key, c, contribution, left: offset };
    offset += contribution;
    return seg;
  });

  return (
    <div className="space-y-4 rounded border border-line bg-surface/40 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-muted">
          Decision confidence
        </div>
        <span
          className={`rounded border px-2 py-0.5 text-xs font-semibold ${decisionClass}`}
        >
          {result.decision}
        </span>
      </div>

      <Gauge
        confidence={result.confidence}
        threshold={result.threshold}
        met={met}
      />

      {!met && (
        <div className="rounded border border-warning/30 bg-warning/5 px-3 py-2 text-sm">
          <span className="text-muted">Primary uncertainty driver: </span>
          <span className="font-medium text-warning">
            {humanize(result.primary_uncertainty_driver)}
          </span>
        </div>
      )}

      {/* Stacked contribution bar over the 0..1 axis, with the 0.70 threshold line */}
      <div>
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-line">
          {segments.map((s) => (
            <div
              key={s.key}
              className="absolute top-0 h-full"
              style={{
                left: `${s.left * 100}%`,
                width: `${s.contribution * 100}%`,
                backgroundColor: SEG_COLOR[s.key],
              }}
            />
          ))}
          <div
            className="absolute top-[-2px] h-[calc(100%+4px)] w-px bg-ink"
            style={{ left: `${result.threshold * 100}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-muted">
          <span>0.00</span>
          <span>Σ = {result.confidence.toFixed(2)}</span>
          <span>1.00</span>
        </div>
      </div>

      {/* Per-component rows: value × weight = contribution */}
      <dl className="space-y-1.5 text-xs">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: SEG_COLOR[s.key] }}
            />
            <dt className="flex-1 truncate text-muted" title={s.c.label}>
              {s.c.label}
            </dt>
            <dd className="font-mono tabular-nums text-ink">
              {s.c.value.toFixed(2)}
              <span className="text-muted"> × {s.c.weight.toFixed(2)} = </span>
              {s.contribution.toFixed(3)}
            </dd>
          </div>
        ))}
      </dl>

      <p className="border-t border-line pt-3 text-sm text-ink">
        {result.explanation}
      </p>
    </div>
  );
}
