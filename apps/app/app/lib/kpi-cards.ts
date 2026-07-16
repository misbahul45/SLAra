// Builds the 6 dashboard KPI cards from LIVE /kpi/summary + model_stats.json.
//
// Previously these were hardcoded Figma values (OTD forecast, CO₂ saved today,
// active-shipment count, auto-resolution rate, avg latency). None had a measurement
// behind them, so they are gone: every card below is either live, sourced from
// model_stats.json, or explicitly marked "not measured".

import type { DashboardKpi, KpiSummary } from "./types";
import stats from "~/data/model_stats.json";

const NOT_MEASURED = "not measured";

export function buildKpiCards(kpi: KpiSummary): DashboardKpi[] {
  const atRisk = kpi.tier_counts.WARNING + kpi.tier_counts.CRITICAL;

  return [
    {
      icon: "box",
      label: "Active Shipment",
      value: String(kpi.active_shipments),
      delta: "live from agent",
    },
    {
      icon: "warning",
      label: "At-Risk Shipment",
      value: String(atRisk),
      delta: `${kpi.tier_counts.CRITICAL} critical · ${kpi.tier_counts.WARNING} warning`,
    },
    {
      // No OTD measurement exists. Showing a number here would be fabricating one.
      icon: "target",
      label: "OTD Forecast",
      value: kpi.on_time_rate_pct === null ? "—" : `${kpi.on_time_rate_pct} %`,
      delta: kpi.on_time_rate_pct === null ? NOT_MEASURED : "live",
    },
    {
      icon: "leaf",
      label: "CO₂ Saved Today",
      value:
        kpi.co2_saved_today_kg === null ? "—" : `${kpi.co2_saved_today_kg} kg`,
      delta: kpi.co2_saved_today_kg === null ? NOT_MEASURED : "live",
    },
    {
      // Live once anything has been decided; otherwise the recorded p50 benchmark.
      icon: "latency",
      label: "Avg Decision Latency",
      value:
        kpi.avg_decision_latency_ms === null
          ? `${stats.m6.decide_latency_p50_ms} ms`
          : `${kpi.avg_decision_latency_ms} ms`,
      delta:
        kpi.avg_decision_latency_ms === null
          ? `p50 benchmark · budget ${stats.m6.latency_budget_ms / 1000}s`
          : `budget ${stats.m6.latency_budget_ms / 1000}s`,
    },
    {
      icon: "auto",
      label: "Auto-Execute Rate",
      value:
        kpi.auto_execute_rate_pct === null
          ? "—"
          : `${kpi.auto_execute_rate_pct} %`,
      delta:
        kpi.auto_execute_rate_pct === null
          ? "no decisions yet"
          : `escalation band ${stats.m6.healthy_band_pct[0]}–${stats.m6.healthy_band_pct[1]}%`,
    },
  ];
}
