# SLAra AI — Training Pipeline Optimization & Agentic System Plan

> **Sifat dokumen:** perencanaan & optimasi alur — TIDAK ada training di sesi ini.
> **Metode:** semua klaim di dokumen ini di-derive dari artefak nyata: notebook `M1_ETA_Prediction_Colab_4` (39 cell, hasil eksekusi aktual), artefak M2/M3/M5 yang dibangun & dieksekusi di sesi ini, 56 instance Solomon VRPTW yang sudah ter-download lokal, dan dua eksperimen verifikasi kuantitatif (200K baris, reproduksi exact formula generator FASE 9).
> **Tanggal:** 11 Juli 2026 — 1 hari setelah `Next.md` (planning-mu tanggal 11 Juli).

---

## 0. Ringkasan Eksekutif (baca ini kalau cuma punya 2 menit)

1. **M1 punya cacat fundamental di data generator, bukan di model.** Deadline sintetis memakai `typical_eta` **konstan 25 menit** untuk semua shipment, tidak peduli jaraknya. Akibat terverifikasi: 74.1% shipment CRITICAL, risk tier bisa ditebak **91.5% akurat oleh rule 2-variabel tanpa ML**, dan setiap shipment same-day >14 km **pasti CRITICAL bahkan dalam kondisi terbaik**. Angka kebanggaan M1 (F1 CRITICAL 0.923, Recall 0.987) sebagian besar adalah artefak generator — juri teknis yang jeli bisa membongkarnya dengan satu pertanyaan.
2. **Fix-nya sudah diverifikasi kuantitatif:** deadline distance-aware (`typical_eta = f(distance)` + buffer SLA). Hasil verifikasi 200K baris: CRITICAL turun 74.1% → 30.8%, akurasi rule tanpa-ML turun 91.5% → 74.3% (artinya ML sekarang punya sinyal nyata untuk ditambahkan), determinisme jarak hilang.
3. **M6 (agentic) saat ini TIDAK bisa dibangun penuh** karena formula confidence butuh `interval P50−P90` dari M1, sedangkan M1 hanya punya satu model P90 (α=0.90). Komponen M2 dan M3 untuk formula itu **sudah computable hari ini dengan angka nyata** (conf_m2 = 0.998, audit_validity = 0.903).
4. **Urutan eksekusi optimal berubah dari `Next.md`-mu:** M1 v2 (regenerate + retrain P50/P90 pair) naik jadi prioritas #1 — karena M4, M5, dan M6 semuanya downstream dari M1, dan membangun mereka di atas M1 yang cacat berarti kerja dua kali.

---

## 1. Baseline Fakta — Apa yang Benar-Benar Ada Sekarang

| Model | Status | Bukti / Angka aktual | Lokasi artefak |
|---|---|---|---|
| **M1** ETA | ⚠️ SELESAI TAPI CACAT DATA | LightGBM Quantile α=0.90, 1M rows, MAE 8.00, F1C 0.923, RecC 0.987. Model 92.8 MB (num_leaves=512). Threshold final SAFE≥+30/CRIT<0. **9 fitur — tanpa hub_dwell dari M2, tanpa P50.** | Google Drive Colab-mu (`m1_eta_lightgbm_1M_indonesia.txt`) — belum di sandbox ini |
| **M2** Hub Dwell | ✅ SELESAI (prototype scale) | 2 model LightGBM Quantile P50+P90. Pinball P50 1.92 / P90 1.06, MAE P50 3.84, **Coverage P90 89.8%** (band target 88–92%). 8/8 acceptance criteria PASS. Simulator M/M/c simpy, 169K shipment, 6 minggu × 8 hub, skewness 1.999 (right-skewed ✓). | `slara/m2/` (model .txt ×2, config, report) |
| **M3** Carbon | ✅ SELESAI | Rule-based, 10 skenario audit, deviasi rata-rata 9.7% (<10% target), **0.024 ms/call** (target <5ms). EF bersumber IPCC/GLEC, dipisah ke YAML. | `slara/m3/` (estimator, validation report, audit JSON, YAML) |
| **M4** Route Opt | 🔜 BELUM — data siap | 56 instance Solomon VRPTW (R101 dst.) sudah ter-download & format terverifikasi. DEAP terinstall. Belum ada kode NSGA-II. | `py-ga-VRPTW/data/text/` (56 file) |
| **M5** SHAP | ✅ WRAPPER SELESAI | TreeExplainer generik, **additivity check PASS** (didemokan di model M2 P90 nyata). Tinggal re-point ke M1 v2. | `slara/m5/m5_shap_explainer.py` |
| **M6** Orchestration | 🔜 BELUM — sebagian input blocked | LangGraph terinstall. Kontrak I/O bisa dikunci SEKARANG (field names artefak sudah nyata, lihat §5). conf_m1 **not computable** sampai M1 v2. | — |

