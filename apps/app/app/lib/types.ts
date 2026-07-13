// SLAra API types — derived verbatim from SLARA_API_CONTRACT.md v1 (FROZEN 13 Jul 2026).
// Single source of truth for all FE data shapes. No `any` anywhere downstream.
// Conventions: snake_case fields, ISO 8601 UTC timestamps, km, minutes, IDR integer, kg CO2e.

// ── Enums (string unions, exact values from contract) ──────────────────────────

export type RiskTier = "SAFE" | "WARNING" | "CRITICAL";
export type VehicleType = "MOTORCYCLE" | "VAN" | "TRUCK_CDE" | "TRUCK_CDD";
export type SlaType = "SAME_DAY" | "NEXT_DAY" | "REGULAR";
export type DecisionStatus =
  | "PENDING"
  | "AUTO_EXECUTED"
  | "ESCALATED"
  | "APPROVED"
  | "REJECTED";
export type Decision = "AUTO_EXECUTE" | "ESCALATE";
export type ResolveAction = "APPROVE" | "REJECT";
export type ShapDirection = "increases_eta" | "decreases_eta";

/** `[lat, lng]` order (Leaflet-native), per contract §A3. */
export type LatLng = [number, number];

// ── §A1  GET /kpi/summary ──────────────────────────────────────────────────────

export interface TierCounts {
  SAFE: number;
  WARNING: number;
  CRITICAL: number;
}

export interface KpiSummary {
  generated_at: string;
  active_shipments: number;
  tier_counts: TierCounts;
  on_time_rate_pct: number;
  auto_execute_rate_pct: number;
  co2_saved_today_kg: number;
  avg_decision_latency_ms: number;
}

// ── §A2  GET /shipments ─────────────────────────────────────────────────────────

export interface HubRef {
  hub_id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface DestinationRef {
  label: string;
  lat: number;
  lng: number;
}

export interface Shipment {
  shipment_id: string;
  created_at: string;
  origin_hub: HubRef;
  destination: DestinationRef;
  sla_type: SlaType;
  promised_deadline: string;
  distance_km: number;
  vehicle_type: VehicleType;
  load_kg: number;
  eta_p50_min: number;
  eta_p90_min: number;
  risk_tier: RiskTier;
  hub_dwell_p50_min: number;
  co2_kg: number;
  decision_status: DecisionStatus;
}

export interface ShipmentsResponse {
  shipments: Shipment[];
  total: number;
}

/** Optional query params for GET /shipments. */
export interface ShipmentsQuery {
  tier?: RiskTier;
  limit?: number;
}

// ── §A3  POST /shipments/{id}/decide ────────────────────────────────────────────

export interface ConfidenceComponent {
  value: number;
  weight: number;
  label: string;
}

/** Five weighted components; `confidence = Σ(value × weight)`. */
export interface ConfidenceBreakdown {
  conf_m1: ConfidenceComponent;
  conf_m2: ConfidenceComponent;
  cs_m4: ConfidenceComponent;
  data_freshness: ConfidenceComponent;
  audit_validity: ConfidenceComponent;
}

export interface RouteOption {
  route_id: string;
  label: string;
  eta_p50_min: number;
  eta_p90_min: number;
  risk_tier: RiskTier;
  cost_idr: number;
  co2_kg: number;
  distance_km: number;
  geometry: LatLng[];
}

export interface ShapFeature {
  feature: string;
  impact_min: number;
  direction: ShapDirection;
}

export interface DecideResponse {
  shipment_id: string;
  decided_at: string;
  decision: Decision;
  confidence: number;
  threshold: number;
  confidence_breakdown: ConfidenceBreakdown;
  primary_uncertainty_driver: string;
  selected_route_id: string;
  routes: RouteOption[];
  /** Non-null only when the selected route is WARNING|CRITICAL (M5 lazy). */
  shap_top5: ShapFeature[] | null;
  explanation: string;
  latency_ms: number;
}

// ── §A4  POST /shipments/{id}/resolve ───────────────────────────────────────────

export interface ResolveRequest {
  action: ResolveAction;
  route_id: string;
  operator_note?: string;
}

export interface ResolveResponse {
  shipment_id: string;
  decision_status: DecisionStatus;
  executed_route_id: string;
  resolved_at: string;
}

// ── §C  Error envelope (HTTP 200 + degraded, or 4xx/5xx) ─────────────────────────

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    degraded: boolean;
  };
}
