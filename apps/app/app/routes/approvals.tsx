import type { Route } from "./+types/approvals";
import { PageHeader } from "~/components/PageHeader";
import { PhasePlaceholder } from "~/components/PhasePlaceholder";

export function meta(_: Route.MetaArgs) {
  return [{ title: "SLAra — Human Approval" }];
}

export default function Approvals() {
  return (
    <>
      <PageHeader title="Human-in-the-Loop" subtitle="Approval queue" />
      <PhasePlaceholder
        phase={5}
        note="Pending queue · approval detail · escalation trigger · approve / reject"
      />
    </>
  );
}
