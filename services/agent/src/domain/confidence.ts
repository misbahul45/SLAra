import { CONFIG, type ComponentKey } from "../config.js";

export interface Component { value: number; weight: number; label: string; detail?: Record<string, number>; }
export type Breakdown = Record<ComponentKey, Component>;

const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** conf_m1 v2 (ADR-005): kepastian interval × kepastian deadline.
 *  interval  = 1 - min(1,(P90-P50)/(2*P50))  — dari ai service (formula desain asli)
 *  deadline  = sigmoid(slack_p90 / 30)       — tekanan SLA; slack negatif => turun cepat */
export function confM1(intervalCertainty: number, slackP90Min: number) {
  const deadline = sigmoid(slackP90Min / CONFIG.slackSigmoidScaleMin);
  return { value: clamp(intervalCertainty * deadline),
           detail: { interval_certainty: round3(intervalCertainty), deadline_certainty: round3(deadline) } };
}

/** conf_m2: kesehatan model M2 × kondisi situasional hub (dwell P90 vs toleransi operasional). */
export function confM2(modelConfidence: number, dwellP90Min: number) {
  const situational = Math.exp(-Math.max(0, dwellP90Min - CONFIG.dwellToleranceMin) / CONFIG.dwellDecayMin);
  return { value: clamp(modelConfidence * situational),
           detail: { model_health: round3(modelConfidence), situational_certainty: round3(situational) } };
}

export function aggregate(values: Record<ComponentKey, number>): number {
  return round3((Object.keys(CONFIG.weights) as ComponentKey[])
    .reduce((s, k) => s + CONFIG.weights[k] * values[k], 0));
}

const DRIVER_LABEL: Record<ComponentKey, string> = {
  conf_m1: "wide_eta_interval_or_deadline_pressure",
  conf_m2: "hub_congestion",
  cs_m4: "route_optimality",
  data_freshness: "stale_telemetry",
  audit_validity: "audit_gap",
};

/** Komponen dgn kontribusi tertimbang paling hilang (weight*(1-value)) = pendorong ketidakpastian. */
export function primaryDriver(values: Record<ComponentKey, number>, breakdown: Breakdown): string {
  const worst = (Object.keys(CONFIG.weights) as ComponentKey[])
    .map(k => ({ k, loss: CONFIG.weights[k] * (1 - values[k]) }))
    .sort((a, b) => b.loss - a.loss)[0].k;
  if (worst === "conf_m1") {
    const d = breakdown.conf_m1.detail!;
    return d.deadline_certainty < d.interval_certainty ? "deadline_pressure" : "wide_eta_interval";
  }
  return DRIVER_LABEL[worst];
}

export function round3(x: number) { return Math.round(x * 1000) / 1000; }
