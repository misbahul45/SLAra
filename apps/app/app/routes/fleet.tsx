import type { Route } from "./+types/fleet";
import { PageHeader } from "~/components/PageHeader";
import { PhasePlaceholder } from "~/components/PhasePlaceholder";

export function meta(_: Route.MetaArgs) {
  return [{ title: "SLAra — Live Fleet Map" }];
}

export default function Fleet() {
  return (
    <>
      <PageHeader title="Live Fleet Map" subtitle="Real-time vehicle telemetry" />
      <PhasePlaceholder phase={2} note="Leaflet map + vehicle telemetry detail panel" />
    </>
  );
}
