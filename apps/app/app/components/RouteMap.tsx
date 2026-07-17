import { useCallback, useEffect, useMemo, useState } from "react";
import Map, {
  Layer,
  Marker,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import type { FeatureCollection, LineString } from "geojson";
import { basemapStyle } from "~/lib/basemap";
import type { RouteOption, HubRef, DestinationRef, LatLng } from "~/lib/types";
import { TIER_HEX } from "~/lib/tier";

// Client-only (maplibre-gl touches `window`): loaded via React.lazy inside
// <ClientOnly>, so it never runs during SSR. Default export so the dynamic
// import resolves cleanly.

interface RouteMapProps {
  routes: RouteOption[];
  origin: HubRef;
  destination: DestinationRef;
  selectedRouteId: string;
  onSelect: (routeId: string) => void;
  /** "tier" colors by risk tier (default); "selection" colors selected vs rest. */
  colorMode?: "tier" | "selection";
}

// Draw the route line from the road-snapped polyline; fall back to the straight
// stop geometry when a scenario has no road_geometry yet.
const lineOf = (r: RouteOption): LatLng[] => r.road_geometry ?? r.geometry;

export default function RouteMap({
  routes,
  origin,
  destination,
  selectedRouteId,
  onSelect,
  colorMode = "tier",
}: RouteMapProps) {
  const mapStyle = useMemo(() => basemapStyle(), []);
  const [map, setMap] = useState<MapRef | null>(null);
  const [loaded, setLoaded] = useState(false);

  const allPoints: LatLng[] = useMemo(() => routes.flatMap(lineOf), [routes]);

  // Honesty chip: OSRM sering hanya punya 1–2 jalur masuk akal utk satu leg, jadi
  // beberapa kandidat bisa berbagi jalur jalan yang sama. Saat itu terjadi, katakan —
  // jangan biarkan 3 garis bertumpuk terbaca sebagai "3 rute jalanan berbeda".
  const uniquePaths = useMemo(
    () => new Set(routes.map((r) => JSON.stringify(lineOf(r)))).size,
    [routes],
  );

  // One LineString feature per route; styling is data-driven from properties.
  const data: FeatureCollection<LineString> = useMemo(
    () => ({
      type: "FeatureCollection",
      features: routes.map((r) => {
        const selected = r.route_id === selectedRouteId;
        const color =
          colorMode === "selection"
            ? selected
              ? "#780001"
              : "#669bbb"
            : TIER_HEX[r.risk_tier];
        return {
          type: "Feature",
          properties: { route_id: r.route_id, selected, color },
          geometry: {
            type: "LineString",
            // GeoJSON is [lng, lat]; our LatLng is [lat, lng].
            coordinates: lineOf(r).map(([lat, lng]) => [lng, lat]),
          },
        };
      }),
    }),
    [routes, selectedRouteId, colorMode],
  );

  const fit = useCallback(() => {
    if (!map || allPoints.length === 0) return;
    const lats = allPoints.map((p) => p[0]);
    const lngs = allPoints.map((p) => p[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 36, duration: 0 },
    );
  }, [map, allPoints]);

  useEffect(() => {
    if (loaded) fit();
  }, [loaded, fit]);

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.route_id;
      if (typeof id === "string") onSelect(id);
    },
    [onSelect],
  );

  const [hovering, setHovering] = useState(false);

  return (
    <Map
      ref={setMap}
      initialViewState={{ longitude: origin.lng, latitude: origin.lat, zoom: 11 }}
      mapStyle={mapStyle}
      style={{ width: "100%", height: "100%" }}
      attributionControl={{ compact: true }}
      interactiveLayerIds={["routes-hit"]}
      onLoad={() => setLoaded(true)}
      onClick={handleClick}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      cursor={hovering ? "pointer" : "grab"}
    >
      <Source id="routes" type="geojson" data={data}>
        {/* Wide invisible hit target for easier clicking. */}
        <Layer
          id="routes-hit"
          type="line"
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{ "line-color": "#000000", "line-width": 16, "line-opacity": 0 }}
        />
        {/* Non-selected routes underneath. */}
        <Layer
          id="routes-base"
          type="line"
          filter={["!", ["get", "selected"]]}
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": ["get", "color"],
            "line-width": 3,
            "line-opacity": 0.45,
          }}
        />
        {/* Selected route on top, thicker and opaque. */}
        <Layer
          id="routes-selected"
          type="line"
          filter={["get", "selected"]}
          layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{
            "line-color": ["get", "color"],
            "line-width": 6,
            "line-opacity": 1,
          }}
        />
      </Source>

      <Marker longitude={origin.lng} latitude={origin.lat} anchor="center">
        <span title={origin.name} className="block h-3.5 w-3.5 rounded-full border-2 border-white bg-ink shadow" />
      </Marker>
      <Marker longitude={destination.lng} latitude={destination.lat} anchor="center">
        <span title={destination.label} className="block h-3.5 w-3.5 rounded-full border-2 border-white bg-accent shadow" />
      </Marker>

      {uniquePaths < routes.length && (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-white/85 px-2 py-1 text-[11px] font-medium text-ink shadow backdrop-blur">
          {uniquePaths === 1
            ? `${routes.length} candidates share 1 road path — plans differ by metrics, not streets`
            : `${routes.length} candidates on ${uniquePaths} road paths — overlapping plans differ by metrics`}
        </div>
      )}
    </Map>
  );
}
