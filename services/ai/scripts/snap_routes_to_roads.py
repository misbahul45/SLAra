"""Snap M4 tour waypoints to the road network (build-time, run once).

Kandidat M4 hanya menyimpan `geometry` = urutan stop tur (18 titik). Ditarik
sebagai garis lurus di peta -> memotong gedung/sawah. Skrip ini mengubah tiap
tur jadi geometri jalan sebenarnya lewat OSRM `route` service, lalu menulis
field baru `road_geometry` (list [lat, lng]) ke tiap kandidat. Field `geometry`
lama TIDAK diubah (masih dipakai untuk marker stop & urutan).

Best practice (lihat docs/contracts/rest/v1.md §B-bis):
  - Precompute, bukan runtime — hasil di-commit, FE tinggal menggambar (ADR-004).
  - OSRM `route` (bukan `match`): titik adalah waypoint terurut, bukan trace GPS.
  - `overview=simplified` — Douglas-Peucker; visual identik di zoom kota, hemat titik.
  - Fail-soft di FE: Polyline pakai `road_geometry ?? geometry`.

Jalankan:
    python scripts/snap_routes_to_roads.py
    python scripts/snap_routes_to_roads.py --server http://localhost:5000  # OSRM self-host
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data" / "pareto_routes_jabodetabek_urban.json"
DEFAULT_SERVER = "https://router.project-osrm.org"


def snap(waypoints: list[list[float]], server: str) -> list[list[float]]:
    """waypoints: [[lat, lng], ...] terurut -> [[lat, lng], ...] mengikuti jalan."""
    # OSRM memakai urutan lng,lat.
    coords = ";".join(f"{lng},{lat}" for lat, lng in waypoints)
    url = (
        f"{server}/route/v1/driving/{coords}"
        "?overview=simplified&geometries=geojson&continue_straight=false"
    )
    with urllib.request.urlopen(url, timeout=30) as resp:
        payload = json.load(resp)
    if payload.get("code") != "Ok":
        raise RuntimeError(f"OSRM code={payload.get('code')}: {payload.get('message')}")
    # GeoJSON balik sebagai [lng, lat]; ubah ke [lat, lng] + bulatkan ~1m.
    line = payload["routes"][0]["geometry"]["coordinates"]
    return [[round(lat, 5), round(lng, 5)] for lng, lat in line]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", default=DEFAULT_SERVER, help="OSRM base URL")
    ap.add_argument("--dry-run", action="store_true", help="jangan tulis file")
    args = ap.parse_args()

    doc = json.loads(DATA.read_text(encoding="utf-8"))
    candidates = doc["candidates"]
    print(f"Snapping {len(candidates)} kandidat via {args.server} ...")

    for c in candidates:
        wpts = c["geometry"]
        road = snap(wpts, args.server)
        c["road_geometry"] = road
        print(f"  {c['route_id']:<18} {c['label']:<10} "
              f"{len(wpts)} stop -> {len(road)} titik jalan")
        time.sleep(1.0)  # sopan ke server publik

    if args.dry_run:
        print("(dry-run) tidak menulis file.")
        return 0

    # File sumber: indent 1-spasi + ASCII-escaped (mis. ·) — pertahankan
    # keduanya agar diff minimal & file tetap murni ASCII (aman dibaca cp1252).
    DATA.write_text(json.dumps(doc, ensure_ascii=True, indent=1), encoding="utf-8")
    print(f"Ditulis ke {DATA.relative_to(DATA.parent.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
