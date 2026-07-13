# M2 — Hub Congestion / Dwell-Time Forecast

> **Model ID:** M2
> **Jenis:** Regresi quantile (time-series tabular)
> **Prioritas:** P1
> **Owner ML:** SLAra AI — Data Engineer + Agent Engineer
> **Status desain:** Final Opsi A (LightGBM quantile) untuk kompetisi; LSTM di roadmap production

---

## 1. Ringkasan Eksekutif

M2 memprediksi **dwell time** (waktu tunggu shipment di hub/sortir center) dalam menit, dan menghasilkan **dua kuantil** sekaligus: P50 (median estimasi) dan P90 (estimasi konservatif untuk perencanaan buffer). Output P50 menjadi **fitur upstream** bagi M1 (ETA), sehingga latency dan akurasi M2 langsung mempengaruhi kualitas M1.

Keputusan desain (resolusi Bagian 7.3): **Opsi A — LightGBM dengan quantile loss**, bukan LSTM. Alasannya konsistensi tooling dengan M1, kebutuhan data yang jauh lebih sedikit, dan tetap menghasilkan angka P90 yang diminta mockup dashboard. LSTM dipertahankan sebagai roadmap production di §9 — narasi "kami tahu batas MVP dan punya rencana upgrade realistis" justru memperkuat kredibilitas di depan juri teknis.

---

## 2. Formulasi Matematis

### 2.1 Quantile Regression

Diberikan feature vector `x`, model memprediksi fungsi kuantil `q_τ(x)` untuk `τ ∈ {0.5, 0.9}`:

```
P(dwell_time ≤ q_τ(x) | x) = τ
```

Pinball loss (quantile loss) yang diminimasi:

```
L_τ(y, q) = max( (τ - 1)(y - q), τ(y - q) )
          = τ · |y - q|            if y ≥ q
            (1-τ) · |y - q|        if y < q
```

Implementasi LightGBM: gunakan `objective="quantile"` dengan parameter `alpha=0.5` (untuk P50) dan `alpha=0.9` (untuk P90). Dua model terpisah, bukan satu multi-quantile — sederhana dan stabil.

### 2.2 Output Schema

```json
{
  "hub_id": "HUB-CGK-01",
  "shipment_id": "SHP-2026-000123",
  "dwell_p50_minutes": 38.5,
  "dwell_p90_minutes": 52.0,
  "queue_length_snapshot": 14,
  "timestamp": "2026-07-09T08:30:00+07:00",
  "model_version": "m2_v1"
}
```

P90 dipakai M1 sebagai fitur konservatif (memberi buffer di ETA), P50 dipakai dashboard untuk komunikasi ke operator ("rata-rata 38 menit, worst-case 52 menit").

---

## 3. Arsitektur Model

### 3.1 Pilihan Algoritma — LightGBM Quantile

**Bukan** LSTM di fase kompetisi. Trade-off sudah dievaluasi:

| Opsi | Arsitektur | Kelebihan | Risiko |
|---|---|---|---|
| **A (MVP kompetisi) — DIPILIH** | LightGBM quantile + fitur lag/rolling window | Konsisten dengan M1 tooling; butuh data sedikit; tetap hasilkan P90 | Kurang tangkap pola sequential panjang |
| B (roadmap production) | LSTM/GRU univariate time-series per hub | Tangkap pola congestion berurutan (antrian yang membesar bertahap) | Butuh data time-series historis yang tidak realistis di synthetic; risiko overfit tinggi |

**Pemilihan Opsi A untuk kompetisi bukan "kompromi"** — ini keputusan teknis defensible: dengan dataset sintetis yang realistis (4-6 minggu data per hub, hourly granularity), LSTM akan overfit. LightGBM quantile memberi akurasi sebanding dengan 1/10 data.

### 3.2 Hyperparameter Default

```python
lgb.LGBMRegressor(
    objective="quantile",
    alpha=0.5,                    # ganti ke 0.9 untuk model P90
    n_estimators=500,
    max_depth=6,
    learning_rate=0.05,
    num_leaves=31,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_lambda=1.0,
    random_state=42,
)
```

