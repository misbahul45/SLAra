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

/** `[lat, lng]` order, per contract §A3 (RouteMap converts to GeoJSON [lng, lat]). */
export type LatLng = [number, number];

// ── §A1  GET /kpi/summary ──────────────────────────────────────────────────────

export interface TierCounts {
  SAFE: number;
  WARNING: number;
  CRITICAL: number;
}

/**
 * Null means "we do not measure this", not "zero". The agent returns null for
 * on_time_rate_pct and co2_saved_today_kg because nothing computes them yet, and
 * for auto_execute_rate_pct / avg_decision_latency_ms until something is decided.
 * Render null as "—", never as a number.
 */
export interface KpiSummary {
  generated_at: string;
  active_shipments: number;
  tier_counts: TierCounts;
  on_time_rate_pct: number | null;
  auto_execute_rate_pct: number | null;
  co2_saved_today_kg: number | null;
  avg_decision_latency_ms: number | null;
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
  /** Sub-terms the agent exposes for conf_m1/conf_m2 (ADR-005). Absent on the others. */
  detail?: Record<string, number>;
}

/** Five weighted components; `confidence = Σ(value × weight)`. */
export interface ConfidenceBreakdown {
  conf_m1: ConfidenceComponent;
  conf_m2: ConfidenceComponent;
  cs_m4: ConfidenceComponent;
  data_freshness: ConfidenceComponent;
  audit_validity: ConfidenceComponent;
}

/**
 * Plan-level metrics for one M4 tour scenario — NOT per-shipment. Matches the
 * Figma "Pareto Plan Comparison". Live per-shipment risk lives in DecideResponse.eta.
 */
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
  /** Road-snapped polyline for drawing the route line. Falls back to `geometry` if absent. */
  road_geometry?: LatLng[];
  /** Share of tour stops arriving late at P90. Null when the scenario omits it. */
  late_share_p90?: number | null;
  /** SLA risk of the whole tour (drives selection order). */
  tour_sla_risk?: number;
}

export interface ShapFeature {
  feature: string;
  impact_min: number;
  direction: ShapDirection;
}

/** Live per-shipment ETA from M1, with M2 dwell injected at serving time. */
export interface DecideEta {
  p50_min: number;
  p90_min: number;
  risk_tier: RiskTier;
  slack_p90_min: number;
  /** Null when M3 is unreachable (failure cascade: carbon is not in the formula). */
  co2_kg: number | null;
  dwell_source: "m2_live" | "fallback";
}

/** Live hub state from M2. Null when M2 is unreachable (degraded path). */
export interface DecideHub {
  hub_id: string;
  dwell_p50_min: number;
  dwell_p90_min: number;
  queue: { queue_length: number; truck_count: number; dock_utilization: number };
  dwell_above_threshold: boolean;
}

export interface DecideResponse {
  shipment_id: string;
  decided_at: string;
  decision: Decision;
  confidence: number;
  threshold: number;
  /** Null only on forced escalation (M1/M4 down) — render the banner, not the gauge. */
  confidence_breakdown: ConfidenceBreakdown | null;
  /** Null when AUTO_EXECUTE: there is no uncertainty to attribute. */
  primary_uncertainty_driver: string | null;
  eta: DecideEta | null;
  hub: DecideHub | null;
  selected_route_id: string | null;
  routes: RouteOption[];
  /** Non-null only when the tier is WARNING|CRITICAL (M5 lazy). */
  shap_top5: ShapFeature[] | null;
  explanation: string;
  /** Names of models that degraded during this decision; null when all healthy. */
  degraded: string[] | null;
  latency_ms: number;
}

// ── §A4  POST /shipments/{id}/resolve ───────────────────────────────────────────

export interface ResolveRequest {
  action: ResolveAction;
  /** Required for APPROVE (the route the operator picked); omitted for REJECT. */
  route_id?: string;
  operator_note?: string;
}

