# M1 — ETA Prediction & SLA Risk Tier

> **Model ID:** M1
> **Jenis:** Regresi tabular (single-model)
> **Prioritas:** P0 (inti sistem)
> **Owner ML:** SLAra AI — Agent Engineer + Data Engineer
> **Status desain:** Final (keputusan Bagian 7.1 — gabung delay classifier + ETA regressor → satu model regresi)

---

## 1. Ringkasan Eksekutif

M1 adalah model inti SLAra. Tugasnya memprediksi **estimasi waktu tiba (ETA)** sebuah shipment dalam satuan menit, kemudian **menurunkan status SLA risk (SAFE / WARNING / CRITICAL) secara deterministik** dari selisih `predicted_ETA − promised_deadline`.

Keputusan desain utama (hasil resolusi Bagian 7.1): **tidak ada classifier "delay" terpisah**. Semua keputusan SLA adalah turunan matematis langsung dari prediksi ETA. Ini meniadakan risiko *inconsistency* antara classifier dan regressor (kasus: classifier bilang SAFE tapi regressor bilang telat), sekaligus konsisten dengan filosofi auditability yang sama dipakai di M3 (Carbon) — rule-based untuk keputusan yang harus dapat diaudit.

Model berdampak bisnis tertinggi di sistem karena *output*-nya menjadi *trigger* untuk seluruh chain keputusan: reroute (M4), human escalation (M6), SHAP deep-analysis (M5), dan dashboard alerting.

---

## 2. Formulasi Matematis

### 2.1 Prediksi ETA

Diberikan feature vector `x ∈ ℝ^d` untuk satu shipment, model regresi `f_θ` memetakan:

```
ETA_pred = f_θ(x)                 # dalam menit sejak pickup
ETA_pred_timestamp = pickup_ts + ETA_pred * 60s
```

### 2.2 Derivasi Risk Tier (deterministic, non-ML)

```
slack_minutes = promised_deadline - ETA_pred_timestamp
                 (positif = masih ada buffer, negatif = telat)

if slack_minutes >= +60:        → SAFE
if -30 <= slack_minutes < +60:  → WARNING
if slack_minutes < -30:         → CRITICAL
```

Threshold `+60` dan `-30` menit **bukan hardcoded final** — keduanya terekspos sebagai parameter konfigurasi (`risk_thresholds.yaml`) yang dapat dituning dari confusion-matrix trade-off pada data validasi (lihat §6.3). Pemisahan parameter dari kode adalah prasyarat agar *tuning threshold* bisa dijalankan otomatis oleh pipeline CI sebelum demo.

### 2.3 Mengapa Bukan Dua Model Terpisah

| Aspek | Dua model (classifier + regressor) | Satu regressor + rule |
|---|---|---|
| Konsistensi label | Tidak dijamin — bisa konflik | Dijamin by construction |
| Auditability | Black-box classifier | Rule transparan |
| Tuning threshold | Retraining classifier | Edit YAML |
| Onboarding juri | "Percaya classifier" | "Lihat matematikanya" |
| Cost training | 2× lipat | 1× |

---

## 3. Arsitektur Model

### 3.1 Pilihan Algoritma

**XGBoost Regressor** (atau LightGBM sebagai alternatif yang lebih cepat di inferensi).

Alasan (sama dengan proposal, dipertahankan):
- Data tabular dengan campuran numerik & kategorikal → tree-based unggul
- Cepat dilatih di data terbatas (synthetic Indonesia relatif kecil)
- Native `feature_importance` → mendukung SHAP TreeExplainer (lihat M5)
- Robust terhadap outlier & missing value tanpa preprocessing berat

**Bukan** neural network di fase kompetisi: data sintetis tidak cukup untuk regularisasi NN yang efektif, dan interpretabilitas menurun.

### 3.2 Hyperparameter Default (titik awal sebelum tuning)

```python
xgb.XGBRegressor(
    objective="reg:squarederror",
    n_estimators=800,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    min_child_weight=5,
    reg_lambda=1.0,
    early_stopping_rounds=50,
    tree_method="hist",          # CPU-friendly, cepat di environment kompetisi
    random_state=42,
)
```

Tuning ruang: `max_depth ∈ {4,6,8}`, `learning_rate ∈ {0.03, 0.05, 0.1}`, `n_estimators ∈ {400, 800, 1500}`, `subsample ∈ {0.7, 0.8, 0.9}`, `colsample_bytree ∈ {0.7, 0.8, 0.9}`, `min_child_weight ∈ {1, 5, 10}`.