**Catatan scope M2:** dilatih di 6 minggu × 8 hub (bukan full spec 8 minggu × 10–20 hub). Arsitektur identik; scale-up = ubah 2 konstanta + rerun.

---

## 2. Temuan Kritis dari Data (dengan bukti, bukan opini)

### F1 — Generator data M1 degenerate ⛔ (blocker tertinggi)

Formula persis dari notebook FASE 9: `promised_deadline = 25.0 + sla_buffer`. Konstanta 25 itu independen dari jarak shipment. Verifikasi reproduksi exact (200K baris, seed sama):

| Bukti | Angka |
|---|---|
| Distribusi tier | CRITICAL 74.1% / WARNING 17.7% / SAFE 8.3% (match output notebook) |
| Tier vs jarak, bucket 40–50 km | **99.3% CRITICAL** — praktis deterministik |
| Akurasi rule 2-variabel (distance, sla_buffer) TANPA ML | **91.5%** |
| Same-day >14 km | selalu CRITICAL, bahkan kondisi terbaik (cerah + lancar + 1 stop) |
| Shipment yang structurally-doomed (pasti telat apapun kondisinya) | same_day: 73%, express: 54% |

**Dampak berantai kalau tidak diperbaiki:**
- Metrik M1 inflated — Recall 0.987 sebagian besar karena kelas mayoritas memang CRITICAL.
- **M5 lazy evaluation jadi bohong:** SHAP "hanya untuk WARNING/CRITICAL" = menyala di **91.8%** shipment. Prinsip "deep analyze only for affected trucks" di proposal jadi tidak jujur.
- **M6 escalation meledak:** spec-mu sendiri (§7.2 M6) mensyaratkan escalation rate 5–20% dan alert-fatigue alarm di >30%. Dengan base rate 74% CRITICAL, sistem lahir dalam kondisi alarm.
- **M4 objective f2 (SLA risk) kehilangan makna:** kalau hampir semua rute CRITICAL, penalty risk tidak mendiskriminasi antar-kromosom.

### F2 — conf_m1 di formula M6 tidak computable ⛔

Formula M6 §3.3.1: `model_confidence(M1) = 1 − min(1, (P90−P50)/(2×expected_eta))`. M1 hanya punya **satu** model α=0.90. Tidak ada P50 → interval width tidak ada → komponen berbobot terbesar (w1=0.40) di confidence aggregate tidak bisa dihitung. M2 sudah membuktikan pattern 2-model-terpisah bekerja (dan cepat: ~3 detik/model di 112K baris).

### F3 — Cross-model feature M2→M1 belum terpasang

`FEATURE_COLS` M1 (9 fitur) tidak memuat `hub_dwell_time_predicted` — padahal ini "critical link M2→M1" di INTERACTION_MAP §2, dan di generator sintetis dwell justru dibuang sebagai noise `uniform(5,15)`. M2 sekarang memprediksi dwell dengan MAE 3.84 menit — sinyal nyata yang sedang disia-siakan. Estimasi `Next.md`-mu sendiri: integrasi M2 memperbaiki akurasi M1 5–10%.

### F4 — Threshold drift, tiga versi beredar

