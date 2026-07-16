# Contracts — CHANGELOG

Riwayat perubahan kontrak di `docs/contracts/`. Format: [Keep a Changelog](https://keepachangelog.com/)
disederhanakan. Kewajiban: setiap perubahan `contracts/rest/` **wajib** punya entri di sini + request
Bruno yang sesuai di `docs/api/bruno/<service>/` pada PR yang sama (AGENTS.md §Task Routing).
Breaking change **wajib** disertai ADR di `docs/architecture/adr/`.

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
