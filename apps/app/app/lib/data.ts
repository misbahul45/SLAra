// Data facade — the ONLY module UI/loaders import for data. It picks the mock or the
// real adapter from VITE_USE_MOCK, so swapping to the live backend is a one-env-var change.
// Defaults to mock: real is used only when VITE_USE_MOCK is explicitly "false".

import * as mock from "./mock";
import * as api from "./api";

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

const adapter = USE_MOCK ? mock : api;

export const getKpi = adapter.getKpi;
export const getDashboard = adapter.getDashboard;
export const getShipments = adapter.getShipments;
export const decide = adapter.decide;
export const resolve = adapter.resolve;

/** Which adapter is live — handy for a dev badge / console sanity check. */
export const dataSource: "mock" | "api" = USE_MOCK ? "mock" : "api";
