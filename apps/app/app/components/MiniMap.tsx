import { useMemo } from "react";
import Map, { Marker } from "react-map-gl/maplibre";
import { basemapStyle } from "~/lib/basemap";
import type { MapMarker } from "~/lib/types";

// Client-only (maplibre-gl touches `window`); loaded via React.lazy. A lightweight
// map for the dashboard fleet panel and reused on the Live Fleet Map page.

interface MiniMapProps {
  center: [number, number]; // [lat, lng]
  zoom?: number;
  markers?: MapMarker[];
}

export default function MiniMap({ center, zoom = 12, markers = [] }: MiniMapProps) {
  const mapStyle = useMemo(() => basemapStyle(), []);
  return (
    <Map
      initialViewState={{ longitude: center[1], latitude: center[0], zoom }}
      mapStyle={mapStyle}
      style={{ width: "100%", height: "100%" }}
      attributionControl={{ compact: true }}
    >
      {markers.map((m, i) => (
        // Index key: two vehicles can share a coordinate, and the list is
        // replaced wholesale on each load (never reordered in place).
        <Marker key={i} longitude={m.lng} latitude={m.lat} anchor="center">
          <span
            title={m.label}
            className="block h-4 w-4 rounded-full border-2 border-white shadow"
            style={{ background: m.color ?? "#780001" }}
          />
        </Marker>
      ))}
    </Map>
  );
}