---

## 4. Feature Engineering

### 4.1 Group A — Queue State (Snapshot)

| Fitur | Sumber | Catatan |
|---|---|---|
| `queue_length_current` | WMS / hub sensor (simulated untuk MVP) | Jumlah shipment menunggu saat ini |
| `dock_utilization_pct` | Derived: `docks_occupied / docks_total` | 0.0–1.0 |
| `incoming_shipment_rate_last_1h` | Event log | Rolling count per jam |
| `incoming_shipment_rate_last_15m` | Event log | Lebih responsif ke spike |
| `avg_service_time_last_1h` | Event log | Rata-rata waktu proses per shipment 1 jam terakhir |

### 4.2 Group B — Lag & Rolling Window

| Fitur | Rumus | Catatan |
|---|---|---|
| `dwell_lag_1h` | `dwell_p50` 1 jam lalu | Autokorelasi kuat |
| `dwell_lag_24h` | `dwell_p50` 24 jam lalu | Pola harian |
| `dwell_lag_168h` | `dwell_p50` 1 minggu lalu | Pola mingguan |
| `dwell_rolling_mean_6h` | Mean dwell 6 jam terakhir | Smooth trend |
| `dwell_rolling_std_6h` | Std dwell 6 jam terakhir | Volatilitas → kontribusi ke P90 lebar |
| `queue_rolling_max_3h` | Max queue 3 jam terakhir | Spike detection |

### 4.3 Group C — Temporal (cyclical, sama dengan M1)

`hour_of_day_sin/cos`, `day_of_week_sin/cos`, `is_weekend`, `is_peak_hour`, `is_holiday`.

### 4.4 Group D — Hub-Specific Static

| Fitur | Catatan |
|---|---|
| `hub_id` (target encoding) | Embed hub baseline congestion |
| `hub_capacity` | Maksimum throughput teoretis |
| `hub_num_docks` | Infrastruktur |
| `hub_region` | urban_dense / urban / intercity |

### 4.5 Group E — External (weather)

Sama dengan M1 — `weather_severity_score` dari BMKG cache. Hujan deras mempengaruhi kecepatan unloading di dock terbuka.

---

## 5. Dataset Sourcing

| Sumber | Peran | Link |
|---|---|---|
| BigQuery-Geotab Intersection Congestion (Kaggle) | Proxy realistis untuk *pendekatan modeling* congestion (stopping distance, wait time, 4 kota AS). Bukan hub gudang, tapi metodologi queueing/congestion prediction dari traffic features transferable. | `kaggle.com/c/bigquery-geotab-intersection-congestion` |
| Traffic Prediction Dataset (fedesoriano) | Proxy sederhana time-series traffic per jam, 4 titik. Bagus untuk uji cepat fitur lag/rolling. | `kaggle.com/datasets/fedesoriano/traffic-prediction-dataset` |
| **Data sintetis (wajib, tidak ada penggantinya)** | Tidak ada dataset publik "warehouse/hub dwell time last-mile" yang terbuka. Domain port-congestion (container dwell time) paling dekat secara konsep tapi proprietary (TOS vendor). **Solusi:** bangun simulasi antrian **M/M/c queue** (teori antrian, bukan random number) berdasarkan kapasitas hub, jumlah dock, rata-rata service time per shipment. Defensible di depan juri karena grounded di teori matematis yang dapat dijelaskan. | — |

### 5.1 Simulator M/M/c (Spesifikasi)

```
λ = arrival rate shipment/jam (variasi: poisson dengan rate tergantung jam)
μ = service rate per dock (shipment/jam)
c = jumlah dock

Untuk setiap hub:
  - Set λ(t) per jam berdasarkan pola trafik Jakarta (peak di 09:00 & 17:00)
  - Set μ berdasarkan vehicle_type mix
  - Set c berdasarkan hub tier (5/10/20 docks)
  - Simulasi 8 minggu × 24 jam × 7 hari
  - Output: dwell_time per shipment + queue_length per jam

Validasi simulasi:
  - Bandingkan distribusi output dengan BigQuery-Geotab wait time (sama-sama right-skewed)
  - Cek steady-state: rata-rata queue stabil setelah warm-up 2 minggu
```