export interface ResolveResponse {
  shipment_id: string;
  decision_status: DecisionStatus;
  /** Null after REJECT — nothing was executed. */
  executed_route_id: string | null;
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

// ── Dashboard page (view-model; mock-first, NOT in the frozen contract yet) ───────

export type KpiIconKind =
  | "box"
  | "warning"
  | "target"
  | "leaf"
  | "latency"
  | "auto"
  | "truck"
  | "fuel";

export interface DashboardKpi {
  icon: KpiIconKind;
  label: string;
  value: string;
  delta: string;
}

export interface EventFeedItem {
  event_id: string;
  title: string;
  affected: number;
}

export interface RecMetric {
  label: string;
  display: string;
  /** 0–100, drives the progress-bar fill width. */
  bar_pct: number;
}

export type Severity = "HIGH" | "MEDIUM" | "CRITICAL";

export interface ActiveRecommendation {
  event_id: string;
  severity: Severity;
  plan_title: string;
  route_text: string;
  metrics: RecMetric[];
}

export interface ProcessStep {
  title: string;
  sub: string;
}

export interface DashboardMap {
  center: [number, number];
  markers: MapMarker[];
}

export interface DashboardData {
  kpis: DashboardKpi[];
  process_steps: ProcessStep[];
  events: EventFeedItem[];
  recommendation: ActiveRecommendation;
  map: DashboardMap;
}

// ── Live Fleet Map page ──────────────────────────────────────────────────────

export interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

export interface TelemetryRow {
  label: string;
  value: string;
  /** Highlight color for the value (e.g. gold SLA tier). */
  accent?: "gold";
}

export interface TelemetryBar {
  label: string;
  display: string;
  bar_pct: number;
}

export interface VehicleTelemetry {
  shipment_id: string;
  status: string;
  rows: TelemetryRow[];
  bars: TelemetryBar[];
  map_center: [number, number];
}

export interface FleetData {
  selected: VehicleTelemetry;
  markers: MapMarker[];
}

// ── Shared view-model helpers ────────────────────────────────────────────────

/** "down" = improvement (green), "up" = increase/worse (red), "neutral" = ink. */
export type MetricTone = "up" | "down" | "neutral";

export interface RouteView {
  origin: HubRef;
  destination: DestinationRef;
  routes: RouteOption[];
  selected_route_id: string;
}

// ── Route Optimization page (NSGA-II) ────────────────────────────────────────

export interface GaPoint {
  generation: number;
  fitness: number;
}

export interface LabeledValue {
  label: string;
  value: string;
}

export interface WeightTuning {
  label: string;
  value: number;
}

export interface ParetoPlan {
  route_id: string;
  plan: string;
  route_via: string;
  eta: string;
  delay_risk: string;
  delay_tone?: MetricTone;
  fuel: string;
  co2: string;
  score: number;
  tag: string;
}

export interface OptimizationResult {
  objectives: string[];
  constraints: string[];
  convergence: GaPoint[];
  stats: LabeledValue[];
  weights: WeightTuning[];
  plans: ParetoPlan[];
  note: string;
  route_view: RouteView;
}

// ── Execution & KPI page ─────────────────────────────────────────────────────

export interface BeforeAfterRow {
  label: string;
  before: number;
  after: number;
  before_display: string;
  after_display: string;
}

export interface DistributionBar {
  label: string;
  value: number;
}

export type BulletTone = "good" | "up";

export interface ImpactBullet {
  tone: BulletTone;
  text: string;
}

export interface ImpactSummaryData {
  headline: string;
  bullets: ImpactBullet[];
  footnote: string;
}

export interface PerfBar {
  label: string;
  value_pct: number;
  display: string;
}

export interface DecisionPerformanceData {
  auto_resolution: PerfBar;
  percentiles: LabeledValue[];
  bars: PerfBar[];
}

// ── §B  GET /internal/m4/routes (ai service, precomputed Pareto — ADR-004) ───────

export interface ParetoStats {
  generations: number;
  population: number;
  pareto_solutions: number;
  hypervolume: number;
  runtime_s: number;
  engine: string;
  seed: number;
}

export interface M4Candidate {
  route_id: string;
  label: string;
  eta_p50_min: number;
  eta_p90_min: number;
  risk_tier: RiskTier;
  late_share_p90: number;
  cost_idr: number;
  co2_kg: number;
  distance_km: number;
  sla_risk: number;
  late_stops_p90: number;
  geometry: LatLng[];
  /** Road-snapped tour polyline (OSRM, precomputed). Absent → FE falls back to `geometry`. */
  road_geometry?: LatLng[];
  /** Percent deltas vs the distance-only NN baseline. */
  vs_baseline: { cost_pct: number; sla_risk_pct: number; co2_pct: number };
}

export interface M4Baseline {
  t50: number;
  t90: number;
  cost: number;
  co2: number;
  risk: number;
  late: number;
  risk_tier: RiskTier;
  late_share_p90: number;
}

export interface M4Scenario {
  id: string;
  hub?: { id: string; name: string; lat: number; lng: number };
  n_stops?: number;
  vehicle?: string;
  weather?: string;
  max_tour_min?: number;
}

export interface M4RoutesResponse {
  scenario: M4Scenario;
  objectives: string[];
  constraints: string[];
  baseline_distance_only_nn: M4Baseline;
  candidates: M4Candidate[];
  pareto_stats: ParetoStats;
  /** Hypervolume per generation snapshot — 51 points. Drives the convergence chart. */
  convergence_hv: number[];
  cs_m4: number;
}

export interface ExecutionKpiData {
  /** No `kpis` here: the cards are built live from /kpi/summary (lib/kpi-cards.ts). */
  before_after: BeforeAfterRow[];
  distribution: DistributionBar[];
  summary: ImpactSummaryData;
  sustainability: LabeledValue[];
  performance: DecisionPerformanceData;
}
