/**
 * M6 — Deterministic Orchestration Core (ADR-002).
 * Struktur node mengikuti desain LangGraph; eksekusi berurutan dgn conditional edge:
 *   dwell(M2) -> eta(M1, inject dwell_p50) -> carbon(M3) -> routes(M4)
 *   -> [tier != SAFE] explain(M5) -> confidence -> branch auto/escalate
 * Failure cascade (desain final):
 *   M1/M4 gagal  -> FORCED ESCALATE (kritis)
 *   M2 gagal     -> degradasi: dwell fallback, conf_m2=0.5, lanjut
 *   M3 gagal     -> co2 null, lanjut (tidak di formula)
 *   M5 gagal     -> shap null, confidence TIDAK berubah
 */
import { CONFIG, type ComponentKey } from "../config.js";
import { ai, type M2Out, type M4Out } from "../clients/ai.js";
import { aggregate, confM1, confM2, primaryDriver, round3, type Breakdown } from "../domain/confidence.js";
import type { Shipment } from "../state.js";

const TIER_RANK = { SAFE: 0, WARNING: 1, CRITICAL: 2 } as const;
type Tier = keyof typeof TIER_RANK;

let auditValidity: number | null = null;
let m1Thresholds = { safe: 15, critical: -30 };

export async function initAudit(): Promise<void> {
  try {
    const h = await ai.health();
    const m = h.models as Record<string, any>;
    const ok = m.m1?.loaded && m.m4?.loaded && m.m5?.additivity_ok;
    auditValidity = ok ? 1.0 : 0.5;
    if (m.m1?.thresholds) m1Thresholds = {
      safe: m.m1.thresholds.safe_min_slack_minutes, critical: m.m1.thresholds.critical_max_slack_minutes };
  } catch { auditValidity = 0.5; }
}

function tierOf(slack: number): Tier {
  return slack >= m1Thresholds.safe ? "SAFE" : slack >= m1Thresholds.critical ? "WARNING" : "CRITICAL";
}

