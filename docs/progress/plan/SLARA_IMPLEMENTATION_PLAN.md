# SLAra — Implementation Master Plan: FE → Gateway → Agent → AI
> **Versi:** 1.0 · 14 Jul 2026 · Owner: Faisal (solo execution + Claude Code)
> **Deadline keras:** 17 Jul 2026 (video submit) — sisa efektif **2.5 hari kerja + buffer**
> **Prinsip:** setiap phase menghasilkan (a) sesuatu yang bisa didemokan, (b) dokumentasi resmi di `docs/`, (c) acceptance criteria yang terukur. Tidak ada phase "setengah jadi" — kalau waktu habis, phase dipotong utuh, bukan dikerjakan setengah.

---

# BAGIAN 1 — ANALYZE (kondisi nyata per 14 Jul)

## 1.1 Inventori aset ML (source of truth)

| Model | Status | Artifacts | Interface serving | Catatan |
|---|---|---|---|---|
| **M1 v2** | ✅ 7/7 PASS | `m1_eta_v2_p50.txt`, `m1_eta_v2_p90.txt`, `risk_thresholds.yaml` (SAFE≥+15, CRIT<−30), `model_config.yaml`, conformal δ=+0.83 | `m1_v2_inference.py` → `M1Predictor.predict()` → `{eta_p50, eta_p90, risk_tier, conf_m1}` | MAE 4.44 · Cov 90.1% · F1C 0.896 · gap vs rule +24.1 · P95 2.16ms |
| **M2** | ✅ 9/9 PASS | `m2_dwell_p50.txt`, `m2_dwell_p90.txt`, `hub_target_encoding.yaml`, `hub_historical_median.yaml`, `coverage_confidence.yaml`, `feature_importance.json` | `m2_predict(hub_status)` → `{dwell_p50, dwell_p90, model_confidence, queue_state, m2_degraded}` | Cov 89.6% · pinball P50 3.58 · 3ms · fallback degraded teruji · **butuh hub telemetry 21 fitur saat serving** |
| **M3** | ✅ | Rule-based (EF IPCC/GLEC), tanpa file model | `(distance, vehicle, load) → co2_kg` | 0.024ms — port fungsi langsung ke ai service |
| **M4** | 🔜 **BELUM ADA** | Target: `pareto_routes_<scenario>.json` precomputed | serve statis via ai | **Satu-satunya kerja model tersisa — Phase 3 malam ini** |
| **M5** | ✅ wrapper | TreeExplainer generik (planning doc lengkap §1–17) | `explain(features)` → top-5 + base_value | Re-point ke M1 v2 (~30 mnt); keputusan: **explain model P90** (yang menentukan tier) |
| **M6** | 🔜 desain final | Formula confidence + threshold 0.70 + failure cascade | — | Rumah: `agent` service — Phase 4 |

**Fakta penting lintas-model:** `conf_m1` (dari M1 v2) dan `conf_m2` (= `model_confidence` M2) **dua-duanya sudah computable** → formula M6 tinggal dirakit. Caveat yang tersisa: fitur `hub_dwell_time_predicted` di M1 dilatih dari fallback, bukan output M2 — integrasi M2→M1 terjadi **di serving time** (kontrak FASE 17 notebook M2), dan narasi video harus bilang persis itu.

## 1.2 Kondisi infra (dari audit Docker 14 Jul)

Runtime: redis/mongo/kafka healthy · **qdrant unhealthy** (B1: `wget` tak ada di image) → cascade: agent tak start → gateway tak start. Dev app healthcheck salah port (B2: cek 3000, Vite di 5173) → gateway tak pernah healthy di dev (B3). `data`/`ai` Dockerfile.dev manifest-only (S1/S2, mitigasi `initial_sync`). Semua fixable <2 jam — resep sudah ada di report.md §5.

## 1.3 Peta interaksi target (demo path)

```
Browser (React :5173)
   │  fetch /api/agent/v1/shipments/:id/decide      ← SATU flow live untuk demo
   ▼
Gateway nginx :80  ──/api/agent/*──▶  agent :3000 (Hono)
                                        │  M6: deterministic orchestration core
                                        │  1. GET  ai/internal/m2/dwell     (dwell + conf_m2)
                                        │  2. POST ai/internal/m1/eta       (inject dwell_p50 → fitur ke-10)
                                        │  3. POST ai/internal/m3/carbon
                                        │  4. GET  ai/internal/m4/routes    (precomputed Pareto + cs_m4)
                                        │  5. POST ai/internal/m5/explain   (hanya jika WARNING/CRITICAL)
                                        │  6. confidence = .40·m1 + .15·m2 + .25·m4 + .10·fresh + .10·audit
                                        │  7. ≥0.70 auto-execute | <0.70 escalate
                                        ▼
                                      ai :8000 (FastAPI) — load semua artifacts saat startup
```
**Di luar demo path (eksplisit):** Kafka, Neo4j, Qdrant, Mongo penuh, `data` service (Go) — shipments di-serve dari JSON oleh agent. Ini keputusan, bukan kelalaian → ADR-003.

