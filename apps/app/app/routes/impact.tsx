import type { Route } from "./+types/impact";
import { PageHeader } from "~/components/PageHeader";
import { PhasePlaceholder } from "~/components/PhasePlaceholder";

export function meta(_: Route.MetaArgs) {
  return [{ title: "SLAra — Execution & KPI" }];
}

export default function Impact() {
  return (
    <>
      <PageHeader
        title="Business Impact & Sustainability"
        subtitle="GHG Protocol Scope 1 + Scope 3 Category 4"
      />
      <PhasePlaceholder
        phase={6}
        note="Impact KPIs · before/after · decision distribution · latency percentiles"
      />
    </>
  );
}