export async function decide(s: Shipment) {
  const t0 = performance.now();
  if (auditValidity === null) await initAudit();
  const degraded: string[] = [];

  // ---- Node 1: M2 dwell ----
  let m2: M2Out | null = null;
  try { m2 = await ai.m2(s.origin_hub.hub_id, s.hub_condition); }
  catch { degraded.push("m2_unreachable"); }
  const dwellP50 = m2?.dwell_p50_minutes ?? CONFIG.m4DwellBakedP50;
  const dwellP90 = m2?.dwell_p90_minutes ?? CONFIG.m4DwellBakedP90;

  // ---- Node 2: M1 eta (inject dwell M2 -> fitur ke-10) ----
  const m1feat = {
    distance_km: s.distance_km, weather_severity: s.weather_severity, traffic_index: s.traffic_index,
    is_weekend: 0, vehicle_type_encoded: s.vehicle_type_encoded, pickup_hour: s.pickup_hour,
    hub_dwell_time_predicted: dwellP50, promised_deadline: s.deadline_minutes,
  };
  let m1;
  try { m1 = await ai.m1(m1feat); }
  catch { return forcedEscalate(s, "M1_UNAVAILABLE", t0); }

  // ---- Node 3: M3 carbon ----
  let co2: number | null = null;
  try { co2 = (await ai.m3(s.distance_km, s.vehicle_type, s.load_kg)).co2_kg; }
  catch { degraded.push("m3_unreachable"); }

  // ---- Node 4: M4 routes (per-shipment view via stop_arrivals + dwell rebase) ----
  let m4: M4Out;
  try { m4 = await ai.m4(); }
  catch { return forcedEscalate(s, "M4_UNAVAILABLE", t0); }
  // routes[] = perbandingan LEVEL-PLAN apa adanya dari skenario optimasi M4
  // (sesuai desain "Pareto Plan Comparison"). Efek live M2/M1 utk shipment ini
  // tampil di blok eta + confidence + hub — BUKAN di metrik plan (hindari
  // pencampuran semantik per-shipment vs per-tur).
  const routes = m4.candidates.map(c => ({
    route_id: c.route_id, label: c.label,
    eta_p50_min: c.eta_p50_min, eta_p90_min: c.eta_p90_min,
    risk_tier: c.risk_tier as Tier, late_share_p90: (c as any).late_share_p90 ?? null,
    cost_idr: c.cost_idr, co2_kg: c.co2_kg, distance_km: c.distance_km,
    tour_sla_risk: c.sla_risk, geometry: c.geometry,
  }));
  const selected = [...routes].sort((a, b) =>
    TIER_RANK[a.risk_tier as Tier] - TIER_RANK[b.risk_tier as Tier]
    || a.tour_sla_risk - b.tour_sla_risk || a.cost_idr - b.cost_idr)[0];

  // ---- Node 5 (conditional): M5 explain — lazy, hanya non-SAFE ----
  let shap: { feature: string; impact_min: number; direction: string }[] | null = null;
  if (m1.risk_tier !== "SAFE") {
    try { shap = (await ai.m5(m1feat)).shap_top5; }
    catch { degraded.push("m5_unreachable"); }
  }

  // ---- Node 6: confidence ----
  const c1 = confM1(m1.conf_m1, m1.slack_p90_min);
  const c2 = m2 ? confM2(m2.model_confidence, m2.dwell_p90_minutes)
                : { value: 0.5, detail: { model_health: 0.5, situational_certainty: 1 } };
  const values: Record<ComponentKey, number> = {
    conf_m1: round3(c1.value), conf_m2: round3(c2.value), cs_m4: round3(m4.cs_m4),
    data_freshness: CONFIG.dataFreshness, audit_validity: auditValidity!,
  };
  const breakdown: Breakdown = {
    conf_m1: { value: round3(c1.value), weight: CONFIG.weights.conf_m1, label: "ETA & deadline certainty (M1)", detail: c1.detail },
    conf_m2: { value: round3(c2.value), weight: CONFIG.weights.conf_m2, label: "Hub dwell certainty (M2)", detail: c2.detail },
    cs_m4: { value: round3(m4.cs_m4), weight: CONFIG.weights.cs_m4, label: "Route optimality (M4)" },
    data_freshness: { value: CONFIG.dataFreshness, weight: CONFIG.weights.data_freshness, label: "Data freshness" },
    audit_validity: { value: auditValidity!, weight: CONFIG.weights.audit_validity, label: "Audit validity" },
  };
  const confidence = aggregate(values);
  const decision = confidence >= CONFIG.threshold ? "AUTO_EXECUTE" : "ESCALATE";
  const driver = decision === "ESCALATE" ? primaryDriver(values, breakdown) : null;

  return {
    shipment_id: s.shipment_id,
    decided_at: new Date().toISOString(),
    decision, confidence, threshold: CONFIG.threshold,
    confidence_breakdown: breakdown,
    primary_uncertainty_driver: driver,
    eta: { p50_min: m1.eta_p50_min, p90_min: m1.eta_p90_min, risk_tier: m1.risk_tier,
           slack_p90_min: m1.slack_p90_min, co2_kg: co2, dwell_source: m2 ? "m2_live" : "fallback" },
    hub: m2 ? { hub_id: m2.hub_id, dwell_p50_min: m2.dwell_p50_minutes, dwell_p90_min: m2.dwell_p90_minutes,
                queue: m2.queue_state, dwell_above_threshold: m2.dwell_p90_exceeds_threshold } : null,
    selected_route_id: selected.route_id,
    routes, shap_top5: shap,
    explanation: buildExplanation(decision, confidence, driver, m1, m2, selected),
    degraded: degraded.length ? degraded : null,
    latency_ms: Math.round(performance.now() - t0),
  };
}

function forcedEscalate(s: Shipment, code: string, t0: number) {
  return {
    shipment_id: s.shipment_id, decided_at: new Date().toISOString(),
    decision: "ESCALATE" as const, confidence: 0, threshold: CONFIG.threshold,
    confidence_breakdown: null, primary_uncertainty_driver: "critical_model_unavailable",
    eta: null, hub: null, selected_route_id: null, routes: [], shap_top5: null,
    explanation: `Forced escalation: ${code} — critical model down, operator review required (failure cascade).`,
    degraded: [code], error: { code, degraded: true },
    latency_ms: Math.round(performance.now() - t0),
  };
}

function buildExplanation(decision: string, conf: number, driver: string | null,
  m1: { eta_p50_min: number; eta_p90_min: number; risk_tier: string; slack_p90_min: number },
  m2: M2Out | null, selected: { route_id: string; label: string; risk_tier: string }): string {
  const spread = round3(m1.eta_p90_min - m1.eta_p50_min);
  if (decision === "AUTO_EXECUTE")
    return `Auto-executed: confidence ${conf} >= 0.70. ETA ${m1.eta_p50_min}m (P90 ${m1.eta_p90_min}m, spread ${spread}m), tier ${m1.risk_tier}. Route ${selected.route_id} (${selected.label}) selected.`;
  const hubTxt = m2?.dwell_p90_exceeds_threshold
    ? ` Hub ${m2.hub_id} congested (dwell P90 ${m2.dwell_p90_minutes}m, queue ${m2.queue_state.queue_length}).` : "";
  return `Escalated: confidence ${conf} < 0.70 (driver: ${driver}). Slack@P90 ${m1.slack_p90_min}m, tier ${m1.risk_tier}.${hubTxt} Route ${selected.route_id} (${selected.label}) proposed — operator judgment required.`;
}
