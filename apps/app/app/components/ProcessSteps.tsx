import { Fragment } from "react";

// The 4-step lightweight→deep pipeline banner (Figma): Monitor → Filter → Deep Analyze
// → Decide. Maroon titles, navy subtitles, brand connector lines.

const STEPS = [
  { title: "Monitor All Trucks", sub: "Lightweight state tracking" },
  { title: "Filter Affected Trucks", sub: "Detect disruption zones" },
  { title: "Deep Analyze Selected Trucks", sub: "Delay & route analysis" },
  { title: "Decide Action", sub: "Reroute, reassign, hold" },
];

export function ProcessSteps() {
  return (
    <div className="glass-card flex items-center gap-3 px-6 py-3">
      {STEPS.map((s, i) => (
        <Fragment key={s.title}>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
            <div>
              <div className="text-[15px] font-bold leading-tight text-accent">
                {s.title}
              </div>
              <div className="text-[12px] text-ink/70">{s.sub}</div>
            </div>
          </div>
          {i < STEPS.length - 1 && (
            <div className="hidden h-px flex-1 bg-brand/50 lg:block" />
          )}
        </Fragment>
      ))}
    </div>
  );
}
