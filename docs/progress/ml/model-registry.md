# ML Model Registry

Registry resmi model SLAra beserta metrik yang **benar-benar diukur**. Wajib di-update setiap kali
model berubah (AGENTS.md §Task Routing: *"Update ML model → catat di `docs/progress/ml/model-registry.md`
+ simpan metrics"*).

Aturan isi: hanya angka dari run nyata. Tidak ada target/estimasi di tabel metrik — kalau belum
diukur, tulis "belum diukur", bukan angka harapan.

**Terakhir di-update:** 2026-07-15

---

## Ringkasan

| Model | Versi | Status | Artifacts di repo | Serving |
|---|---|---|---|---|
| **M1** ETA | v2 (`2.1.0-dual-quantile-conformal`) | ✅ **7/7 PASS** | `services/ai/models/m1/`, `configs/m1/` | `POST /internal/m1/eta` |
| **M2** Hub dwell | `m2_v1.0.0-lightgbm-quantile` | ✅ **9/9 PASS** | `services/ai/models/m2/`, `configs/m2/` | `POST /internal/m2/dwell` (mode **FULL**) |
| **M3** Carbon | rule-based | ✅ | tanpa file model (EF table di kode) | `POST /internal/m3/carbon` |
| **M4** Route opt | NSGA-II (precomputed) | ✅ | `services/ai/data/pareto_routes_jabodetabek_urban.json` | `GET /internal/m4/routes` |
| **M5** SHAP | TreeExplainer @ M1 P90 | ✅ additivity PASS | diturunkan dari booster M1 P90 | `POST /internal/m5/explain` |
| **M6** Orchestration | — | 🔜 Phase 3 | — | `agent` service ([ADR-002](../../architecture/adr/ADR-002-m6-deterministic-core.md)) |

---

## M1 v2 — ETA Prediction

- **Versi:** `2.1.0-dual-quantile-conformal` · **Status:** ✅ **7/7 PASS**
- **Artifacts:** `models/m1/m1_eta_v2_p50.txt`, `models/m1/m1_eta_v2_p90.txt`,
  `configs/m1/risk_thresholds.yaml`, `configs/m1/model_config.yaml`
- **Arsitektur:** LightGBM dual-quantile (P50 & P90) + offset konformal (CQR)

### Metrik

| Metrik | Nilai |
|---|---|
| MAE | **4.44** |
| Coverage P90 | **90.1%** |
| F1 (CRITICAL) | **0.896** |
| Base rate CRITICAL | **12.7%** |
| Gap vs rule-based | **+24.1 pts** |
| Latency P95 | **2.16 ms** |
| Conformal δ (P90) | **+0.83** menit |

**Cara membaca:** coverage 90.1% terhadap target nominal 90% — interval P90 terkalibrasi, bukan
sekadar "kira-kira lebar". F1 CRITICAL 0.896 di base rate 12.7% adalah kelas minoritas, jadi angka
ini bermakna (accuracy akan menyesatkan di sini). Gap **+24.1 pts** vs rule-based adalah pembenaran
utama keberadaan model ini.

### Kalibrasi & threshold

- Kalibrasi: bounded grid cost 3:1 + CQR conformal offset (val set)
- Tier: `slack = promised_deadline − eta_p90` → SAFE `slack ≥ +15` · CRITICAL `slack < −30` ·
  sisanya WARNING. Bounds: safe `[15, 40]`, critical `[−30, −15]`
- `conf_m1 = 1 − min(1, (p90 − p50) / (2·p50))` → makin lebar interval, makin rendah confidence.
  Masuk formula M6 dengan bobot **0.40** (terbesar).

### Caveat (wajib jujur)

Fitur ke-10 `hub_dwell_time_predicted` **dilatih dari fallback generator, bukan output M2**.
Integrasi M2→M1 terjadi di **serving time** (dilakukan M6). Narasi yang benar: *"designed to consume
M2 dwell predictions at serving time"*.

### Verifikasi

Golden test (`services/ai/tests/test_golden_m1.py`): output endpoint == `m1_v2_inference.py` untuk
3 skenario. **4 passed** per 15 Jul 2026 (3 golden + 1 health/additivity).

---

## M2 — Hub Congestion / Dwell Forecast

- **Versi:** `m2_v1.0.0-lightgbm-quantile` · **Status:** ✅ **9/9 PASS** · mode serving **FULL**
- **Artifacts:** `models/m2/m2_dwell_p50.txt`, `models/m2/m2_dwell_p90.txt`,
  `configs/m2/{hub_target_encoding,hub_historical_median,coverage_confidence}.yaml`
- **Arsitektur:** LightGBM dual-quantile, 21 fitur, non-crossing enforce (`p90 = max(p50, p90)`)

> ⚠️ **Provenance: artifacts yang di-serve adalah REPRODUKSI (15 Jul 2026), bukan run asli.**
> Simulator M/M/c VERBATIM (seed 42), tapi **feature engineering direkonstruksi dari spec FASE 4
> karena cell kode asli hilang saat export .ipynb**. Validasi reproduksi vs run asli ada di
> [`M2_ARTIFACTS_REPRODUCTION.md`](../../models/evidence/M2_ARTIFACTS_REPRODUCTION.md).

### Metrik

| Metrik | Run asli | **Reproduksi (yang di-serve)** |
|---|---|---|
| Coverage P90 | 89.6% | **89.74%** (band 88–92 ✓) |
| Pinball loss P50 | 3.58 | **3.578** |
| Global `model_confidence` | 0.9979 | **0.9974** |
| MAE P50 | — | 7.156 |
| Pinball P90 | — | 2.146 |
| Latency | ~3 ms | ~3–7 ms |

Sumber angka: [`M2_results_summary.json`](../../models/evidence/M2_results_summary.json).

> 🐞 **BUG AKTIF — angka `coverage_P90` & `model_confidence` di response TIDAK diambil dari config.**
> Yang benar-benar keluar dari `/internal/m2/dwell` saat ini: `coverage_P90: 0.896` dan
> `model_confidence: 0.95` — keduanya **default hardcoded di `app/ml/m2.py`**, bukan nilai per-hub
> dari `coverage_confidence.yaml` (`HUB-CGK-02`: 0.9014 / 0.9986).
>
> Sebabnya: `_cfg_lookup()` hanya mengerti yaml berkunci `hubs`, sedangkan artifacts memakai
> `per_hub` → lookup meleset diam-diam ke fallback. Semua config M2 kena:
>
> | Config | Nilai per-hub | Yang dipakai serving |
> |---|---|---|
> | `hub_target_encoding` | 13.128 | 13.248 (`global_mean`) |
> | `hub_historical_median` | 10.796 | 10.816 (`global`) |
> | `coverage_P90` | 0.9014 | **0.896** (hardcoded) |
> | `model_confidence` | 0.9986 | **0.95** (hardcoded) |
>
> **Kenapa ini lolos review:** `0.896` kebetulan **persis sama** dengan coverage run asli (89.6%)
> yang tertulis di plan — jadi angkanya *terlihat benar*. Padahal itu default, bukan hasil ukur.
>
> **Dampak:** `conf_m2` masuk formula confidence M6 (bobot 0.15) → M6 memakai 0.95, bukan 0.9986.
> Fitur `hub_id_target_encoded` juga meleset (13.248 vs 13.128) → prediksi dwell sedikit bergeser.
> `m2_degraded` tetap `false` dan mode tetap `FULL` — **gagalnya senyap**.
>
> Belum diperbaiki: memperbaikinya mengubah angka dwell yang sudah diverifikasi, dan itu di luar
> scope tugas integrasi ini. Lihat [integration log §6](../ai/integration-log.md).

### Mode degraded (teruji)

M2 **degraded-tolerant** (M1/M4 fail-fast). Model hilang → `p50 = historical median`,
`p90 = median × 1.8`, `conf_m2 = 0.50`, `m2_degraded = true`. Sistem tetap jalan; confidence M6
turun sendiri lewat bobot **0.15**.

### Verifikasi FULL (15 Jul 2026, `HUB-CGK-02`)

| Kondisi | `dwell_p50_minutes` | `dwell_p90_minutes` | queue | dock util | `m2_degraded` |
|---|---|---|---|---|---|
| `normal` | **16.09** | 34.07 | 4 | 0.38 | `false` |
| `congested` | **29.13** | 95.21 | 19 | 0.91 | `false` |

congested > normal (**+13.04 mnt / +81%**) → bukti FULL. Di DEGRADED kedua kondisi akan **identik**.

**Catatan serving:** butuh hub telemetry 21 fitur. Untuk demo dipakai mock
`services/ai/data/hub_telemetry.json` (3 hub × 2 kondisi); fitur hilang → 0.0 (fail-soft, identik notebook).

---

## M3 — Carbon Emission

- **Status:** ✅ · rule-based, tanpa file model
- **Metodologi:** distance-based EF, load-adjusted — **GLEC / ISO 14083 aligned**
- **Latency:** ~0.024 ms

| Vehicle | EF (kg CO₂e/km) |
|---|---|
| MOTORCYCLE | 0.029 |
| VAN | 0.18 |
| TRUCK_CDE | 0.32 |
| TRUCK_CDD | 0.45 |

`co2_kg = distance_km × EF × (1 + load_kg/1000)`. EF konsisten dengan yang dipakai M4 & generator demo.

---

## M4 — Route Optimization (NSGA-II)

- **Status:** ✅ · di-serve **precomputed** ([ADR-004](../../architecture/adr/ADR-004-m4-precomputed.md))
- **Bukti:** [`docs/models/evidence/M4_RESULTS.md`](../../models/evidence/M4_RESULTS.md) ·
  engine: `services/ai/experiments/m4_nsga2.py` · spec: [`../ai/m4-route-optimization.md`](../../specifications/ai/m4-route-optimization.md)
- **Konfigurasi:** DEAP 1.4 NSGA-II · pop 120 · 150 generasi · seed 42 · **runtime 13.2 s**
- **Skenario:** `jabodetabek_urban_sameday` (Hub Cibitung, 16 stop, VAN 600 kg)

### Hasil — kandidat **Balanced (R-B)** vs baseline nearest-neighbor

| Metrik | Nilai |
|---|---|
| **SLA-risk** | **−53.2%** |
| **Cost** | **+7.0%** |
| **CO₂** | **+14.0%** |
| Tier | CRITICAL → **WARNING** |
| Late@P90 | 4/16 → **2/16** |
| **`cs_m4`** | **0.996** |
| Solusi Pareto | **17** |
| Hypervolume | **0.664** |

**Acceptance ✅** — ≥15% reduction di ≥1 objective (SLA-risk −53.2%) tanpa memburuk >15% di lainnya
(cost +7.0%, CO₂ +14.0%).

**Batas:** angka dari **satu skenario**; desain M4 §7.3 mensyaratkan 3 skenario supaya klaim tidak
cherry-picked → belum boleh digeneralisasi. `cs_m4` masuk confidence M6 dengan bobot **0.25**.

---

## M5 — Explainability (SHAP)

- **Status:** ✅ · **additivity PASS** (dicek saat startup, fail-fast kalau gagal)
- **Explainer:** `shap.TreeExplainer` di booster **M1 P90** (`m1_eta_v2_p90`)
- **Output:** `base_value_min`, `prediction_min`, `shap_top5[]`, `additivity_ok`
- **Latency:** first call ~230 ms · init startup ~25–37 s (TreeExplainer di model 2000-tree)

**Keputusan:** yang di-explain adalah **P90**, bukan P50 — tier & slack ditentukan P90, jadi "kenapa
berisiko" == "kenapa P90 besar". Yang dijelaskan adalah prediksi **mentah** (tanpa δ konformal):
δ = offset konstan, tidak mengubah atribusi.

`hour_sin`/`hour_cos` digabung jadi satu label tampilan `hour_of_day`. Kebijakan **lazy** (hanya
WARNING/CRITICAL) ada di M6, bukan di endpoint ini.

---

## Riwayat

| Tanggal | Perubahan |
|---|---|
| 2026-07-15 | Registry dibuat. M1 v2 (7/7), M2 (9/9, FULL terverifikasi), M3, M4 (precomputed), M5 (additivity PASS) tercatat & ter-serve di `services/ai`. |
