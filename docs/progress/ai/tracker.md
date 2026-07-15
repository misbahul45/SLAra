# Progress Tracker — `ai` service

Status per endpoint `services/ai`. Wajib di-update setiap status berubah
(AGENTS.md §Konvensi Umum: *"Tracking: update progress di `docs/progress/<service>/tracker.md`"*).

**Terakhir di-update:** 2026-07-15 · **Branch:** `dev`

---

## Status endpoint

| Endpoint | Model | Status | Tanggal | Bukti |
|---|---|---|---|---|
| `GET /health` | — | ✅ **DONE** | 2026-07-15 | m1/m2/m3/m4/m5 hijau; `m2.mode: FULL`, `m5.additivity_ok: true` |
| `POST /internal/m1/eta` | M1 v2 | ✅ **DONE** | 2026-07-15 | golden test **4 passed** vs `m1_v2_inference.py` |
| `POST /internal/m2/dwell` | M2 | ✅ **DONE** | 2026-07-15 | `HUB-CGK-02` normal **16.09** vs congested **29.13** (+81%), `m2_degraded: false` |
| `POST /internal/m3/carbon` | M3 | ✅ **DONE** | 2026-07-15 | rule EF GLEC/ISO-14083; ~0.024 ms |
| `GET /internal/m4/routes` | M4 | ✅ **DONE** | 2026-07-15 | precomputed Pareto ter-load saat startup: 3 kandidat, `cs_m4=0.996` ([ADR-004](../../architecture/adr/ADR-004-m4-precomputed.md)) |
| `POST /internal/m5/explain` | M5 | ✅ **DONE** | 2026-07-15 | additivity PASS saat startup; explain `m1_eta_v2_p90` |

**Semua endpoint kontrak §B: DONE.** Serving layer `ai` selesai untuk demo path.

## Verifikasi terakhir (2026-07-15, host)

| Gate | Perintah | Hasil |
|---|---|---|
| Dependency | `uv sync` | ✅ 44 paket |
| Test | `uv run pytest tests/ -q` | ✅ **4 passed** (~49 s) |
| Startup | `uv run uvicorn app.main:app --port 8000` | ✅ `Startup selesai. M5 additivity: PASS \| M2 mode: FULL` (~37 s) |
| Health | `curl localhost:8000/health` | ✅ semua model hijau |
| Link M2 | `POST /internal/m2/dwell` × 2 kondisi | ✅ congested > normal, `m2_degraded: false` |

Bruno collection: [`docs/api/bruno/ai/`](../../api/bruno/ai/) — 6 request menutup semua endpoint di atas.

## Definition of Done (dipakai untuk tabel di atas)

Sebuah endpoint DONE kalau: (1) diimplementasi sesuai kontrak §B-bis, (2) punya bukti observasi nyata
(test/curl), (3) punya request Bruno, (4) tercatat di sini + registry.

## Yang BELUM (sadar, tercatat)

| Item | Status | Catatan |
|---|---|---|
| Verifikasi di dalam container | 🔜 | semua verifikasi di atas dijalankan **di host**. `.dockerignore` mengecualikan `models/` → compose **wajib** mount `./models`, kalau tidak M1 fail-fast membunuh container saat startup |
| Endpoint FE-facing §A | 🔜 Phase 3 | rumah M6 di `agent`, bukan `ai` ([ADR-002](../../architecture/adr/ADR-002-m6-deterministic-core.md)) |
| M4 skenario ke-2 & ke-3 | 🔜 backlog final | desain M4 §7.3 minta 3 skenario supaya klaim reduction tidak cherry-picked |
| `ruff` / `mypy strict` | ❌ belum | AGENTS.md mensyaratkan type hints + mypy strict; belum ada di pyproject/CI |
| Error format §C amplop `error` | ⚠️ parsial | degradasi M2 pakai HTTP 200 + `m2_degraded: true` (bukan amplop `error{}`). Semangat sama, bentuk beda — lihat kontrak §C |
| Kontributor macOS Intel | ⚠️ | lock memilih `numba 0.53.1` di platform itu → `uv sync` kemungkinan gagal (lihat [integration log](integration-log.md) §D3) |

## Riwayat

| Tanggal | Perubahan |
|---|---|
| 2026-07-15 | Scaffold "Hello from ml!" diganti serving M1–M5. Semua endpoint §B DONE & terverifikasi. Artifacts M2 ditempatkan → mode **FULL**. Detail deviasi teknis: [integration log](integration-log.md). |
