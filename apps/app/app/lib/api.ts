// Real adapter — talks to the FastAPI `ai` service. Same function signatures as mock.ts,
// so data.ts can swap between them via VITE_USE_MOCK with zero call-site changes.
// Base URL + contract: SLARA_API_CONTRACT.md (dev: http://localhost:8000/api/v1).

import type {
  ApiErrorBody,
  ApprovalsData,
  DashboardData,
  DecideResponse,
  ExecutionKpiData,
  FleetData,
  KpiSummary,
  OptimizationResult,
  RecommendationDetail,
  ResolveRequest,
  ResolveResponse,
  ShipmentsQuery,
  ShipmentsResponse,
} from "./types";

// Points at the `agent` service (M6, :3000) — NOT ai:8000. The agent owns the four
// FE-facing endpoints; it fans out to ai internally. VITE_API_BASE_URL is the older
// name and is still honoured so existing .env files keep working.
const BASE_URL =
  import.meta.env.VITE_API_BASE ??
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:3000/api/v1";

/** Thrown for non-2xx responses; carries the parsed error envelope when present. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;
  constructor(status: number, message: string, body: ApiErrorBody | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const body = data as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      body?.error?.message ?? `Request failed: ${res.status}`,
      body,
    );
  }
  return data as T;
}

export function getKpi(): Promise<KpiSummary> {
  return request<KpiSummary>("/kpi/summary");
}

export function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>("/dashboard/summary");
}

export function getFleet(): Promise<FleetData> {
  return request<FleetData>("/fleet/telemetry");
}

export function getRecommendation(): Promise<RecommendationDetail> {
  return request<RecommendationDetail>("/recommendation/latest");
}

export function getOptimization(): Promise<OptimizationResult> {
  return request<OptimizationResult>("/optimization/latest");
}

export function getApprovals(): Promise<ApprovalsData> {
  return request<ApprovalsData>("/approvals");
}

export function getExecutionKpi(): Promise<ExecutionKpiData> {
  return request<ExecutionKpiData>("/execution/kpi");
}

export function getShipments(
  query: ShipmentsQuery = {},
): Promise<ShipmentsResponse> {
  const params = new URLSearchParams();
  if (query.tier) params.set("tier", query.tier);
  if (typeof query.limit === "number") params.set("limit", String(query.limit));
  const qs = params.toString();
  return request<ShipmentsResponse>(`/shipments${qs ? `?${qs}` : ""}`);
}

export function decide(shipmentId: string): Promise<DecideResponse> {
  return request<DecideResponse>(
    `/shipments/${encodeURIComponent(shipmentId)}/decide`,
    { method: "POST", body: "{}" },
  );
}

export function resolve(
  shipmentId: string,
  body: ResolveRequest,
): Promise<ResolveResponse> {
  return request<ResolveResponse>(
    `/shipments/${encodeURIComponent(shipmentId)}/resolve`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
