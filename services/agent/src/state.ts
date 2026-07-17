import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ai } from "./clients/ai.js";

export interface Shipment {
  shipment_id: string; created_at: string;
  origin_hub: { hub_id: string; name: string; lat: number; lng: number };
  destination: { label: string; lat: number; lng: number };
  sla_type: string; deadline_minutes: number; distance_km: number;
  vehicle_type: string; vehicle_type_encoded: number; load_kg: number;
  weather_severity: number; traffic_index: number; pickup_hour: number;
  hub_condition: "normal" | "congested"; m4_stop_idx: number;
  decision_status: string; executed_route_id?: string;
  eta_p50_min?: number; eta_p90_min?: number; risk_tier?: string; hub_dwell_p50_min?: number; co2_kg?: number;
}

const here = dirname(fileURLToPath(import.meta.url));
export const shipments: Shipment[] = JSON.parse(readFileSync(join(here, "..", "data", "shipments.json"), "utf-8"));
export const byId = new Map(shipments.map(s => [s.shipment_id, s]));

/** Jalur jalan per-shipment origin→destination (OSRM, precomputed build-time via
 *  scripts/snap-shipment-routes.mjs) — dipakai /decide utk routes[].geometry sesuai
 *  kontrak §A3. Fail-soft: file absen → {} dan decide fallback ke garis lurus. */
export const shipmentRoutes: Record<string, { alternatives: [number, number][][] }> = (() => {
  try {
    return JSON.parse(readFileSync(join(here, "..", "data", "shipment_routes.json"), "utf-8")).routes;
  } catch { return {}; }
})();

let enriched = false;
/** Isi eta/tier list view dari model NYATA (M2 dwell -> M1) — lazy sekali. */
export async function enrich(): Promise<void> {
  if (enriched) return;
  await Promise.all(shipments.map(async s => {
    try {
      const m2 = await ai.m2(s.origin_hub.hub_id, s.hub_condition);
      const m1 = await ai.m1({
        distance_km: s.distance_km, weather_severity: s.weather_severity, traffic_index: s.traffic_index,
        is_weekend: 0, vehicle_type_encoded: s.vehicle_type_encoded, pickup_hour: s.pickup_hour,
        hub_dwell_time_predicted: m2.dwell_p50_minutes, promised_deadline: s.deadline_minutes,
      });
      const m3 = await ai.m3(s.distance_km, s.vehicle_type, s.load_kg);
      s.eta_p50_min = m1.eta_p50_min; s.eta_p90_min = m1.eta_p90_min; s.risk_tier = m1.risk_tier;
      s.hub_dwell_p50_min = m2.dwell_p50_minutes; s.co2_kg = m3.co2_kg;
    } catch { /* biarkan kosong; FE tampilkan "-" */ }
  }));
  enriched = true;
}

export function kpiSummary() {
  const tiers = { SAFE: 0, WARNING: 0, CRITICAL: 0 } as Record<string, number>;
  let autoCount = 0, decided = 0, latSum = 0, latN = 0;
  for (const s of shipments) {
    if (s.risk_tier) tiers[s.risk_tier] = (tiers[s.risk_tier] ?? 0) + 1;
    if (s.decision_status === "AUTO_EXECUTED") { autoCount++; decided++; }
    else if (["ESCALATED", "APPROVED", "REJECTED"].includes(s.decision_status)) decided++;
  }
  return {
    generated_at: new Date().toISOString(),
    active_shipments: shipments.length,
    tier_counts: tiers,
    on_time_rate_pct: null,
    auto_execute_rate_pct: decided ? Math.round((autoCount / decided) * 1000) / 10 : null,
    co2_saved_today_kg: null,
    avg_decision_latency_ms: latN ? Math.round(latSum / latN) : null,
  };
}