---

## 4. Feature Engineering

### 4.1 Group A — Temporal (cyclical encoding wajib)

| Fitur | Encoding | Catatan |
|---|---|---|
| `hour_of_day` | `sin(2πh/24)`, `cos(2πh/24)` | Bukan integer — pecah siklus 24 jam |
| `day_of_week` | `sin(2πd/7)`, `cos(2πd/7)` | Sama |
| `is_weekend` | binary | Sabtu/Minggu |
| `is_holiday` | binary | Lookup tabel hari libur nasional + Jawa Timur (Kemendagri) |
| `is_peak_hour` | binary | 07:00–09:00 & 17:00–19:00 WIB (urban); berbeda untuk intercity |

### 4.2 Group B — Spasial

| Fitur | Sumber | Catatan |
|---|---|---|
| `haversine_distance_km` | OSM / OSRM | Great-circle, cepat |
| `actual_route_distance_km` | OSRM route API | Lebih akurat, gunakan untuk training |
| `route_type` | OSM road classification | `urban_dense` / `urban` / `intercity` |
| `origin_region`, `dest_region` | Target encoding | Kabupaten/kota Jabodetabek+Jatim |

### 4.3 Group C — Operasional

| Fitur | Catatan |
|---|---|
| `vehicle_type` | One-hot: van / light_truck / medium_truck |
| `load_weight_kg` | Numerik, perlu scaling? Tidak untuk tree-based |
| `load_factor` | `load_weight / vehicle_capacity` |
| `hub_dwell_time_predicted` | **Cross-model feature** — output M2 (P50), critical link M2→M1 |
| `driver_experience_years` | Numerik (jika tersedia di synthetic generator) |
| `num_stops_remaining` | Ordinal — beban rute sisa |

### 4.4 Group D — Lingkungan

| Fitur | Sumber | Refresh policy |
|---|---|---|
| `weather_condition` | BMKG API (`api.bmkg.go.id/publik/prakiraan-cuaca`) | Cache 3-harian (sesuai frekuansi update BMKG) |
| `weather_severity_score` | Derived: 0=cerah, 1=mendung, 2=hujan, 3=hujan deras, 4=badai | Dari BMKG kategori |
| `traffic_index` | **HERE Traffic Flow API** (`traffic.ls.hereapi.com/traffic/6.1/flow.json`) — freemium, sudah dipakai riset Jabodetabek. Alternatif: Google Maps Distance Matrix API (berbayar setelah quota). Fallback gratis: derive dari `is_peak_hour` × OSM road class (didokumentasikan sebagai limitasi) | Cache 15-menit |

> **Catatan traffic source:** Klaim "Jasa Marga" di proposal asli dihapus. Jasa Marga tidak punya public developer API. HERE Traffic Flow dipilih sebagai sumber primer karena (a) freemium, (b) terdokumentasi di riset Jabodetabek, (c) struktur JSON terbuka.

### 4.5 Feature Store Schema

Single Parquet/Arrow table per shipment, di-cache di Redis dengan TTL 5 menit. Komputasi M2 (dwell) dan BMKG fetch TIDAK boleh terjadi synchronously per request M1.

---

## 5. Dataset Sourcing

| Sumber | Peran di pipeline M1 | Link |
|---|---|---|
| Food Delivery Dataset (Gaurav Malik) | **Proxy validasi arsitektur** — 45.593 record nyata dengan weather, traffic density, distance, delivery time. Dipakai untuk membuktikan pipeline feature engineering + XGBoost bekerja di data riil sebelum dipakai ke data sintetis Indonesia. | `kaggle.com/datasets/gauravmalik26/food-delivery-dataset` |
| Amazon Delivery Dataset | Proxy kedua — last-mile logistics (bukan food), agent rating, traffic, weather, distance | `kaggle.com/datasets/sujalsuthar/amazon-delivery-dataset` |
| US Logistics Performance Dataset | Proxy shipment-level delay dengan missing value & outlier terkontrol — uji robustness preprocessing | `kaggle.com/datasets/shahriarkabir/us-logistics-performance-dataset` |
| NYC Taxi Trip Duration | Proxy travel-time regression skala besar (1,4 juta trip) — validasi feature time-cyclical di efek jam sibuk & geografi riil | `kaggle.com/c/nyc-taxi-trip-duration` |
| Data sintetis Indonesia (buatan sendiri) | **Dataset final demo kompetisi** — origin/destination realistis Jabodetabek+intercity, label delay dari rule berbasis distance+traffic+weather | — |
| OpenStreetMap (OSMnx) | Geometri jalan riil Indonesia untuk distance/travel-time estimate | `osmnx` via `project-osrm.org` |
| BMKG API (resmi) | Cuaca riil per kelurahan, 3-harian, JSON | `api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kode_wilayah}` |
| HERE Traffic Flow API | Traffic index real-time Jabodetabek | `traffic.ls.hereapi.com/traffic/6.1/flow.json` |

