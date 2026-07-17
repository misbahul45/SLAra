import { CONFIG } from "../config.js";

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.aiTimeoutMs);
  try {
    const res = await fetch(`${CONFIG.aiBase}${path}`, {
      method, signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally { clearTimeout(timer); }
}

export interface M1Out { eta_p50_min: number; eta_p90_min: number; risk_tier: "SAFE" | "WARNING" | "CRITICAL";
  slack_p90_min: number; conf_m1: number; model_version: string; }
export interface M2Out { hub_id: string; dwell_p50_minutes: number; dwell_p90_minutes: number;
  model_confidence: number; dwell_p90_exceeds_threshold: boolean; m2_degraded: boolean;
  queue_state: { queue_length: number; truck_count: number; dock_utilization: number }; }
export interface M3Out { co2_kg: number; }
export interface M4Candidate { route_id: string; label: string; eta_p50_min: number; eta_p90_min: number;
  risk_tier: string; cost_idr: number; co2_kg: number; distance_km: number; sla_risk: number;
  geometry: [number, number][]; road_geometry?: [number, number][];
  stop_arrivals: { stop_idx: number; arrival_p50_min: number; arrival_p90_min: number }[];
  vs_baseline: Record<string, number>; }
export interface M4Out { candidates: M4Candidate[]; cs_m4: number;
  scenario: { stops: { idx: number; deadline_min: number }[] };
  pareto_stats: Record<string, unknown>; convergence_hv: number[];
  baseline_distance_only_nn: Record<string, unknown>; }
export interface M5Out { shap_top5: { feature: string; impact_min: number; direction: string }[]; base_value_min: number; }
export interface Health { models: Record<string, Record<string, unknown>>; }

export const ai = {
  m1: (f: Record<string, number>) => call<M1Out>("POST", "/internal/m1/eta", f),
  m2: (hub_id: string, condition: string) => call<M2Out>("POST", "/internal/m2/dwell", { hub_id, condition }),
  m3: (distance_km: number, vehicle_type: string, load_kg: number) =>
    call<M3Out>("POST", "/internal/m3/carbon", { distance_km, vehicle_type, load_kg }),
  m4: () => call<M4Out>("GET", `/internal/m4/routes?scenario=${CONFIG.m4Scenario}`),
  m5: (f: Record<string, number>) => call<M5Out>("POST", "/internal/m5/explain", f),
  health: () => call<Health>("GET", "/health"),
};
