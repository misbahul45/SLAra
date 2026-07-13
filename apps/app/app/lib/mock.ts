// Mock adapter — serves the frozen contract shapes from local JSON fixtures with a
// simulated network delay, so loading UX (spinners, "deciding…") is exercised before
// the real FastAPI backend exists. Selected by VITE_USE_MOCK in data.ts.

import type {
  DecideResponse,
  KpiSummary,
  ResolveRequest,
  ResolveResponse,
  Shipment,
  ShipmentsQuery,
  ShipmentsResponse,
} from "./types";

import kpiJson from "~/mocks/kpi.json";
import shipmentsJson from "~/mocks/shipments.json";
import decide00400 from "~/mocks/decide-00400.json";
import decide00403 from "~/mocks/decide-00403.json";

// JSON imports widen literal unions (e.g. "SAFE" → string), so re-assert through
// `unknown` to the contract types. The fixtures are authored to match the contract.
const KPI = kpiJson as unknown as KpiSummary;
const SHIPMENTS = shipmentsJson as unknown as ShipmentsResponse;
const DECIDE_AUTO = decide00400 as unknown as DecideResponse;
const DECIDE_ESCALATE = decide00403 as unknown as DecideResponse;

/** Simulated network latency, 800–2000 ms (per SLARA_FRONTEND_PLAN §3). */
function delay(): Promise<void> {
  const ms = 800 + Math.floor(Math.random() * 1200);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Structured clone that preserves the declared type. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function getKpi(): Promise<KpiSummary> {
  await delay();
  return clone(KPI);
}

export async function getShipments(
  query: ShipmentsQuery = {},
): Promise<ShipmentsResponse> {
  await delay();
  let items: Shipment[] = SHIPMENTS.shipments;
  if (query.tier) {
    items = items.filter((s) => s.risk_tier === query.tier);
  }
  const total = items.length;
  if (typeof query.limit === "number") {
    items = items.slice(0, query.limit);
  }
  return clone({ shipments: items, total });
}

export async function decide(shipmentId: string): Promise<DecideResponse> {
  await delay();
  // Fixture routing: 00400 → AUTO_EXECUTE, 00403 → ESCALATE.
  // Any other id → clone the ESCALATE fixture with the id swapped in.
  let base: DecideResponse;
  if (shipmentId.endsWith("00400")) {
    base = DECIDE_AUTO;
  } else {
    base = DECIDE_ESCALATE;
  }
  const result = clone(base);
  result.shipment_id = shipmentId;
  result.decided_at = new Date().toISOString();
  return result;
}

export async function resolve(
  shipmentId: string,
  request: ResolveRequest,
): Promise<ResolveResponse> {
  await delay();
  return {
    shipment_id: shipmentId,
    decision_status: request.action === "APPROVE" ? "APPROVED" : "REJECTED",
    executed_route_id: request.route_id,
    resolved_at: new Date().toISOString(),
  };
}