**Prinsip sourcing:** setiap dataset publik dicantumkan link-nya. Data sintetis Indonesia eksplisit dinyatakan sebagai buatan sendiri (tidak dipalsukan sebagai data riil).

---

## 6. Training Workflow

### 6.1 Tahapan

1. **Baseline dulu** — Linear Regression dengan hanya `actual_route_distance_km` sebagai fitur. Catat baseline MAE. Ini referensi "naive" yang harus dikalahkan model.
2. **Train XGBoost** dengan fitur §4 + `early_stopping_rounds=50` berbasis validation set.
3. **Time-based split (bukan random!)** — karena ada pola temporal/musiman, random split membocorkan informasi masa depan.
   - Train: data 4 minggu pertama
   - Validation: minggu ke-5 (untuk early stopping & hyperparameter selection)
   - Test: minggu ke-6 (hanya disentuh sekali di akhir)
4. **Hyperparameter tuning** dengan Optuna (lebih efisien dari grid search di ruang 6 dimensi), 50–100 trial, fokus minimasi val MAE.
5. **Retrain final model** di gabungan train+val, evaluasi **sekali** di test set yang belum pernah dilihat. Lapor test MAE sebagai angka resmi di laporan.

### 6.2 Cross-Validation Strategy

Untuk data proxy publik (Food Delivery, NYC Taxi), gunakan **TimeSeriesSplit** dari scikit-learn dengan 5 fold. Untuk data sintetis, gunakan split chronological mingguan di atas.

### 6.3 Kalibrasi Threshold Risk Tier

Setelah model final dipilih, threshold WARNING/CRITICAL dituning dari confusion matrix pada test set:

- Plot trade-off: false CRITICAL (alert fatigue) vs false SAFE (delay tak tertangani)
- Pilih threshold yang meminimasi biaya bisnis: `cost(false_SAFE) = 3 × cost(false_CRITICAL)` (asumsi: ketelatan SLA lebih mahal daripada operator lelah)
- Simpan ke `risk_thresholds.yaml`, jangan hardcode

---

## 7. Validasi & Metrik

### 7.1 Metrik Utama (regresi)

| Metrik | Target | Catatan |
|---|---|---|
| **MAE (menit)** | < 15 menit di data sintetis | Komunikasi ke stakeholder non-teknis |
| **RMSE** | < 25 menit | Lebih sensitif ke outlier |
| **MAPE** | < 20% | Hanya untuk shipment >30 menit (hindari pembagian dengan nol) |

### 7.2 Metrik Turunan (risk tier)

Setelah threshold rule diterapkan pada prediksi ETA:

| Metrik | Target | Catatan |
|---|---|---|
| Macro F1 (3 kelas) | ≥ 0.85 | Sesuai proposal |
| **F1 kelas CRITICAL** | ≥ 0.80 | Kelas paling penting & biasanya paling minoritas — wajib dilaporkan terpisah |
| Recall CRITICAL | ≥ 0.90 | False SAFE di kelas ini paling mahal bisnis-nya |

### 7.3 Baseline Comparison (wajib ditampilkan ke juri)

Tabel seperti ini harus muncul di laporan:

| Model | MAE (menit) | F1 Macro | F1 CRITICAL |
|---|---|---|---|
| Distance-only heuristic | (X) | (X) | (X) |
| Linear Regression (all features) | (X) | (X) | (X) |
| **XGBoost (final)** | **(X)** | **(X)** | **(X)** |

Tanpa baseline comparison, klaim "model kami bagus" tidak credible.

### 7.4 Class Imbalance Treatment

Karena CRITICAL biasanya minoritas, aktifkan `sample_weight` di XGBoost:
```python
weights = np.where(y_risk_tier == "CRITICAL", 3.0,
          np.where(y_risk_tier == "WARNING", 1.5, 1.0))
model.fit(X, y_eta, sample_weight=weights)
```
Atau gunakan SMOTER (SMOTE untuk regresi) jika imbalance ekstrem (>1:10).

---

## 8. Inference & Deployment

