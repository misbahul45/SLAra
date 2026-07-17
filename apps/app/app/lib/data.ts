// Data facade — the ONLY module UI/loaders import for data.
//
// Phase 4 is a PARTIAL cutover, so the switch is per-view, not global:
//
//   LIVE (agent :3000)  shipments · kpi · decide · resolve   <- the demo flow
//   LIVE (ai :8000)     m4Routes (Route Optimization evidence)
//   MOCK (local JSON)   dashboard · fleet · executionKpi
//
// VITE_USE_MOCK=false flips only the live group; the mock group stays on fixtures
// either way, because the agent does not serve those endpoints yet. Setting
// VITE_USE_MOCK=true forces everything back to fixtures (offline demo fallback).

import * as mock from "./mock";
import * as api from "./api";

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

/** Views the agent actually serves. Mocked only when explicitly forced offline. */
const live = USE_MOCK ? mock : api;

/**
 * Real /decide latency is 20-400ms — fast enough that the spinner can flash by
 * unseen on video. Hold the pending state to a floor so the loading -> result
 * transition is legible. This delays the UI only; it never touches the reported
 * latency_ms, which stays the agent's own measurement.
 */
const SPINNER_FLOOR_MS = 400;

async function notFasterThan<T>(ms: number, work: Promise<T>): Promise<T> {
  const [result] = await Promise.all([
    work,
    new Promise((r) => setTimeout(r, ms)),
  ]);
  return result;
}

// ── live group ──────────────────────────────────────────────────────────────────
export const getShipments = live.getShipments;
export const getKpi = live.getKpi;

/**
 * M4 Pareto evidence. Live from the ai service; VITE_USE_MOCK=true serves the
 * committed snapshot (mocks/m4-routes.json) so the offline demo keeps working.
 */
export const getM4Routes: typeof api.getM4Routes = USE_MOCK
  ? mock.getM4Routes
  : api.getM4Routes;

export const decide: typeof live.decide = (shipmentId) =>
  notFasterThan(SPINNER_FLOOR_MS, live.decide(shipmentId));

export const resolve: typeof live.resolve = (shipmentId, body) =>
  notFasterThan(SPINNER_FLOOR_MS, live.resolve(shipmentId, body));

// ── mock group (agent does not serve these yet) ─────────────────────────────────
// recommendation + optimization are NOT here: those views are live now
// (recommendation → /decide, optimization → getM4Routes above).
export const getDashboard = mock.getDashboard;
export const getFleet = mock.getFleet;
export const getExecutionKpi = mock.getExecutionKpi;

/** Which adapter the live group uses — handy for a dev badge / console check. */
export const dataSource: "mock" | "api" = USE_MOCK ? "mock" : "api";