## 1.4 Gap analysis (yang berdiri di antara sekarang dan video)

1. Artifacts M1/M2 belum ditempatkan di `services/ai/models/` dengan struktur final
2. `ai` service masih "Hello from ml!" — belum ada serving layer
3. `agent` masih "Hello Hono!" — belum ada M6
4. M4 belum ada sama sekali
5. FE masih 100% mock (by design — tinggal swap)
6. 4 blocker/silent infra dari audit
7. `docs/` resmi (`architecture/adr`, `specifications`, `contracts`, `progress`) sebagian besar belum ada — plan ini yang mengisinya

---

# BAGIAN 2 — REFACTORING (scoped, time-boxed 2 jam total)

Refactor HANYA yang membuka jalan demo. Semua di luar daftar ini = backlog final.

| # | Refactor | File | Sumber | Time-box |
|---|---|---|---|---|
| R1 | Qdrant healthcheck → bash `/dev/tcp` | `infra/docker-compose.yml:174` | Audit B1 | 5 mnt |
| R2 | Override healthcheck `app` port 5173 di dev overlay | `infra/docker-compose.override.yml` | Audit B2 | 10 mnt |
| R3 | Gateway dev: **Opsi A** (diputus di ADR-0003) — `nginx.dev.conf` upstream `app:5173` + volume override di `docker-compose.override.yml` | `infra/docker-compose.override.yml`, `nginx.dev.conf` | Audit B3/U5 | 15 mnt |
| R4 | `server.host: "0.0.0.0"` di `vite.config.ts`, hapus flag CLI | `apps/app/vite.config.ts`, `Dockerfile.dev` | Audit S3 | 5 mnt |
| R5 | Commit `infra/check-health.sh` + dokumentasikan di `infra/README.md` | — | Audit D2/H1 | 10 mnt |
| R6 | Struktur `services/ai`: `app/main.py`, `app/api/internal.py`, `app/ml/{m1,m2,m3,m5}.py`, `app/core/artifacts.py`, `models/{m1,m2}/`, `configs/` — sesuai konvensi AGENTS.md | `services/ai/*` | AGENTS.md §Per Service | 30 mnt (bersama Phase 2) |
| R7 | FE: pastikan SEMUA angka via `lib/data.ts` (bukan hardcode JSX) — kalau pass UI-fix kemarin belum mencakup ini, selesaikan sekarang | `apps/app/app/lib/*` | Keputusan number-sync | 30 mnt |
| ❌ | ~~Pin image tags (H2), prod Dockerfile agent (H3), Python 3.14/Go 1.25 verify (H4), Kafka schema, runbook sync (D1)~~ | — | **Backlog final — jangan sentuh** | — |

**Escape hatch (tulis di ADR-001):** jika setelah R1–R4 stack compose masih rewel >30 menit, tinggalkan compose — jalankan `uvicorn` + `pnpm dev` (agent & app) + ai langsung di host, FE pakai `VITE_API_BASE` direct-port. Gateway itu demo enhancement, bukan demo requirement.

---

# BAGIAN 3 — IMPLEMENTATION PHASES

> Format tiap phase: **Objective → Tasks → Acceptance → 📚 Dokumentasi wajib → Claude Code prompt**.
> Dokumentasi ditulis DI DALAM phase yang sama, bukan ditunda — dokumentasi adalah bagian dari Definition of Done.

---

## PHASE 0 — Konsolidasi & Keputusan Arsitektur (14 Jul sore, 1–1.5 jam)

**Objective:** semua artifacts di tempat final, semua keputusan arsitektur tertulis, kontrak resmi masuk repo.

**Tasks:**
1. Tempatkan artifacts:
   ```
   services/ai/models/m1/  ← m1_eta_v2_p50.txt, m1_eta_v2_p90.txt
   services/ai/models/m2/  ← m2_dwell_p50.txt, m2_dwell_p90.txt
   services/ai/configs/m1/ ← risk_thresholds.yaml, model_config.yaml
   services/ai/configs/m2/ ← hub_target_encoding.yaml, hub_historical_median.yaml,
                             coverage_confidence.yaml, feature_importance.json
   ```