### 8.1 Serialisasi

- Simpan dengan `joblib.dump(model, "m1_eta_v1.joblib")` ATAU `model.save_model("m1_eta_v1.json")` (XGBoost native)
- Load **sekali** saat service start, simpan di in-memory variable — **bukan per-request load**
- Versi model di-tag (`v1`, `v2`) supaya bisa rollback

### 8.2 Serving

```python
# FastAPI endpoint
@app.post("/predict/eta")
async def predict_eta(req: ETARequest) -> ETAResponse:
    features = feature_store.get(req.shipment_id)   # <50ms
    eta_pred = model.predict(features)              # <5ms
    risk_tier = apply_threshold(eta_pred, req.deadline)
    return ETAResponse(eta_minutes=eta_pred, risk_tier=risk_tier)
```

**Latency budget:** <50ms end-to-end (tree-based harus sangat cepat).

### 8.3 Feature Retrieval Pattern

```
Shipment request masuk
  → Cek feature_store cache (Redis)
    → HIT: pakai langsung
    → MISS: synchronous fetch untuk fitur statis (origin/dest/vehicle)
            + ambil hub_dwell_time dari M2 cache (jangan trigger M2 sync)
            + ambil weather dari BMKG cache (jangan call BMKG sync)
```

BMKG update 3-harian → cache 3-harian. HERE Traffic update ~15 menit → cache 15-menit. M2 update event-driven → subscribe ke queue state event.

### 8.4 Monitoring

- Log setiap `(features, prediction, actual_eta jika tersedia)` ke time-series DB (InfluxDB / Prometheus)
- Shadow mode: bandingkan prediksi vs actual selama 7 hari sebelum go-live
- **Drift trigger:** jika rolling-7-day MAE naik >20% dari baseline, trigger retraining pipeline (CI/CD)
- Alerting: dashboard Grafana, alert Slack tim ML jika drift terdeteksi

### 8.5 SHAP Integration (lihat M5)

- SHAP values **TIDAK** dihitung untuk semua shipment — mahal komputasi tanpa nilai bisnis
- Compute on-demand **hanya** untuk shipment yang di-flag WARNING/CRITICAL
- Lazy evaluation: dashboard request SHAP → trigger TreeExplainer → cache hasil 1 jam

---

## 9. Risiko & Mitigasi

| Risiko | Severity | Mitigasi |
|---|---|---|
| Data sintetis kurang representatif → model tidak generalisasi ke riil | Tinggi | Validasi dulu di Food Delivery Dataset (riil) sebelum pindah ke sintetis; dokumentasikan gap |
| Drift cepat karena pola traffic berubah | Sedang | Monitoring rolling MAE + retraining trigger |
| Threshold risk tidak match dengan ekspektasi operator Blibli | Sedang | Kalibrasi threshold bersama BA tim (Orwin) menggunakan confusion matrix |
| BMKG API down saat demo | Sedang | Cache 3-harian + fallback ke weather_severity_score=1 (munding default) |
| HERE quota habis | Sedang | Fallback derive dari is_peak_hour × OSM road class, didokumentasikan sebagai limitasi |
| Cross-model failure: M2 down → M1 kehilangan fitur penting | Tinggi | Feature store return default P50 dwell (median historis) kalau M2 unavailable, plus flag `m2_degraded=true` |

---

## 10. Roadmap (post-MVP)

| Fase | Upgrade |
|---|---|
| Production 3 bulan | NN-based ETA (TabNet / FT-Transformer) untuk benchmarking vs XGBoost |
| Production 6 bulan | Multi-task learning: prediksi ETA + P90 interval sekaligus |
| Production 12 bulan | Online learning dengan streaming data Blibli riil (kalau diizinkan) |

---

## 11. Acceptance Criteria (untuk demo kompetisi)

- [ ] MAE < 15 menit di test set sintetis Indonesia
- [ ] F1 CRITICAL ≥ 0.80
- [ ] Tabel baseline comparison ditampilkan di laporan
- [ ] Threshold risk di-load dari YAML (bukan hardcoded)
- [ ] Latency endpoint `/predict/eta` P95 < 50ms
- [ ] Drift monitoring aktif dengan alert
- [ ] SHAP on-demand berfungsi untuk shipment WARNING/CRITICAL
- [ ] Dokumen ini disertakan sebagai lampiran teknis

---

**Referensi internal:** M2 (hub dwell → feature), M5 (SHAP), M6 (confidence aggregation), M4 (reroute trigger dari CRITICAL).