---

## 6. Training Workflow

### 6.1 Tahapan

1. **Baseline naive** — `dwell_p50_pred = dwell_lag_24h` (kemarin jam yang sama). Catat pinball loss & MAE baseline.
2. **Train LightGBM quantile P50** — fitur §4, objective `quantile`, `alpha=0.5`.
3. **Train LightGBM quantile P90** — model terpisah, `alpha=0.9`.
4. **Time-based split** — sama dengan M1 (4 minggu train / 1 minggu val / 1 minggu test). Per-hub split bukan per-shipment, untuk mencegah leakage antar jam di hub yang sama.
5. **Hyperparameter tuning** Optuna, 50 trial, fokus minimasi pinball loss di val.
6. **Retrain final** di train+val, evaluasi di test set sekali.

### 6.2 Cross-Validation

GroupKFold dengan `group=hub_id` — semua jam dari satu hub di fold yang sama. Mencegah leakage pola per-hub.

---

## 7. Validasi & Metrik

### 7.1 Pinball Loss (Primary)

Metrik utama untuk quantile regression. Dilaporkan terpisah untuk P50 dan P90:

| Metrik | Target |
|---|---|
| Pinball loss P50 | < 5.0 (menit) |
| Pinball loss P90 | < 8.0 (menit) |

### 7.2 MAE P50 (Komunikasi Stakeholder)

MAE pada prediksi P50 — angka yang mudah dijelaskan ke operator non-teknis.

| Metrik | Target |
|---|---|
| MAE P50 | < 8 menit |

### 7.3 Coverage Check (P90 Calibration) — KRITIS

**Definisi:** dari semua actual dwell time di test set, berapa persen yang **benar-benar ≤ prediksi P90**?

```
coverage = (count(actual_dwell ≤ predicted_p90)) / (total samples)
```

| Coverage | Interpretasi | Aksi |
|---|---|---|
| 88–92% | P90 terkalibrasi dengan baik (target 90% ± 2%) | — |
| < 85% | P90 **under-predicting** — shipment telat lebih sering dari prediksi | Naikkan `alpha` atau tambah fitur volatilitas |
| > 95% | P90 **over-predicting** — buffer terlalu konservatif, bikin ETA terlalu pesimis | Turunkan `alpha` atau re-check fitur |

Coverage check wajib dilaporkan di laporan — ini metrik yang membedakan "P90 valid" dari "angka karangan".

### 7.4 Baseline Comparison

| Model | Pinball P50 | Pinball P90 | MAE P50 | Coverage P90 |
|---|---|---|---|---|
| Naive lag-24h | (X) | (X) | (X) | (X) |
| Linear Quantile | (X) | (X) | (X) | (X) |
| **LightGBM Quantile (final)** | **(X)** | **(X)** | **(X)** | **(X)** |

---

## 8. Inference & Deployment

### 8.1 Latency Budget — < 30ms

Lebih ketat dari M1 (50ms) karena M2 adalah upstream dependency M1. Total budget M1+M2 harus tetap di bawah 80ms.

### 8.2 Update Policy — Event-Driven, Bukan Polling

M2 **TIDAK** dipanggil per request M1 secara sinkron. Sebaliknya:

```
Event: queue_length berubah di hub X
  → Trigger recomputation dwell_p50/p90 untuk hub X
  → Update Redis cache key: m2:dwell:{hub_id}
  → M1 baca dari cache (HIT cepat, MISS pakai fallback default)

Polling fallback tiap 5 menit (kalau tidak ada event) — untuk safety.
```

Implementasi: Kafka/Redis Streams untuk event, atau cron job 5-menitan untuk MVP sederhana.

### 8.3 Fallback Behavior

Jika M2 cache miss atau service down:

