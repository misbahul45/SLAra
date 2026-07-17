#!/usr/bin/env bash
# Regenerate the self-hosted Protomaps basemap for the dashboard maps (MapLibre GL).
#
# Extracts a Jabodetabek bounding box (z0–15) from the Protomaps daily planet build
# using HTTP range reads — only the region's tiles are downloaded (~15 MB), not the
# whole planet. Output is a single .pmtiles file served at /basemap/jabodetabek.pmtiles.
#
# No API key, no per-load billing. Fonts/sprites use Protomaps' free static CDN
# (see app/lib/basemap.ts) — repoint those to /public for full offline.
#
# Requires the go-pmtiles CLI:
#   go install github.com/protomaps/go-pmtiles@latest   # -> $(go env GOPATH)/bin/go-pmtiles
#
# Usage (from apps/app/):
#   bash scripts/extract-basemap.sh [YYYYMMDD]
set -euo pipefail

BUILD_DATE="${1:-20260715}"                 # a build that exists at build.protomaps.com
BBOX="106.986,-6.358,107.184,-6.157"        # minLon,minLat,maxLon,maxLat (Jabodetabek + pad)
OUT="public/basemap/jabodetabek.pmtiles"
PMTILES="$(go env GOPATH)/bin/go-pmtiles"

mkdir -p "$(dirname "$OUT")"
"$PMTILES" extract "https://build.protomaps.com/${BUILD_DATE}.pmtiles" "$OUT" \
  --bbox="$BBOX" --maxzoom=15
echo "Wrote $OUT"