Dokumen desain: +60/−30. Notebook 45K: +25/0. Model 1M: +30/0. Harus ada **satu** `risk_thresholds.yaml` sebagai source of truth, dan dokumen desain M1 §2.2 perlu di-update supaya juri tidak menemukan inkonsistensi antara lampiran teknis dan artefak.

### F5 — Ukuran model M1 92.8 MB

num_leaves=512 × ~1000+ trees. Kemungkinan latency masih <50ms, tapi: (a) memory footprint di FastAPI + M5 TreeExplainer (yang menyimpan tree structure lagi) bisa 2×; (b) untuk data v2 yang lebih "sulit" (post-fix), kapasitas ini justru mungkin perlu — jadi jangan dipangkas dulu, ukur dulu. Masuk checklist M1 v2.

### F6 — Fix terverifikasi (bukan hipotesis)

Deadline distance-aware: `typical_eta = distance/30×60 + 10 + 2.5×3.5` (kecepatan nominal traffic=1.0, dwell nominal, stop rata-rata), `deadline = typical_eta + buffer(10/25/60)`. Hasil di 200K baris:

| Metrik | Sebelum | Sesudah fix |
|---|---|---|
| CRITICAL base rate | 74.1% | 30.8% |
| Akurasi rule tanpa-ML | 91.5% | 74.3% |
| CRITICAL di bucket 40–50 km | 99.3% | 49.9% |

CRITICAL sekarang muncul dari **kondisi** (traffic 1.3/1.8 × cuaca buruk × banyak stop) — persis hal yang mau diprediksi model. Catatan kalibrasi: 30.8% masih tinggi untuk realisme operasional; naikkan buffer atau tambahkan komponen "perusahaan menjanjikan P75 historis, bukan mean" untuk menekan ke **target base rate 8–15%** (selaras guardrail escalation M6 5–20%). Ini knob kalibrasi 1 baris — tuning-nya bagian dari M1 v2.

---

## 3. Revised Pipeline — Urutan Eksekusi Optimal

Perubahan utama vs `Next.md`-mu: **M1 v2 masuk sebagai Step 0 wajib** sebelum M4/M5/M6, karena ketiganya mengonsumsi output M1. M3 & M2 (yang di planning-mu urutan 1–2) **sudah selesai** di sesi ini.

```
Step 0  ── M1 v2 (Colab, ~setengah hari)          ⛔ BLOCKER untuk semua downstream
Step 1  ── M4 Solomon validation + GA tuning       ← bisa MULAI PARALEL dgn Step 0
Step 2  ── M4 skenario Indonesia                   ← butuh M1 v2 (f2) + M3 (f3, ready)
Step 3  ── M5 re-point ke M1 v2                    ← 30 menit, wrapper sudah teruji
Step 4  ── M6 build + kalibrasi + sensitivity      ← kontrak I/O dikunci SEKARANG (§5)
Step 5  ── End-to-end demo + latency test
```

### Step 0 — M1 v2 (satu-satunya yang butuh Colab/retrain)

Modifikasi notebook FASE 9 & 9.5, urutan kerja:

1. **Ganti deadline rule** ke distance-aware (§F6) + tuning buffer sampai CRITICAL base rate 8–15%.
2. **Suntik fitur dwell:** ganti `hub_dwell = uniform(5,15)` dengan dwell dari distribusi output simulator M2 per (hub_tier, jam, cuaca) — file `m2_raw_shipments.parquet` sudah ada; minimal: sampling dari empirical distribution per kondisi. Tambahkan `hub_dwell_time_predicted` (prediksi model M2 P50) sebagai fitur ke-10 di `FEATURE_COLS`.
3. **Train PASANGAN quantile:** α=0.50 dan α=0.90 (dua model, pattern persis M2). Enforce monotonicity `P90 = max(P90, P50)` di inference.
4. **Rekalibrasi threshold** di val set (cost function `false_SAFE = 3×false_CRITICAL` seperti FASE 5) → tulis SATU `risk_thresholds.yaml`.
5. **Acceptance gates baru (lebih jujur dari yang lama):**
   - MAE P50 < 15 menit; Coverage P90 di 88–92% (kriteria yang sama yang M2 sudah lulus)
   - F1 CRITICAL ≥ 0.80 **pada base rate CRITICAL 8–15%** (bukan 74%)
   - Gap akurasi model vs rule-2-variabel ≥ +10 poin (bukti ML menambah nilai — metrik baru, jadikan tabel juri)
   - Latency P95 < 50ms & peak memory tercatat (F5)
