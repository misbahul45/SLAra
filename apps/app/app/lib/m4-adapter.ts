// Adapts the live M4 response (ai service) into the OptimizationResult shape the
// Route Optimization view already renders. All numbers here are live from
// GET /internal/m4/routes; labels follow the plan's wording. The agent/ai field
// names are never renamed — the mapping happens entirely on this side.

import type {
  GaPoint,
  LabeledValue,
  M4RoutesResponse,
  OptimizationResult,
  ParetoPlan,
  RouteView,
  WeightTuning,
} from "./types";

const idr = new Intl.NumberFormat("id-ID");

// Human-readable objective/constraint labels (plan §4). The API returns the raw
// engineering names (e.g. "sla_risk (via M1 v2 P90)"); these are the demo captions.
const OBJECTIVE_LABELS = ["SLA risk", "Cost", "CO₂"];
const CONSTRAINT_LABELS = ["driver hours", "vehicle capacity", "time windows"];

/** convergence_hv (51 hypervolume snapshots) → {generation, fitness} for the chart. */
function toConvergence(hv: number[], generations: number): GaPoint[] {
  if (hv.length <= 1) return hv.map((f, i) => ({ generation: i, fitness: f }));
  const step = generations / (hv.length - 1);
  return hv.map((fitness, i) => ({
    generation: Math.round(i * step),
    fitness: Number(fitness.toFixed(4)),
  }));
}

export function toOptimizationResult(m4: M4RoutesResponse): OptimizationResult {
  const p = m4.pareto_stats;

  const stats: LabeledValue[] = [
    { label: "GENERATIONS", value: String(p.generations) },
    { label: "POPULATION", value: String(p.population) },
    { label: "PARETO SOLUTIONS", value: String(p.pareto_solutions) },
    { label: "HYPERVOLUME", value: p.hypervolume.toFixed(3) },
    { label: "RUNTIME", value: `${p.runtime_s}s` },
    { label: "ENGINE", value: p.engine },
  ];

  // Post-Pareto selection weights are descriptive (knee/min-t50/min-co2), not a
  // tunable slider — surface cs_m4 and the objective mix instead of fake sliders.
  const weights: WeightTuning[] = [
    { label: "cs_m4 (composite score)", value: m4.cs_m4 },
    { label: "SLA risk objective", value: 1.0 },
    { label: "Cost objective", value: 1.0 },
    { label: "CO₂ objective", value: 1.0 },
  ];

  // Stop count comes from the scenario, not a constant — scenario #2 and #3
  // (design §7.3) will not have 16 stops.
  const nStops = m4.scenario.n_stops;

  const plans: ParetoPlan[] = m4.candidates.map((c) => ({
    route_id: c.route_id,
    plan: c.label,
    route_via: `${c.distance_km.toFixed(1)} km · ${c.late_stops_p90}${
      nStops ? `/${nStops}` : ""
    } stops late @P90`,
    eta: `${c.eta_p50_min}m`,
    delay_risk: `${Math.round(c.late_share_p90 * 100)}%`,
    delay_tone:
      c.risk_tier === "SAFE" ? "down" : c.risk_tier === "WARNING" ? "neutral" : "up",
    fuel: `Rp ${idr.format(c.cost_idr)}`,
    co2: `${c.co2_kg} kg`,
    score: Math.round((1 - c.sla_risk) * 100),
    tag: c.label.toUpperCase(),
  }));

  // Endpoints aren't in the M4 payload; use the tour's geometry extremes so the
  // map has an origin/destination to anchor on.
  const first = m4.candidates[0];
  const geo = first?.geometry ?? [];
  const origin = geo[0] ?? [-6.283, 107.086];
  const destination = geo[geo.length - 1] ?? [-6.222, 106.972];

  const route_view: RouteView = {
    origin: { hub_id: "M4-TOUR", name: "Tour start", lat: origin[0], lng: origin[1] },
    destination: { label: "Tour end", lat: destination[0], lng: destination[1] },
    selected_route_id: m4.candidates.find((c) => c.label === "Balanced")?.route_id
      ?? m4.candidates[0]?.route_id
      ?? "",
    routes: m4.candidates.map((c) => ({
      route_id: c.route_id,
      label: c.label,
      eta_p50_min: c.eta_p50_min,
      eta_p90_min: c.eta_p90_min,
      risk_tier: c.risk_tier,
      cost_idr: c.cost_idr,
      co2_kg: c.co2_kg,
      distance_km: c.distance_km,
      geometry: c.geometry,
      road_geometry: c.road_geometry,
    })),
  };

  // Dual-audience wording: keep the engineering terms (evidence for technical
  // judges) but gloss each one inline so a non-technical reader can follow.
  const bal = m4.candidates.find((c) => c.label === "Balanced");
  const vb = bal?.vs_baseline;
  const note = vb
    ? `Balanced sits at the knee of the Pareto front — the best-compromise point `
      + `(minimum Chebyshev distance to the ideal). Vs the distance-only baseline: `
      + `SLA risk ${vb.sla_risk_pct}%, cost +${vb.cost_pct}%, CO₂ +${vb.co2_pct}% — `
      + `lower risk is paid for with cost and carbon; there is no free win. `
      + `${p.engine}: ${p.generations} generations, population ${p.population}, `
      + `${p.pareto_solutions} Pareto solutions, hypervolume ${p.hypervolume.toFixed(3)}, `
      + `runtime ${p.runtime_s}s. Precomputed (ADR-004) for ONE scenario `
      + `(${m4.scenario.id}) — it does not adapt to live traffic or weather.`
    : `Precomputed Pareto (ADR-004), scenario ${m4.scenario.id}.`;

  return {
    objectives: OBJECTIVE_LABELS,
    constraints: CONSTRAINT_LABELS,
    convergence: toConvergence(m4.convergence_hv, p.generations),
    stats,
    weights,
    plans,
    note,
    route_view,
  };
}
