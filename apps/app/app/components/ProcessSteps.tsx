import { Fragment } from "react";
import type { ProcessStep } from "~/lib/types";

// The 4-step lightweight→deep pipeline banner (Figma), data from the dashboard mock.
// Maroon titles, navy subtitles, brand connector lines.

export function ProcessSteps({ steps }: { steps: ProcessStep[] }) {
  return (
    <div className="glass-card flex items-center gap-3 px-6 py-3">
      {steps.map((s, i) => (
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
          {i < steps.length - 1 && (
            <div className="hidden h-px flex-1 bg-brand/50 lg:block" />
          )}
        </Fragment>
      ))}
    </div>
  );
}