6. **Update dokumen desain M1 §2.2** dengan threshold final (F4).

### Step 1–2 — M4 (data sudah siap lokal)

- **Fase validasi:** NSGA-II (DEAP) di R101 subset 25-customer. **Jangan hardcode best-known dari ingatan** — ambil tabel best-known dari sumber referensi (SINTEF TOP / galgos) dan simpan sebagai `m4_best_known.json` dengan URL sumber di dalamnya; gap <5% dihitung terhadap file itu.
- **Fase tuning:** grid 81 kombinasi × 3 instance sesuai spec §6.3 — tapi time-boxed per run (2.5s) supaya total grid ≤ ~10 menit, bukan 243 run penuh generasi.
- **Fase Indonesia:** decoder memanggil `M1.predict()` (v2) untuk f2 dan `calculate_shipment_co2()` untuk f3 — interface M3 sudah final, kontraknya: input `(distance_km, vehicle_type, load_factor)` per TCE, output `co2_kg`. Perhatikan budget: M3 terukur 0.024 ms/call → aman dipanggil per-kromosom; M1 HARUS batch-predict per generasi (bukan per-kromosom satu-satu) agar tidak jadi bottleneck.
- **Gate:** hypervolume ≥ 0.80, reduction ≥15% di 3 skenario (urban/intercity/mixed), convergence plot.

### Step 3 — M5 (30 menit kerja)

Wrapper `M5Explainer` sudah generik dan additivity-PASS. Kerjaan tersisa: load `m1_eta_lightgbm_v2_p90.txt`, jalankan additivity di 10 sampel, ukur latency single-instance (<50ms), pasang trigger `risk_tier in {WARNING, CRITICAL}` — yang setelah fix F1 benar-benar berarti "sebagian kecil shipment", sesuai janji proposal.

### Step 4 — M6 (blueprint lengkap di §5)

---

## 4. Apa yang TIDAK Perlu Dikerjakan (penghematan eksplisit)

- **GRU/LSTM M1 (FASE 9.6):** hasil notebook menunjukkan LightGBM sudah unggul; deep learning di data tabular sintetis 9 fitur tidak menambah nilai kompetisi. Cukup jadi 1 baris "sudah dieksplorasi, tree-based menang" di laporan.
- **Optuna ulang untuk M1 v2:** mulai dari hyperparameter 1M yang ada (num_leaves=512, lr=0.03); hanya tuning ulang kalau gate gagal.
- **NSGA-III:** tetap roadmap-only (3 objective = sweet spot NSGA-II, sesuai keputusanmu sendiri di §2.4 M4).
- **Kafka/Temporal/Airflow:** tetap production-roadmap-only (konsisten keputusan sesi proposal 31 Mei).
- **M2 scale-up ke 10–20 hub:** tunda sampai semua model lain hijau; nilai marginalnya kecil untuk demo.

---

## 5. Blueprint Agentic System (M6) — Grounded ke Artefak Nyata

### 5.1 Prinsip yang dipertahankan (dari keputusan sesi proposal)

Supervisor-routed, **deterministic core** (LLM tidak pernah memutuskan rute — maksimal menulis penjelasan), tools ≠ agents (GA & model inference adalah tool), typed I/O, checkpointing, graceful degradation.

### 5.2 State schema — field names PERSIS dari artefak yang ada