2. Smoke test load: python REPL load 4 booster + parse semua yaml → tidak ada error
3. Salin `SLARA_API_CONTRACT.md` → `docs/contracts/rest/v1.md` (resmi), buat `docs/contracts/CHANGELOG.md` entry pertama
4. Eksekusi R1–R5 (refactor infra kecil)

**Acceptance:** ✅ 4 model ter-load dari path repo · ✅ `docker compose up` infra + tiga service naik ATAU keputusan direct-port tercatat · ✅ kontrak resmi di `docs/contracts/`

**📚 Dokumentasi wajib:**
- `docs/architecture/adr/ADR-001-demo-transport.md` — gateway-first dengan direct-port fallback; kondisi trigger fallback; konsekuensi
- `docs/architecture/adr/ADR-002-m6-deterministic-core.md` — M6 diimplementasi sebagai deterministic orchestration core di agent (TS), struktur node mengikuti desain LangGraph, LangGraph ceremony ditunda ke final; alasan: 3 hari, solo, LLM tidak pernah memutuskan rute (sesuai desain — jadi graph engine bukan requirement fungsional demo)
- `docs/architecture/adr/ADR-003-demo-scope-exclusions.md` — Kafka/Neo4j/Qdrant/Mongo-penuh/data-service di luar demo path; alasan + jalur production
- `docs/architecture/adr/ADR-004-m4-precomputed.md` — M4 di-serve precomputed untuk demo; NSGA-II tetap engine aslinya (bukti: run log + convergence); jalur ke real-time di final
- Update `claude.md` tabel reality-vs-target (M1 ✅, M2 ✅, path artifacts)
- `docs/progress/ml/model-registry.md` — entri M1 v2 (7/7, metrik, δ conformal) + M2 (9/9, metrik) sesuai kewajiban AGENTS.md "Update ML model"

**Claude Code prompt:**
> "Baca report.md (audit Docker) §5 dan AGENTS.md. Kerjakan: (1) fix B1 qdrant healthcheck pakai bash /dev/tcp persis resep audit; (2) tambah healthcheck override app port 5173 di docker-compose.override.yml; (3) Opsi A gateway dev (ADR-0003): nginx.dev.conf upstream app:5173 + volume override di docker-compose.override.yml; (4) tambah server.host 0.0.0.0 di vite.config.ts dan hapus flag --host dari Dockerfile.dev; (5) git add infra/check-health.sh + section pemakaian di infra/README.md. Jangan ubah hal lain. Setelah itu jalankan docker compose config untuk validasi schema, lalu buat 4 file ADR di docs/architecture/adr/ dengan isi berikut: [tempel ringkasan ADR di atas]."

> **Catatan implementasi aktual (pasca-plan):** R1 (qdrant healthcheck) **tidak** diterapkan sebagai fix
> probe — sebagai gantinya `qdrant` **di-disable** bersama `mongodb`/`neo4j`/`redis` di `docker-compose.yml`
> + `docker-compose.prod.yml` (ADR-003). File `docker-compose.dev.yml` di-rename jadi
> `docker-compose.override.yml`. R2/R3/R4/R5 diterapkan sesuai.

---

## PHASE 1 — AI Service: Serving M1 + M2 + M3 + M5 (14 Jul malam, 3–4 jam)

**Objective:** FastAPI `ai` melayani 4 model nyata dengan latency <50ms per endpoint.

**Tasks:**
1. `app/core/artifacts.py` — loader singleton: 4 booster + yaml configs saat startup (fail-fast kalau file hilang)
2. `app/ml/m1.py` — port `M1Predictor` (dual quantile + conformal δ + tier + conf_m1)
3. `app/ml/m2.py` — port `m2_predict()` dari notebook: build 21-feature vector (fail-soft default 0.0), target encoding dari yaml, non-crossing enforce, `model_confidence`, `queue_state`, flag degraded. **Hub telemetry untuk demo:** `services/ai/data/hub_telemetry.json` — snapshot mock 3 hub Jabodetabek (queue_length, dock_utilization, lag features) dengan 2 kondisi: normal & congested
4. `app/ml/m3.py` — port rule carbon (EF table IPCC/GLEC dari dokumen M3)
5. `app/ml/m5.py` — TreeExplainer di **model P90** M1 v2 (keputusan: yang di-explain adalah prediksi yang menentukan tier), top-5 + base_value, additivity check saat startup (dari planning M5 §8), format sesuai kontrak `shap_top5`
6. `app/api/internal.py` — endpoint sesuai `docs/contracts/rest/v1.md` §B: `POST /internal/m1/eta`, `POST /internal/m2/dwell`, `POST /internal/m3/carbon`, `POST /internal/m5/explain` + `GET /health` (status per-model)
7. Error format §C kontrak (degraded 200, bukan 5xx)

