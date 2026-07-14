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

export interface DashboardData {
  kpis: DashboardKpi[];
  events: EventFeedItem[];
  recommendation: ActiveRecommendation;
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

// ── AI Recommendation Detail page ────────────────────────────────────────────

export interface RecoEvent {
  event_id: string;
  title: string;
  severity: Severity;
  affected: number;
  detected_at: string;
}

/** "down" = improvement (green), "up" = increase/worse (amber), "neutral" = gray. */
export type MetricTone = "up" | "down" | "neutral";

export interface PlanMetric {
  label: string;
  value: string;
  delta?: string;
  tone?: MetricTone;
}

export interface PlanCard {
  tag: string;
  route: string;
  metrics: PlanMetric[];
  score?: number;
  variant: "current" | "recommended";
}

export type AgentStatus = "completed" | "active" | "pending";

export interface AgentNode {
  key: string;
  name: string;
  confidence: number;
  status: AgentStatus;
}

export interface ShapImportance {
  feature: string;
  value: number;
}

export interface ConfidenceScore {
  aggregate_pct: number;
  threshold_pct: number;
  passed: boolean;
  shap: ShapImportance[];
}

export interface AgentTraceItem {
  key: string;
  name: string;
  latency_ms: number;
  confidence: number;
  reasoning: string;
  top_shap?: string;
}

export interface RouteView {
  origin: HubRef;
  destination: DestinationRef;
  routes: RouteOption[];
  selected_route_id: string;
}

export interface RecommendationDetail {
  event: RecoEvent;
  current_plan: PlanCard;
  ai_plan: PlanCard;
  agents: AgentNode[];
  confidence: ConfidenceScore;
  trace: AgentTraceItem[];
  route_view: RouteView;
  /** Signed SHAP impacts (minutes) explaining the recommended route's ETA (M5). */
  eta_shap: ShapFeature[];
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
  convergence: GaPoint[];
  stats: LabeledValue[];
  weights: WeightTuning[];
  plans: ParetoPlan[];
  note: string;
}

// ── Human Approval page ──────────────────────────────────────────────────────

export interface ApprovalMetric {
  label: string;
  value: string;
}

export interface ApprovalDetail {
  approval_id: string;
  severity: Severity;
  title: string;
  shipments: number;
  ai_confidence: number;
  escalation_reason: string;
  recommendation: string;
  metrics: ApprovalMetric[];
  timeline: string[];
}

export interface ApprovalsData {
  items: ApprovalDetail[];
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

export interface ExecutionKpiData {
  kpis: DashboardKpi[];
  before_after: BeforeAfterRow[];
  distribution: DistributionBar[];
  summary: ImpactSummaryData;
  sustainability: LabeledValue[];
  performance: DecisionPerformanceData;
}
