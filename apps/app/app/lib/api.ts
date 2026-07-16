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
  M4RoutesResponse,
  ResolveRequest,
  ResolveResponse,
  ShipmentsQuery,
  ShipmentsResponse,
} from "./types";

// Talks to the `agent` service (M6, :3000) — NOT ai:8000. The agent owns the four
// FE-facing endpoints and fans out to ai internally.
//
// The base differs by side, and it has to:
//   SSR     — fetch runs in Node, where a relative URL has no origin to resolve
//             against, so it must be absolute.
//   browser — must stay same-origin and go through the Vite proxy (vite.config.ts),
//             otherwise the POSTs trip CORS preflight against :3000. In production
//             the nginx gateway plays the proxy's role.
// VITE_API_BASE_URL is the older name, still honoured so existing .env files work.
const SSR_BASE =
  import.meta.env.VITE_API_BASE ??
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:3000/api/v1";

const BROWSER_BASE = import.meta.env.VITE_API_BASE_BROWSER ?? "/api/v1";

const BASE_URL = typeof window === "undefined" ? SSR_BASE : BROWSER_BASE;

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

// M4 lives on the ai service, not the agent: /decide carries routes[] but not
// pareto_stats/convergence_hv. Same isomorphic split as BASE_URL — SSR needs an
// absolute origin, the browser goes through the Vite proxy (or nginx in prod).
const AI_SSR_BASE = import.meta.env.VITE_AI_BASE ?? "http://localhost:8000";
const AI_BASE = typeof window === "undefined" ? AI_SSR_BASE : "";

export const M4_SCENARIO = "jabodetabek_urban_sameday";

export async function getM4Routes(
  scenario: string = M4_SCENARIO,
): Promise<M4RoutesResponse> {
  const res = await fetch(
    `${AI_BASE}/internal/m4/routes?scenario=${encodeURIComponent(scenario)}`,
    { headers: { "Content-Type": "application/json" } },
  );
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const body = data as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      body?.error?.message ?? `M4 routes failed: ${res.status}`,
      body,
    );
  }
  return data as M4RoutesResponse;
}

export function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>("/dashboard/summary");
}

export function getFleet(): Promise<FleetData> {
  return request<FleetData>("/fleet/telemetry");
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