```python
class SLAraState(TypedDict):
    shipment_id: str
    # dari feature store / generator
    distance_km: float; weather_severity: int; traffic_index: float
    vehicle_type: str; load_factor: float; promised_deadline: float
    # M2 (artefak nyata: m2_dwell_p50/p90_lightgbm.txt + m2_config.json)
    dwell_p50: float; dwell_p90: float
    coverage_p90_hist: float          # dari m2_config.json: 0.8983
    m2_degraded: bool                 # fallback: global_dwell_median_fallback = 12.90
    # M1 v2 (BELUM ADA — kontrak dikunci sekarang)
    eta_p50: float; eta_p90: float; risk_tier: str
    # M3 (artefak nyata: m3_carbon_estimator.py)
    total_co2_kg: float; tce_breakdown: list; audit_trail_id: str
    audit_validity: float             # 1 − 0.097 = 0.903 (dari validation report)
    # M4 (kontrak)
    pareto_front: list; selected_route: dict; constraint_satisfaction: float
    # M5 (artefak nyata: m5_shap_explainer.py, schema teruji)
    shap_explanation: dict | None     # keys: base_value, prediction, top_features[5]
    # M6
    confidence_aggregate: float; confidence_breakdown: dict
    decision: str                     # "auto_execute" | "escalate_human"
```

### 5.3 Status computability formula confidence — HARI INI

`confidence = 0.40·conf_m1 + 0.15·conf_m2 + 0.25·cs_m4 + 0.10·freshness + 0.10·audit_validity`

| Komponen | Bobot | Status | Angka nyata hari ini |
|---|---|---|---|
| `conf_m1` = 1−min(1, (P90−P50)/(2·ETA)) | 0.40 | ⛔ **blocked** — M1 tidak punya P50 (F2) | — |
| `conf_m2` = 1−\|coverage−0.90\| | 0.15 | ✅ computable | 1−\|0.8984−0.90\| = **0.998** |
| `cs_m4` = feasible/total Pareto | 0.25 | 🔜 menunggu M4 | mock 0.80 utk test graph |
| `data_freshness` | 0.10 | 🟡 perlu cache-layer stub (belum ada API live) | stub: 1.0 dgn timestamp |
| `audit_validity` = 1−deviasi | 0.10 | ✅ computable | 1−0.097 = **0.903** |

**Worked example target (setelah M1 v2 & M4 selesai)** — misal P50=120, P90=145: conf_m1=0.896; total = 0.40(0.896)+0.15(0.998)+0.25(0.80)+0.10(1.0)+0.10(0.903) = **0.898 → auto-execute**. Semua angka traceable ke file artefak, tidak ada yang di-hardcode saat demo — persis klaim proposal.

### 5.4 Node contract table

| Node | Memanggil (tool) | Input dari state | Output ke state | Fallback (teruji/terdefinisi) |
|---|---|---|---|---|
| `hub_risk_agent` | 2× LightGBM booster M2 | fitur hub 20 kolom (list di `m2_config.json`) | dwell_p50/p90 | `global_dwell_median_fallback=12.90`, set `m2_degraded=True` |
| `eta_agent` | 2× LightGBM booster M1 v2 | 10 fitur (9 lama + dwell_p50) | eta_p50/p90, risk_tier | dummy `distance/23.4×60` (kecepatan rata2 terukur) + escalate paksa |
| `carbon_agent` | `calculate_shipment_co2()` | tce_list | total_co2_kg, audit_trail_id | tidak perlu — deterministik, 0.024ms |
| `route_opt_agent` | NSGA-II time-boxed 2.5s | shipments + fleet | pareto_front, constraint_satisfaction | cached previous route + escalate |
| `explain_agent` | `M5Explainer.explain()` | fitur M1, HANYA jika tier∈{WARN,CRIT} | shap_explanation | `None` — confidence TIDAK terpengaruh (sesuai failure cascade §10 INTERACTION_MAP) |
| `decision_agent` | formula §5.3 (pure function) | semua confidence input | decision + breakdown | — |

### 5.4b Urutan build M6 yang optimal (bisa mulai SEBELUM M1 v2 selesai)

