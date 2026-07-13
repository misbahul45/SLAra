import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("decide/:shipmentId", "routes/decide.$shipmentId.tsx"),
] satisfies RouteConfig;
