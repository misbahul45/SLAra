import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { RouteOption, HubRef, DestinationRef, LatLng } from "~/lib/types";
import { TIER_HEX } from "~/lib/tier";

// Client-only (leaflet touches `window`): loaded via React.lazy from View B, and only
// rendered inside the decide-result block which never exists during SSR. Default export
// so the dynamic import resolves cleanly.

interface RouteMapProps {
  routes: RouteOption[];
  origin: HubRef;
  destination: DestinationRef;
  selectedRouteId: string;
  onSelect: (routeId: string) => void;
}

function FitBounds({ positions }: { positions: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(L.latLngBounds(positions), { padding: [30, 30] });
    }
  }, [map, positions]);
  return null;
}

export default function RouteMap({
  routes,
  origin,
  destination,
  selectedRouteId,
  onSelect,
}: RouteMapProps) {
  const allPoints: LatLng[] = routes.flatMap((r) => r.geometry);
  // Draw the selected route last so its thicker line sits on top.
  const ordered = [...routes].sort(
    (a, b) =>
      Number(a.route_id === selectedRouteId) -
      Number(b.route_id === selectedRouteId),
  );

  return (
    <MapContainer
      center={[origin.lat, origin.lng]}
      zoom={12}
      className="h-full w-full"
      style={{ background: "#0e1420" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds positions={allPoints} />

      {ordered.map((r) => {
        const selected = r.route_id === selectedRouteId;
        return (
          <Polyline
            key={r.route_id}
            positions={r.geometry}
            pathOptions={{
              color: TIER_HEX[r.risk_tier],
              weight: selected ? 6 : 3,
              opacity: selected ? 1 : 0.45,
            }}
            eventHandlers={{ click: () => onSelect(r.route_id) }}
          />
        );
      })}

      <CircleMarker
        center={[origin.lat, origin.lng]}
        radius={7}
        pathOptions={{
          color: "#4cc9f0",
          fillColor: "#4cc9f0",
          fillOpacity: 1,
          weight: 2,
        }}
      >
        <Tooltip>{origin.name}</Tooltip>
      </CircleMarker>

      <CircleMarker
        center={[destination.lat, destination.lng]}
        radius={7}
        pathOptions={{
          color: "#e6edf3",
          fillColor: "#16202e",
          fillOpacity: 1,
          weight: 2,
        }}
      >
        <Tooltip>{destination.label}</Tooltip>
      </CircleMarker>
    </MapContainer>
  );
}
