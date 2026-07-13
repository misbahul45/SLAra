import {
  type RouteConfig,
  index,
  route,
  layout,
} from "@react-router/dev/routes";

// All 6 pages live under the persistent AppShell (sidebar) layout.
export default [
  layout("layouts/app-shell.tsx", [
    index("routes/dashboard.tsx"),
    route("fleet", "routes/fleet.tsx"),
    route("recommendation", "routes/recommendation.tsx"),
    route("optimization", "routes/optimization.tsx"),
    route("approvals", "routes/approvals.tsx"),
    route("impact", "routes/impact.tsx"),
  ]),
] satisfies RouteConfig;