1. Graph + state schema + conditional edge (threshold 0.70) dengan **mock M1 & M4** — filosofi "integrasi dengan stub > integrasi terlambat" dari readme-mu sendiri.
2. Wire node M2, M3, M5 ke artefak nyata (ketiganya sudah ada di `slara/`).
3. Swap mock M1 → M1 v2 begitu Step 0 selesai; swap mock M4 → NSGA-II begitu Step 2 selesai.
4. Kalibrasi bobot (BA Orwin) + sensitivity ±10% di 100 shipment sampel → lampiran laporan.
5. Guardrail monitoring: escalation rate harian, alert >30% — dan ini hanya masuk akal **setelah** F1 diperbaiki.

### 5.5 Risiko spesifik M6 yang muncul dari data (bukan generik)

- **Double-counting M2:** dwell_p50 adalah fitur M1 DAN komponen confidence terpisah (w2=0.15). Spec-mu sudah sadar ini ("dobel count jika bobot tinggi") — pastikan sensitivity analysis menguji korelasi conf_m1 vs conf_m2 secara eksplisit.
- **conf_m2 hampir selalu ≈1.0** (0.998 hari ini) karena coverage M2 sangat terkalibrasi — artinya w2 praktis konstanta, tidak mendiskriminasi. Pertimbangkan ganti definisi ke rolling-window 7 hari (sesuai spec §3.3.2) supaya bergerak saat drift.
- **Latency:** M4 makan 2.5s dari budget 3s (85%). M1 dipanggil per-kromosom oleh M4 → WAJIB batch-predict per generasi. M3 aman (terukur 0.024ms).

---

## 6. Prompt Eksekusi Siap Pakai

### Prompt A — Sesi Colab: M1 v2 (jalankan duluan)

```
Saya punya notebook M1 SLAra AI (LightGBM Quantile ETA prediction, terlampir).
Ada cacat terverifikasi di FASE 9: promised_deadline = 25.0 + sla_buffer memakai
typical_eta KONSTAN, sehingga 74.1% data CRITICAL dan risk tier ~91% bisa ditebak
rule 2-variabel tanpa ML. Tolong buat M1 v2 dengan perubahan berikut, JANGAN ubah
bagian lain yang sudah benar (chronological split, threshold calibration FASE 5,
sample weighting):

1. FASE 9: deadline distance-aware:
   typical_eta = distance_km/30*60 + 10 + 2.5*3.5  (kecepatan nominal traffic=1.0)
   promised_deadline = typical_eta + buffer, buffer awal {same_day:10, express:25,
   standard:60}. Lalu TUNING buffer sampai CRITICAL base rate di test set 8-15%.
   Laporkan distribusi tier final + crosstab tier vs distance bucket sebagai bukti
   determinisme jarak hilang.
2. FASE 9: ganti hub_dwell = uniform(5,15) dengan sampling dari file
   m2_raw_shipments.parquet (empirical distribution per weather_severity), dan
   tambahkan fitur ke-10 'hub_dwell_time_predicted' ke FEATURE_COLS.
3. FASE 9.5: latih DUA model quantile terpisah alpha=0.50 dan alpha=0.90
   (hyperparameter awal sama dgn model 1M lama). Enforce P90=max(P90,P50).
4. Rekalibrasi threshold di val set (cost false_SAFE = 3x false_CRITICAL),
   tulis SATU risk_thresholds.yaml final.
5. Tambahkan tabel baru untuk laporan: akurasi model vs akurasi rule-2-variabel
   (distance+sla_buffer) — target gap >= +10 poin.
6. Acceptance: MAE P50 < 15, Coverage P90 88-92%, F1 CRITICAL >= 0.80 pada base
   rate 8-15%, latency P95 < 50ms + catat peak memory (model lama 92.8MB).
Simpan artefak: m1_eta_v2_p50.txt, m1_eta_v2_p90.txt, risk_thresholds.yaml,
model_config.yaml (berisi 10 FEATURE_COLS).
```

### Prompt B — Sesi M4 (bisa paralel dengan A untuk fase Solomon)

