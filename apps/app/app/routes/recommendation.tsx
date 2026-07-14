import type { Route } from "./+types/recommendation";
import { getRecommendation } from "~/lib/data";
import { PageHeader } from "~/components/PageHeader";
import { EventBanner } from "~/components/EventBanner";
import { PlanComparison } from "~/components/PlanComparison";
import { AgentNetwork } from "~/components/AgentNetwork";
import { ConfidenceScorePanel } from "~/components/ConfidenceScorePanel";
import { AgentReasoningTrace } from "~/components/AgentReasoningTrace";
import { DecisionActionBar } from "~/components/DecisionActionBar";

export function meta(_: Route.MetaArgs) {
  return [{ title: "SLAra — AI Recommendation" }];
}

export async function loader(_: Route.LoaderArgs) {
  return { detail: await getRecommendation() };
}

export default function Recommendation({ loaderData }: Route.ComponentProps) {
  const { detail } = loaderData;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHeader
        title="AI Recommendation Detail"
        subtitle="LangGraph multi-agent reasoning"
      />

      <EventBanner event={detail.event} />

      <PlanComparison current={detail.current_plan} ai={detail.ai_plan} />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-[22px] font-bold text-brand">
            LangGraph Agent Network
          </h2>
          <div className="glass-card p-5">
            <AgentNetwork agents={detail.agents} />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-[22px] font-bold text-brand">Confidence Score</h2>
          <ConfidenceScorePanel c={detail.confidence} />
        </section>
      </div>

      <section className="space-y-2">
        <h2 className="text-[22px] font-bold text-brand">
          Agent Reasoning Trace
        </h2>
        <AgentReasoningTrace trace={detail.trace} />
      </section>

      <DecisionActionBar
        affected={detail.event.affected}
        planTitle="Plan C"
      />
    </div>
  );
}