**Acceptance:** ✅ `curl` tiap endpoint → response sesuai kontrak · ✅ golden test: output M1 endpoint == output `m1_v2_inference.py` untuk 3 skenario smoke kemarin (toleransi 1e-6) · ✅ M2 endpoint hub congested → dwell lebih tinggi dari normal · ✅ M5 additivity PASS di startup log · ✅ latency log per request

**📚 Dokumentasi wajib:**
- `docs/specifications/ai/serving.md` — arsitektur loader, lifecycle startup, tabel endpoint↔model↔artifacts, keputusan "M5 explains P90", format degraded, cara menambah model baru
- `docs/api/bruno/ai/` — 5 request Bruno (m1/m2/m3/m5/health) sesuai kewajiban AGENTS.md "endpoint baru wajib disertai Bruno"
- `docs/progress/ai/tracker.md` — status per endpoint

**Claude Code prompt:**
> "Baca docs/contracts/rest/v1.md §B, services/ai/models/, m1_v2_inference.py, dan dump fungsi m2_predict [tempel dari notebook]. Bangun FastAPI service sesuai struktur AGENTS.md (uv, pydantic v2, type hints wajib): [tempel tasks 1–7]. Buat golden test test_golden_m1.py yang membandingkan endpoint vs inference helper untuk 3 skenario ini: [tempel]. Tulis docs/specifications/ai/serving.md dan 5 file Bruno."

---

## PHASE 2 — M4 NSGA-II: Build + Precompute (14 Jul malam → 15 pagi, paralel Phase 1; 3–4 jam compute)

**Objective:** Pareto set nyata untuk 1 skenario Jabodetabek + bukti validasi, di-serve statis.

**Tasks:**
1. Script NSGA-II (DEAP): 3 objectives (cost · SLA-risk via M1 v2 · CO₂ via M3), constraints (kapasitas, time window, driver hours)
2. Skenario: **urban same-day Jabodetabek**, 15–25 titik, distance matrix konsisten generator M1 (atau OSRM kalau sempat — jangan paksa)
3. Baseline: distance-only nearest-neighbor → hitung reduction %
4. Sanity 2–3 instance Solomon (kalau muat waktu; kalau tidak → jangan klaim Solomon)
5. Output: `services/ai/data/pareto_routes_jabodetabek_urban.json` — 3 kandidat (Fastest/Balanced/Greenest) sesuai schema `routes[]` kontrak + `cs_m4` + convergence stats (generations, hypervolume, runtime)
6. Endpoint `GET /internal/m4/routes?scenario=...` di ai (serve file + stats)

**Acceptance:** ✅ reduction ≥15% vs baseline pada minimal 1 objective tanpa memburuk >15% di objective lain · ✅ runtime tercatat · ✅ 3 kandidat punya geometry utk peta · ✅ screenshot/log convergence tersimpan (bukti untuk video & juri)

**📚 Dokumentasi wajib:**
- `docs/specifications/ai/m4-route-optimization.md` — formulasi 3 objective + constraints, kenapa 3 bukan 6 (jawaban juri!), hasil vs baseline, batas precomputed & jalur real-time
- Update `docs/progress/ml/model-registry.md` — entri M4
- Update ADR-004 dengan angka hasil aktual

---

## PHASE 3 — Agent Service: M6 Orchestration Core (15 Jul siang, 3–4 jam)

**Objective:** `/api/v1/shipments/:id/decide` hidup end-to-end dengan 5 model nyata.

**Tasks:**
1. `src/domain/confidence.ts` — formula murni + unit test: `0.40·conf_m1 + 0.15·conf_m2 + 0.25·cs_m4 + 0.10·freshness + 0.10·audit`, threshold 0.70 dari config (BUKAN hardcode)
2. `src/domain/cascade.ts` — failure cascade sesuai desain: M2/M3 down → degradasi (confidence −10~15%, flag `degraded`); M1/M4 unreachable → paksa ESCALATE; M5 down → confidence tak berubah
3. `src/orchestration/decide.ts` — node berurutan (struktur graph, plain TS per ADR-002): fetch dwell → eta (inject `dwell_p50` ke fitur M1) → carbon → routes → (conditional) explain → confidence → branch
4. `src/routes/shipments.ts` — `GET /shipments` (dari `data/shipments.json` — 12 shipment Jabodetabek dgn koordinat), `POST /:id/decide` (kontrak §A3 persis), `POST /:id/resolve` (§A4), `GET /kpi/summary` (§A1, agregat dari state in-memory)
5. Latency budget: ukur per node, total masuk `latency_ms` response

