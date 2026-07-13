import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";

// Client-only (leaflet touches `window`); loaded via React.lazy. A lightweight map for
// the dashboard fleet panel and reused on the Live Fleet Map page.

export interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

interface MiniMapProps {
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
}

export default function MiniMap({
  center,
  zoom = 12,
  markers = [],
}: MiniMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className="h-full w-full"
      style={{ background: "#eef1f6" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {markers.map((m) => {
        const color = m.color ?? "#780001";
        return (
          <CircleMarker
            key={`${m.lat},${m.lng}`}
            center={[m.lat, m.lng]}
            radius={9}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 1,
              weight: 2,
            }}
          >
            {m.label && <Tooltip>{m.label}</Tooltip>}
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
