# Progress Tracker — `agent` service (M6)

Status M6 orchestration di `services/agent`. Wajib di-update setiap status berubah
(AGENTS.md §Konvensi Umum).

**Terakhir di-update:** 2026-07-16 · **Branch:** `dev`

---

## Status endpoint (kontrak §A)

| Endpoint | Status | Tanggal | Bukti |
|---|---|---|---|
| `GET /health` | ✅ **DONE** | 2026-07-16 | `{status: ok, service: slara-agent, threshold: 0.70}` |
| `GET /api/v1/shipments` | ✅ **DONE** | 2026-07-16 | 12 shipment, eta/tier enriched live (M2→M1→M3) |
| `GET /api/v1/kpi/summary` | ✅ **DONE** | 2026-07-16 | agregat tier + auto-execute; unmeasured → null |
| `POST /api/v1/shipments/:id/decide` | ✅ **DONE** | 2026-07-16 | pipeline penuh; 2 jalur kanonik terverifikasi |
| `POST /api/v1/shipments/:id/resolve` | ✅ **DONE** | 2026-07-16 | APPROVE/REJECT ubah decision_status |

**Semua endpoint kontrak §A: DONE.** M6 selesai untuk demo path.

## Komponen internal

| Item | Status | Tanggal | Catatan |
|---|---|---|---|
| Orchestration core `decide.ts` | ✅ DONE | 2026-07-16 | 6 node deterministik, [ADR-002](../../architecture/adr/ADR-002-m6-deterministic-core.md) |
| Formula confidence `confidence.ts` | ✅ DONE | 2026-07-16 | conf_m1 v2, [ADR-005](../../architecture/adr/ADR-005-conf-m1-v2.md) |
| Failure cascade | ✅ DONE | 2026-07-16 | M1/M4→forced escalate; M2→degradasi; M3→co2 null; M5→shap null |
| Unit test `confidence.test.ts` | ✅ DONE | 2026-07-16 | **6 pass, 0 fail** |
| Bruno collection | ✅ DONE | 2026-07-16 | `docs/api/bruno/agent/` (5 request) |

## Verifikasi E2E (2026-07-17, host — agent :3000 + ai :8000)

> Re-verifikasi setelah **sinkron `distance_km` → jarak jalan OSRM** (17 Jul) dan
> **`routes[].geometry` per-shipment** (fix §A3, `data/shipment_routes.json`).
> Angka 16 Jul (0.864/0.686) diarsipkan di git + PHASE3-4 report.

| Gate | Hasil |
|---|---|
| `/health` ai | m1 ✅ · m2 FULL ✅ · m4 ✅ · m5 additivity ✅ |
| `GET /shipments` enrichment | 12/12 eta+tier terisi |
| decide SHP-00400 | AUTO_EXECUTE · **0.810** · shap null |
| decide SHP-00403 | ESCALATE · **0.646** · `deadline_pressure` · 5 SHAP |
| decide SHP-00408 | ESCALATE · **0.638** · `deadline_pressure` · 5 SHAP |
| geometry endpoints == hub/destination shipment | ✅ 3 sampel (00400/00406/00411), unik per shipment |
| Escalation rate 12 shipment | **2/12 = 16.7%** (band 5–20% ✓, tak berubah oleh koreksi jarak) |
| `npm test` | 6 pass, 0 fail |

## Catatan integrasi

- **Bug M2 ditemukan & diperbaiki** saat verifikasi (di `services/ai`, bukan agent):
  `_cfg_lookup` tidak mengenal bentuk yaml `per_hub` → confidence/coverage M2 selalu
  default hardcoded 0.95/0.896. Fix membuat angka cocok dengan rekaman sandbox
  (dwell P90 95.68 vs README 95.7; confidence 0.864/0.686). Commit `fix(ai): M2 baca
  artifact per_hub/global`.
- Dockerfile/Dockerfile.dev lama (pnpm-based) dipertahankan; payload ship
  `package-lock.json` + tanpa script `build`. Drift ini tidak di jalur gate (gate
  jalan di host via `npm`).