```
Bangun M4 NSGA-II (DEAP) untuk SLAra AI sesuai spec M4_Route_Optimization.md.
Data Solomon 56 instance sudah ada di py-ga-VRPTW/data/text/ (format: header
vehicle number/capacity, lalu baris customer x,y,demand,ready,due,service).
Fase 1: validasi di R101 subset 25 customer pertama. PENTING: jangan hardcode
best-known solution dari ingatan — buat m4_best_known.json berisi nilai dari
tabel referensi SINTEF/galgos beserta URL sumbernya, hitung gap terhadap file itu.
Fase 2: grid search {pop 50/100/200} x {gen 100/200/500} x {cx 0.7/0.8/0.9} x
{mut 0.05/0.1/0.2}, tiap run time-boxed 2.5s.
Fase 3 (setelah M1 v2 ada): 3 objective — f1 cost, f2 SLA risk via M1 v2
batch-predict PER GENERASI (jangan per kromosom), f3 environmental via
calculate_shipment_co2() dari slara/m3 (terukur 0.024ms/call, aman per-TCE).
Operator: tournament-2, OX crossover 0.9, swap+2opt mutation 0.1, repair
kapasitas. Gate: gap Solomon <5%, hypervolume >=0.80, reduction >=15% di 3
skenario (urban 50 stop / intercity 20 stop / mixed 80 stop), convergence plot.
```

### Prompt C — Sesi M6 (mulai dengan mock, sesuai §5.4b)

```
Bangun M6 LangGraph orchestrator SLAra AI. State schema dan node contract sudah
final di dokumen plan §5.2-5.4 (terlampir). Wire node nyata: M2 (2 booster
LightGBM di slara/m2 + fallback global_dwell_median_fallback=12.90 dari
m2_config.json), M3 (calculate_shipment_co2), M5 (M5Explainer, trigger hanya
WARNING/CRITICAL). M1 dan M4 pakai mock dulu dengan interface persis kontrak
(eta_p50, eta_p90, risk_tier / pareto_front, constraint_satisfaction).
Confidence formula bobot 0.40/0.15/0.25/0.10/0.10 di-load dari
m6_confidence_config.yaml. Komponen yang sudah computable dari artefak:
conf_m2 = 1-|0.8984-0.90| = 0.998, audit_validity = 0.903. Conditional edge
threshold 0.70. Escalation message wajib berisi primary_uncertainty_driver +
confidence_breakdown + shap_explanation. Deliverable: graph jalan end-to-end
dengan mock, sensitivity analysis bobot ±10% di 100 shipment sintetis, dan
uji failure cascade (matikan M2 -> m2_degraded=True, confidence turun,
sistem tidak crash).
```

---

## 7. Definition of Done per Step

| Step | Gate | Cara verifikasi |
|---|---|---|
| 0 (M1 v2) | Base rate CRITICAL 8–15% • gap model-vs-rule ≥+10pt • Coverage P90 88–92% • 1 YAML threshold | tabel di notebook + crosstab tier×distance |
| 1 (M4 Solomon) | gap <5% vs `m4_best_known.json` (bersumber URL) | file JSON + log run |
| 2 (M4 Indonesia) | hypervolume ≥0.80 • reduction ≥15% ×3 skenario • P95 <2.5s | convergence plot + tabel 3 skenario |
| 3 (M5) | additivity PASS di M1 v2 • latency <50ms • trigger rate ≈ base rate WARN+CRIT | script test |
| 4 (M6) | e2e run dgn mock → real • sensitivity <5% decision change • failure cascade M2-down tidak crash | audit trail + sensitivity report |
| 5 (demo) | P95 end-to-end <3s • escalation rate 5–20% | latency log |

---

*Semua angka di dokumen ini traceable: notebook M1 (39 cell, output eksekusi), `slara/m2/m2_training_report.md`, `slara/m2/m2_config.json`, `slara/m3/m3_validation_report.md`, dua script verifikasi 200K baris (reproduksi exact formula FASE 9), dan 56 file Solomon di `py-ga-VRPTW/data/text/`.*