// Shared MapLibre GL basemap: self-hosted Protomaps vector tiles (.pmtiles).
//
// Best practice / no vendor lock-in (see docs/contracts/rest/v1.md §B-bis notes):
//   - Tiles: single self-hosted file at /basemap/jabodetabek.pmtiles (extracted from
//     the Protomaps planet build via `go-pmtiles extract`, bbox Jabodetabek, z0–15).
//     No API key, no per-load billing, works offline once served.
//   - Glyphs (label fonts) + sprite (icons): Protomaps' free, keyless, static asset
//     CDN. Not a lock-in concern; can be self-hosted for full offline — download
//     protomaps/basemaps-assets into /public and repoint GLYPHS/SPRITE below.
//
// This module touches `window` (maplibre-gl) and MUST only be imported by
// client-only components (RouteMap/MiniMap are lazy-loaded inside <ClientOnly>).

import maplibregl, { type StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import { layers, namedFlavor } from "@protomaps/basemaps";

const PMTILES_URL = "pmtiles:///basemap/jabodetabek.pmtiles";
const GLYPHS = "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf";
const SPRITE = "https://protomaps.github.io/basemaps-assets/sprites/v4/light";
const ATTRIBUTION =
  '<a href="https://openstreetmap.org">OpenStreetMap</a> · ' +
  '<a href="https://protomaps.com">Protomaps</a>';

// Register the pmtiles:// protocol exactly once. maplibre-gl keeps a global
// protocol registry, and react-map-gl/maplibre reuses this same module instance.
let registered = false;
export function ensurePmtilesProtocol(): void {
  if (registered) return;
  maplibregl.addProtocol("pmtiles", new Protocol().tile);
  registered = true;
}

/** MapLibre style backed by the self-hosted Protomaps basemap (light flavor). */
export function basemapStyle(): StyleSpecification {
  ensurePmtilesProtocol();
  return {
    version: 8,
    glyphs: GLYPHS,
    sprite: SPRITE,
    sources: {
      protomaps: {
        type: "vector",
        url: PMTILES_URL,
        attribution: ATTRIBUTION,
      },
    },
    layers: layers("protomaps", namedFlavor("light"), { lang: "en" }),
  };
}
