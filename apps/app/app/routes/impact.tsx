import type { Route } from "./+types/impact";
import { getExecutionKpi, getKpi } from "~/lib/data";
import { buildKpiCards } from "~/lib/kpi-cards";
import { PageHeader } from "~/components/PageHeader";
import { RangeToggle } from "~/components/RangeToggle";
import { DashboardKpis } from "~/components/DashboardKpis";
import { BeforeAfter } from "~/components/BeforeAfter";
import { ClientOnly } from "~/components/ClientOnly";
import { DecisionDistributionChart } from "~/components/DecisionDistributionChart";
import { ImpactSummary } from "~/components/ImpactSummary";
import { DecisionPerformance } from "~/components/DecisionPerformance";

export function meta(_: Route.MetaArgs) {
  return [{ title: "SLAra — Execution & KPI" }];
}

export async function loader(_: Route.LoaderArgs) {
  // KPI cards live from the agent; the M4 comparison below is fixture-backed but
  // its numbers now come from the real vs_baseline (see execution.json _note).
  const [data, kpi] = await Promise.all([getExecutionKpi(), getKpi()]);
  return { data, kpi };
}

export default function Impact({ loaderData }: Route.ComponentProps) {
  const { data, kpi } = loaderData;

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <PageHeader
        title="Business Impact & Sustainability"
        subtitle="GHG Protocol Scope 1 + Scope 3 Category 4"
        right={<RangeToggle />}
      />

      <DashboardKpis kpis={buildKpiCards(kpi)} columns={4} />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-[22px] font-bold text-brand">
            Baseline NN → M4 Balanced
          </h2>
          <p className="text-[14px] text-ink/70">
            Tour-level, one scenario — the only comparison we actually measured
          </p>
          <BeforeAfter rows={data.before_after} />
        </section>

        <section className="space-y-2">
          <h2 className="text-[22px] font-bold text-brand">
            Decision Distribution
          </h2>
          <p className="text-[14px] text-ink/70">Last 24h · all events processed</p>
          <div className="glass-card p-4">
            <ClientOnly fallback={<ChartFallback />}>
              {() => <DecisionDistributionChart data={data.distribution} />}
            </ClientOnly>
          </div>
        </section>
      </div>

      <section className="space-y-2">
        <h2 className="text-[22px] font-bold text-brand">
          AI Decision Impact Summary
        </h2>
        <ImpactSummary summary={data.summary} />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="space-y-2">
          <h2 className="text-[22px] font-bold text-brand">
            Sustainability Impact Today
          </h2>
          <div className="glass-card p-5">
            <dl className="space-y-2">
              {data.sustainability.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between gap-4 text-[14px]"
                >
                  <dt className="text-brand">{s.label}</dt>
                  <dd className="text-right font-bold text-ink">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-[22px] font-bold text-brand">
            Decision Performance
          </h2>
          <DecisionPerformance perf={data.performance} />
        </section>
      </div>
    </div>
  );
}

function ChartFallback() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-brand">
      Loading chart…
    </div>
  );
}