```
dwell_p50_fallback = median historis per hub (precomputed dari training data)
dwell_p90_fallback = dwell_p50_fallback × 1.4  (heuristik lebar interval)
flag m2_degraded = true → confidence_aggregate M6 diturunkan
```

M1 tetap berjalan dengan fitur degraded; sistem tidak crash.

### 8.4 Caching Strategy

| Key | TTL | Update trigger |
|---|---|---|
| `m2:dwell:{hub_id}` | 5 menit | queue_length event |
| `m2:dwell:{hub_id}:historical_median` | 24 jam | batch job malam |
| `m2:model_version` | — | Deploy pipeline |

### 8.5 Monitoring

- Pinball loss rolling 24-jam (alert jika naik >30%)
- Coverage P90 rolling 7-hari (alert jika keluar band 85–95%)
- Queue length distribution drift per hub (KS-test terhadap distribusi training)

---

## 9. Roadmap — Opsi B (LSTM) untuk Production

### 9.1 Kapan Upgrade

Upgrade dari Opsi A ke LSTM hanya jika **semua** kondisi terpenuhi:

- [ ] Data historis hub dwell time riil (dari Blibli WMS) tersedia minimal 6 bulan dengan granularity 15-menit
- [ ] Jumlah hub ≥ 10 (cukup sample untuk generalisasi)
- [ ] Opsi A sudah hit ceiling performance (coverage P90 tidak bisa di atas 88% meski fitur ditambah)
- [ ] Tim punya kapasitas ML ops untuk monitoring LSTM (gradient vanishing, exploding, drift deteksi lebih kompleks)

### 9.2 Arsitektur Roadmap LSTM

```
Per hub:
  Input: [dwell_t-168h, ..., dwell_t-1h, queue_t-168h, ..., queue_t-1h]
  LSTM(64) → LSTM(32) → Dense(2) → [p50, p90]
  
  Loss: pinball combined (τ=0.5 + τ=0.9)
  Training: teacher forcing dengan window 168 jam (1 minggu)
```

### 9.3 Hybrid Bridge (opsional, menengah)

Sebelum full LSTM, bisa coba hybrid: LightGBM quantile sebagai baseline + LSTM residual model untuk capture temporal pattern yang tertinggal. Kompleksitas operasional naik tapi lebih aman dari full switch.

---

## 10. Risiko & Mitigasi

| Risiko | Severity | Mitigasi |
|---|---|---|
| Simulator M/M/c terlalu ideal (poisson murni) → tidak representatif | Tinggi | Modulasi λ(t) dengan pola trafik riil Jakarta; tambah shock event (kondweather buruk mendadak) |
| P90 under-calibrated → M1 dapat ETA terlalu optimis | Tinggi | Coverage check di §7.3 wajib lulus sebelum model di-deploy |
| Cold-start hub baru (tidak ada historis) | Sedang | Fallback ke median global + flag `hub_cold_start=true` |
| Event queue down → M2 tidak update | Sedang | Polling fallback 5 menit + alert |
| Feature leakage dari lag construction | Sedang | Strict chronological split + GroupKFold per hub |

---

## 11. Acceptance Criteria (untuk demo kompetisi)

- [ ] Simulator M/M/c menghasilkan distribusi dwell right-skewed (validasi visual vs BigQuery-Geotab)
- [ ] Pinball loss P50 < 5.0 di test set
- [ ] Coverage P90 di band 88–92%
- [ ] Endpoint event-driven update aktif (bukan polling-only)
- [ ] Latency inference < 30ms
- [ ] Fallback behavior teruji (M2 down → M1 tetap jalan dengan flag degraded)
- [ ] Tabel baseline comparison ditampilkan di laporan
- [ ] Narasi roadmap LSTM §9 ada di dokumen teknis (menunjukkan kesadaran batas MVP)

---

**Referensi internal:** M1 (downstream consumer fitur `hub_dwell_time_predicted`), M6 (flag `m2_degraded` → turunkan confidence aggregate), M5 (SHAP untuk dwell prediction, opsional).
