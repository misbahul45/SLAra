import type { Route } from "./+types/recommendation";
import { PageHeader } from "~/components/PageHeader";
import { PhasePlaceholder } from "~/components/PhasePlaceholder";

export function meta(_: Route.MetaArgs) {
  return [{ title: "SLAra — AI Recommendation" }];
}

export default function Recommendation() {
  return (
    <>
      <PageHeader
        title="AI Recommendation Detail"
        subtitle="LangGraph multi-agent reasoning"
      />
      <PhasePlaceholder
        phase={3}
        note="Plan comparison · LangGraph agent network · confidence + SHAP · reasoning trace"
      />
    </>
  );
}
