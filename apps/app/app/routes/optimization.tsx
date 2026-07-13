import type { Route } from "./+types/optimization";
import { PageHeader } from "~/components/PageHeader";
import { PhasePlaceholder } from "~/components/PhasePlaceholder";

export function meta(_: Route.MetaArgs) {
  return [{ title: "SLAra — Route Optimization" }];
}

export default function Optimization() {
  return (
    <>
      <PageHeader
        title="Route Optimization Result"
        subtitle="NSGA-II Genetic Algorithm"
      />
      <PhasePlaceholder
        phase={4}
        note="GA convergence chart · Pareto statistics · weight tuning · plan comparison table"
      />
    </>
  );
}
