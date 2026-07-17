# Contracts — CHANGELOG

Riwayat perubahan kontrak di `docs/contracts/`. Format: [Keep a Changelog](https://keepachangelog.com/)
disederhanakan. Kewajiban: setiap perubahan `contracts/rest/` **wajib** punya entri di sini + request
Bruno yang sesuai di `docs/api/bruno/<service>/` pada PR yang sama (AGENTS.md §Task Routing).
Breaking change **wajib** disertai ADR di `docs/architecture/adr/`.

---

## [Unreleased] — 2026-07-16 · M4 jarak jalan OSRM + `road_geometry` (additive, **bukan breaking**)

Dua perubahan terkait pada `GET /internal/m4/routes` (payload precomputed):

**(a) Basis jarak → jarak jalan nyata.** Matriks jarak antar-stop M4 kini dari **OSRM `/table`**
(sebelumnya haversine×1.3, faktor detour konstan yang meleset ~1.5–1.9× di urban). NSGA-II
di-re-run pada jarak nyata → `distance_km`, `cost_idr`, `co2_kg`, `eta_*`, `sla_risk`, tier,
dan `stop_order` **berubah nilainya**. Bentuk/skema **tidak** berubah (field & tipe sama).
Balanced kini dipilih sebagai **knee Pareto** (min Chebyshev), konsisten dgn deskripsi lama.
Deadline skenario di-rescale ×1.257 ke basis-waktu jarak-jalan (jika tidak, semua stop telat →
semua CRITICAL). Headline baru: SLA-risk **−48.2%** / cost +8.6% / CO₂ +11.8% (dulu −53.2% /
+7.0% / +14.0%). Generator: `experiments/m4_nsga2_osrm.py`. Detail: [ADR-004](../architecture/adr/ADR-004-m4-precomputed.md) §Revisi.

**(b) Field baru `road_geometry`.** Polyline yang mengikuti jalan (snap OSRM `route`,
`overview=simplified`). Sebelumnya peta menarik garis lurus antar stop (`geometry`) sehingga
memotong gedung/sungai. **Additive**: `geometry` tetap ada (titik stop, untuk marker); konsumen
lama abaikan field baru → tidak breaking.

### Added
- **`candidates[].road_geometry`** — array `[lat, lng]` mengikuti jaringan jalan, di-*precompute*
  build-time ke `services/ai/data/pareto_routes_*.json`. Tidak ada OSRM saat runtime (konsisten
  [ADR-004](../architecture/adr/ADR-004-m4-precomputed.md)). Dokumentasi: `rest/v1.md` §A3 + §B-bis.
  Regenerasi: `services/ai/scripts/snap_routes_to_roads.py`.
- **`distance_source`** di root payload = `"OSRM /table driving …"` (evidence).
- FE: `M4Candidate.road_geometry` & `RouteOption.road_geometry` (opsional). `RouteMap`
  menggambar `road_geometry ?? geometry` (**fail-soft** — garis lurus kalau field absen).

### Changed
- Nilai numerik semua kandidat M4 (lihat butir (a)). Konsumen yang meng-hardcode angka lama
  (mis. dok/naskah video) harus diperbarui — sudah dilakukan di ADR-004, M4_RESULTS, model-registry, spec.

### Fixed — `/decide` `routes[].geometry` jadi per-shipment (memulihkan niat §A3)
Audit 16 Jul 2026: `/decide` me-reuse **geometri tur M4** (Hub Cibitung, 18 titik) untuk `routes[].geometry`
semua shipment → garis identik utk 12 shipment dan tidak nyambung dgn marker origin/destination
(3 hub berbeda, 12 destinasi berbeda). Padahal contoh §A3 (FROZEN) jelas per-shipment
origin→destination. Sekarang:
- `routes[].geometry` = **jalur jalan shipment itu sendiri** (OSRM `route` `alternatives=3`,
  precomputed build-time → `services/agent/data/shipment_routes.json`, dimuat saat startup —
  tanpa OSRM runtime). Kandidat ke-i memakai alternatif ke-min(i, n−1); OSRM sering hanya punya
  1–2 alternatif intra-kota → kandidat bisa berbagi jalur (jujur: pembeda kandidat adalah metrik plan).
- **Fail-soft**: entri absen → garis lurus `[origin, destination]`.
- **Metrik** `routes[]` tetap level-plan M4 (tidak berubah; semantik ganda ini didokumentasikan
  di spec m6-orchestration §5). Regenerasi: `node scripts/snap-shipment-routes.mjs` (services/agent).
- Geometri tur M4 (termasuk `road_geometry`) tetap tersedia via `GET /internal/m4/routes`
  utk halaman Route Optimization — tidak lagi bocor ke `/decide`.

### Changed — fixture `distance_km` sinkron ke jarak jalan OSRM (17 Jul 2026)
`services/agent/data/shipments.json` `distance_km` (feed fitur M1 + M3) sebelumnya nilai
karangan yang drift dari jarak jalan nyata (s.d. +4.1 km; dua shipment justru lebih pendek).
Disinkronkan ke `osrm_distance_km[0]` dari `shipment_routes.json` (sumber tunggal, konsisten
dgn M4 yang kini road-based). **Efek terverifikasi E2E 17 Jul:** confidence bergeser
(00400 0.864→0.810 · 00403 0.686→0.646), **escalation rate tetap 2/12 = 16.7%** (band 5–20% ✓),
yang tereskalasi tetap 00403 & 00408. Dokumen angka: spec m6-orchestration §6, agent/tracker,
addendum ADR-005 & PHASE3-4 report. FE mock (`apps/app/app/mocks/`) TIDAK disentuh — dunia
fiksi Surabaya dari contoh §A3 yang endpoint geometry-nya sudah konsisten dgn marker-nya sendiri.

---

## [Unreleased] — 2026-07-16 · §A3 `/decide` diperluas (additive, **bukan breaking**)

M6 diimplementasikan di `agent` (Phase 3). Response `POST /shipments/{id}/decide`
diperluas dari bentuk §A3 asli. Semua tambahan **additive** — field lama tetap ada
dengan makna sama, jadi tidak butuh ADR untuk breaking change. Bukti E2E di
`docs/specifications/agent/m6-orchestration.md`.

### Added (response `/decide`)
- **Blok `eta`** `{p50_min, p90_min, risk_tier, slack_p90_min, co2_kg, dwell_source}`
  — ETA live per-shipment (M1 + dwell M2 inject). `co2_kg` null kalau M3 gagal.
- **Blok `hub`** `{hub_id, dwell_p50_min, dwell_p90_min, queue, dwell_above_threshold}`
  — state hub M2; null kalau M2 degraded.
- **`confidence_breakdown.*.detail`** — sub-term `conf_m1` (interval × deadline) &
  `conf_m2` (model_health × situational), [ADR-005](../architecture/adr/ADR-005-conf-m1-v2.md).
- **`degraded[]`** — daftar model terdegradasi saat decision; null kalau semua sehat.
- **`latency_ms`** — latency M6 end-to-end (ukur agent).

### Changed (semantik, bukan bentuk)
- **`routes[]`** ditegaskan sebagai metrik **level-plan** (tur skenario M4), bukan
  per-shipment. Risiko live per-shipment ada di blok `eta`. Field per-route bertambah
  `late_share_p90`, `tour_sla_risk`.
- **Nullability forced-escalate:** saat M1/M4 down, `confidence_breakdown`, `eta`,
  `hub`, `selected_route_id` = null dan `primary_uncertainty_driver` =
  `critical_model_unavailable`. `primary_uncertainty_driver` juga null saat AUTO_EXECUTE.

### Notes
- §A3 di `rest/v1.md` masih FROZEN sebagai baseline; perluasan ini superset yang
  kompatibel. Request Bruno baru: `docs/api/bruno/agent/` (shipments, kpi,
  decide-00400, decide-00403, resolve).

---

## [v1] — 2026-07-15 · REST v1 · 🔒 FROZEN

Entri pertama. Kontrak REST v1 masuk repo sebagai dokumen resmi.

### Added
- `rest/v1.md` — kontrak REST v1, disalin resmi dari `apps/app/SLARA_API_CONTRACT.md`
  (dibekukan 13 Jul 2026 untuk semifinal). Isi:
  - **§A — 4 endpoint FE-facing**: `GET /kpi/summary`, `GET /shipments`,
    `POST /shipments/{id}/decide`, `POST /shipments/{id}/resolve`.
  - **§B — 5 endpoint internal M1–M5** + `GET /health` (dikonsumsi M6, bukan FE).
  - **§C — format error**: degradasi = HTTP 200 + `degraded: true`; 4xx/5xx hanya kegagalan nyata.
- `rest/v1.md` **§B-bis** — bentuk **aktual** endpoint internal yang di-serve `services/ai`
  per 15 Jul 2026, normatif untuk M6.

### Notes
- **Status freeze:** §A FROZEN dan **belum diimplementasi** — §A adalah rumah M6 di `agent`
  service (Phase 3). Dashboard masih mock by design.
- **Drift §B (bukan breaking, tidak butuh ADR):** §B ditulis sebelum `ai` service ada; implementasi
  menyimpang di 3 titik dan §B-bis mencatat bentuk aktualnya. §B ditandai "FYI tim — FE TIDAK
  memanggil ini", jadi tidak ada konsumen FE yang rusak dan freeze §A tidak tersentuh:
  1. `/internal/m4/routes` → **GET** dengan query `scenario` (bukan POST + body) — konsekuensi
     M4 precomputed, lihat [ADR-004](../architecture/adr/ADR-004-m4-precomputed.md).
  2. `/internal/m2/dwell` menerima `condition: normal|congested` + `overrides?` (bukan `arrival_ts`).
  3. M2 mengembalikan `dwell_p50_minutes` / `dwell_p90_minutes` (bukan `dwell_p50_min`).
     M6 wajib map field ini ke `hub_dwell_p50_min` saat expose §A2.
- Field tambahan yang di-serve di luar §B asli dan dipakai formula confidence M6:
  `conf_m1` (M1), `model_confidence` = `conf_m2` (M2), `cs_m4` (M4), `m2_degraded` (M2).