**Acceptance:** ✅ dua skenario kanonik jalan: hub normal → confidence ≥0.70 → AUTO_EXECUTE; hub congested → conf_m1/m2 turun → <0.70 → ESCALATE + shap_top5 terisi · ✅ Σ(value×weight) == confidence di response (juri bisa verifikasi) · ✅ P95 <3s (target <2.5s karena M4 precomputed) · ✅ unit test confidence & cascade hijau

**📚 Dokumentasi wajib:**
- `docs/specifications/agent/m6-orchestration.md` — diagram node, formula + bobot + threshold, tabel cascade, mapping response→kontrak, jalur upgrade ke LangGraph penuh
- `docs/api/bruno/agent/` — decide (2 skenario) + resolve + shipments + kpi
- `docs/progress/agent/tracker.md`

---

## PHASE 4 — FE Live Wiring + Number Sync (15 Jul sore, 2–3 jam)

**Objective:** view **AI Recommendation** live end-to-end; semua view lain berisi angka NYATA dari model.

**Tasks:**
1. `VITE_API_BASE` → gateway `/api/agent/v1` (fallback `:3000` per ADR-001); `VITE_USE_MOCK=false` untuk flow decide
2. Wire tombol Decide → `POST /decide` nyata → render confidence breakdown, routes, SHAP, latency badge
3. **Number-sync pass (sekali, final):** ganti angka statis semua view dari `results_summary.json` M1 + config M2 + stats M4: MAE 4.44 · Coverage 90.1%/89.6% · F1C 0.896 · gap +24.1 · reduction M4 · runtime · hypervolume. Sumber tunggal: `apps/app/app/data/model_stats.json`
4. Smoke dua skenario di browser + rekam percobaan pertama (cadangan footage)

**Acceptance:** ✅ DoD frontend plan lama terpenuhi utk flow live · ✅ `grep` tidak menemukan angka metrik hardcode di JSX · ✅ konsistensi angka FE == `results_summary.json` == yang akan disebut di narasi video

**📚 Dokumentasi wajib:**
- `docs/specifications/app/dashboard.md` — data layer (mock↔live switch), view map, sumber `model_stats.json`
- Update `docs/contracts/CHANGELOG.md` kalau ada penyesuaian field selama wiring (satu-satunya jalan legal mengubah kontrak)

---

## PHASE 5 — E2E Validation + Video Production (16 Jul full day → 17 submit)

**Objective:** bukti sistem + video final ter-submit.

**Tasks:**
1. `bash infra/check-health.sh` semua hijau (atau versi direct-port) — screenshot untuk video
2. Latency run: 20× decide → laporkan P95 (target <2.5s)
3. Rekam: (a) cuplikan Colab/terminal training M1+M2 & convergence M4 (10–15 dtk), (b) demo dua skenario, (c) view lain sebagai walkthrough
4. Script English final → **rekam suara sendiri** (per paragraf) → edit → logo Blibli + FabLab Jababeka + Kemenko + nama tim & anggota → render 1080p MP4
5. 17 Jul: upload (YouTube unlisted/Drive anyone-with-link) → **test incognito** → submit ≤15:00

**📚 Dokumentasi wajib:**
- `docs/progress/demo-evidence.md` — hasil E2E (latency P95, screenshot health, dua skenario), link video, tanggal submit
- `docs/runbooks/demo-runbook.md` — cara menjalankan demo dari nol (untuk QnA final: juri kadang minta live)

---

# BAGIAN 4 — Timeline vs Realita

| Waktu | Phase | Catatan |
|---|---|---|
| 14 sore | Phase 0 | 1–1.5 jam, banyak copy-paste |
| 14 malam | Phase 1 + Phase 2 start | Phase 1 = Claude Code; Phase 2 compute jalan paralel |
| 15 pagi | Phase 2 selesai | Kalau NSGA-II rewel → fallback: kurangi titik ke 12–15 |
| 15 siang | Phase 3 | Blok kerja paling butuh fokus |
| 15 sore | Phase 4 | Number-sync = penutup hari |
| 16 | Phase 5 produksi | JANGAN coding fitur baru apapun hari ini |
| 17 | Submit | Buffer + upload + test link |

**Aturan pemotongan kalau meleset:** yang dipotong duluan = Solomon sanity (P2.4) → gateway (pakai direct-port) → view walkthrough non-live di video jadi screenshot saja. Yang TIDAK PERNAH dipotong: M6 decide live, dua skenario, number-sync, suara sendiri di video.
