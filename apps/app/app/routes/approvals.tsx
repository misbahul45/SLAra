import { useState } from "react";
import type { Route } from "./+types/approvals";
import { getApprovals } from "~/lib/data";
import { PageHeader } from "~/components/PageHeader";
import { ApprovalQueue } from "~/components/ApprovalQueue";
import { ApprovalDetailPanel } from "~/components/ApprovalDetailPanel";

export function meta(_: Route.MetaArgs) {
  return [{ title: "SLAra — Human Approval" }];
}

export async function loader(_: Route.LoaderArgs) {
  return { approvals: await getApprovals() };
}

export default function Approvals({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData.approvals;
  const [selectedId, setSelectedId] = useState(items[0]?.approval_id ?? "");

  const detail = items.find((i) => i.approval_id === selectedId) ?? items[0];

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title="Human-in-the-Loop" subtitle="Approval queue" />

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-1">
          <h2 className="text-[22px] font-bold text-brand">Pending Queue</h2>
          <ApprovalQueue
            items={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>

        <section className="lg:col-span-2">
          {detail && (
            <ApprovalDetailPanel key={detail.approval_id} detail={detail} />
          )}
        </section>
      </div>
    </div>
  );
}
