# M5 — Explainability Layer (SHAP)

> **Model ID:** M5
> **Jenis:** Post-hoc interpretability di atas M1 (dan opsional M2)
> **Prioritas:** P2
> **Owner ML:** SLAra AI — Agent Engineer
> **Status desain:** Final — on-demand TreeExplainer, lazy evaluation

---

## 1. Ringkasan Eksekutif

M5 bukan model terpisah, melainkan **lapisan interpretability post-hoc** yang dipasang di atas M1 (ETA Prediction) — dan opsional M2 (Hub Congestion). M5 menggunakan **SHAP (SHapley Additive exPlanations)** untuk mengkuantifikasi kontribusi setiap fitur terhadap prediksi individual. Tanpa M5, M1 adalah black-box: operator Blibli tidak tahu **mengapa** suatu shipment di-flag CRITICAL. Dengan M5, operator dapat melihat: "ETA telat karena congestion_index +0.31, weather_severity +0.18, traffic_index +0.12" — dan mengambil tindakan spesifik.

Muncul di dashboard kalian (Figure 3, "SHAP Feature Importance") — desain eksplisit M5 diperlukan karena tanpa spesifikasi, ini bisa menjadi angka karangan saat demo. M5 memastikan SHAP values dihitung dari library standar (`shap` package), pada shipment yang tepat (hanya WARNING/CRITICAL), dengan performance budget yang dapat dipertahankan.

---

## 2. Pilihan Algoritma — TreeExplainer

### 2.1 Mengapa TreeExplainer (Bukan KernelExplainer)

| Explainer | Kompatibilitas | Speed | Pilihan |
|---|---|---|---|
| **TreeExplainer** | XGBoost, LightGBM, RandomForest, sklearn tree-based | Sangat cepat (exact Shapley untuk tree) | ✅ Pilihan M5 |
| KernelExplainer | Model-agnostic (neural net, sklearn non-tree) | Lambat (sampling-based) | ❌ Tidak dipakai |
| DeepExplainer | TensorFlow / PyTorch NN | Cepat untuk NN | ❌ Tidak dipakai (M1 bukan NN) |
| GradientExplainer | NN dengan gradient access | Cepat untuk NN | ❌ Tidak dipakai |

**TreeExplainer** dipilih karena M1 (XGBoost) dan M2 (LightGBM) sama-sama tree-based — native support, exact computation (bukan approximation), kompleksitas polinomial bukan eksponensial.

### 2.2 Implementasi Reference

```python
import shap

# Load model M1 (XGBoost)
model_m1 = joblib.load("m1_eta_v1.joblib")

# Buat explainer (di-load sekali saat service start, bukan per-request)
explainer_m1 = shap.TreeExplainer(model_m1)

# Saat shipment di-flag WARNING/CRITICAL
def explain_prediction(features_df):
    shap_values = explainer_m1.shap_values(features_df)  # shape: (1, n_features)
    return shap_values
```

TreeExplainer di-load sekali di service start (~2 detik warmup). Setelah itu, per-call ~10-50ms untuk satu shipment.

### 2.3 Output Schema

```json
{
  "shipment_id": "SHP-2026-000123",
  "predicted_eta_minutes": 145.2,
  "risk_tier": "WARNING",
  "shap_explanation": {
    "base_value": 78.5,
    "prediction": 145.2,
    "top_features": [
      {"feature": "congestion_index", "value": 0.82, "shap_value": +0.31, "direction": "increases ETA"},
      {"feature": "weather_severity_score", "value": 3, "shap_value": +0.18, "direction": "increases ETA"},
      {"feature": "traffic_index", "value": 0.75, "shap_value": +0.12, "direction": "increases ETA"},
      {"feature": "actual_route_distance_km", "value": 38.5, "shap_value": +0.08, "direction": "increases ETA"},
      {"feature": "hour_of_day_cos", "value": -0.5, "shap_value": -0.04, "direction": "decreases ETA"}
    ],
    "model_version": "m1_v1",
    "explainer_version": "shap_v0.44"
  }
}
```

`base_value` adalah nilai prediksi rata-rata dataset training (E[f(x)]), dan jumlah `base_value + Σ shap_values = prediction` — ini properti fundamental SHAP yang harus diverifikasi setiap kali M5 dipanggil.

---

## 3. Kapan M5 Dipanggil — On-Demand Only

### 3.1 Prinsip Lazy Evaluation

SHAP values **TIDAK** dihitung untuk semua shipment. Alasan:

| Skenario | Compute SHAP? | Alasan |
|---|---|---|
| Shipment SAFE | ❌ Tidak | Tidak ada keputusan operator yang harus diambil |
| Shipment WARNING | ✅ Ya, on-demand | Operator butuh konteks untuk monitor |
| Shipment CRITICAL | ✅ Ya, on-demand + push notification | Operator butuh konteks untuk intervensi |
| Batch monitoring (semua shipment) | ❌ Tidak | Terlalu mahal komputasi; pakai global feature importance saja |

Sesuai desain dashboard kalian: "deep analyze only for affected trucks" — prinsip ini benar dan dipertahankan.

### 3.2 Trigger Points

M5 dipanggil ketika:

1. **M1 mengembalikan risk_tier WARNING/CRITICAL** — M1 memanggil M5 secara internal, lalu menyertakan `shap_explanation` di response
2. **Dashboard operator click "Explain" pada shipment tertentu** — explicit user-triggered, bahkan untuk shipment SAFE (untuk debugging)
3. **Batch analysis terjadwal** (mingguan) — untuk top-100 shipment paling sering CRITICAL, compute SHAP untuk analisis root cause aggregate

### 3.3 Cost Justification

| Operasi | Cost per call | Budget |
|---|---|---|
| TreeExplainer single-instance | 10-50ms | Bisa sinkron di request M1 |
| KernelExplainer single-instance (alternatif) | 1-5 detik | Terlalu lambat untuk sinkron |
| TreeExplainer batch 1000 instance | 1-3 detik | Background job only |

Karena TreeExplainer cepat, M5 dapat dipanggil sinkron di request M1 untuk shipment WARNING/CRITICAL tanpa melanggar latency budget M1 (<50ms). Untuk batch analysis, jalankan di background worker.

---

## 4. Output Format — Top-5 Feature Contribution

### 4.1 Mengapa Top-5

Mockup dashboard kalian ("congestion_index +0.31, weather_severity +0.18, traffic_index +0.12") menunjukkan 3 fitur. Saya rekomendasikan **top-5** untuk fleksibilitas:

- Top-3 terlalu sedikit — bisa miss fitur penting yang kalah tipis
- Top-10 terlalu banyak — kognitif overload untuk operator
- Top-5 sweet spot — operator dapat lihat pola tanpa overwhelm

### 4.2 Urutan Tampilan

```
Top-5 SHAP Contribution untuk shipment SHP-2026-000123 (WARNING):

  🔴 congestion_index          +0.31  →  ETA +31 menit
  🟠 weather_severity_score    +0.18  →  ETA +18 menit
  🟡 traffic_index             +0.12  →  ETA +12 menit
  🟢 actual_route_distance_km  +0.08  →  ETA +8 menit
  🔵 hour_of_day_cos           -0.04  →  ETA -4 menit
  ─────────────────────────────────
  Base value: 78 menit (rata-rata historis)
  Final prediction: 145 menit (WARNING)
```

Konversi shap_value ke "menit" dilakukan dengan mengalikan shap_value dengan range output (karena SHAP untuk regressor dalam unit target variable). Ini membuat angka langsung dapat dipahami operator.

### 4.3 Visualisasi Tambahan — Force Plot

Untuk dashboard drill-down (operator click "Details"), tampilkan SHAP force plot:

```
Base value 78 ──[+31 congestion]──[+18 weather]──[+12 traffic]──[+8 distance]──[−4 hour]──> 145 ETA
```

Force plot memberikan visual yang lebih intuitif daripada tabel untuk operator non-teknis. Library `shap` punya implementasi siap pakai: `shap.force_plot(explainer.expected_value, shap_values, features)`.

---

## 5. Integrasi dengan M1

### 5.1 Flow M1 + M5

```
Shipment request masuk → M1.predict_eta(features)
  → risk_tier = apply_threshold(eta, deadline)
  → if risk_tier in [WARNING, CRITICAL]:
      shap_values = M5.explain(features)   # internal call, sinkron
      return ETA + risk_tier + shap_explanation
  → else:
      return ETA + risk_tier (tanpa shap)
```

### 5.2 Performance Impact di M1

| Komponen | Latency tanpa M5 | Latency dengan M5 (WARNING/CRITICAL) |
|---|---|---|
| Feature retrieval | ~30ms | ~30ms |
| M1 inference | ~5ms | ~5ms |
| Threshold rule | <1ms | <1ms |
| M5 SHAP compute | — | +10-50ms |
| **Total** | **~35ms** | **~45-85ms** |

Untuk shipment SAFE, latency tetap ~35ms (M5 skip). Untuk WARNING/CRITICAL, latency naik menjadi ~45-85ms — masih dalam budget M1 <50ms untuk WARNING, sedikit over untuk CRITICAL (acceptable karena CRITICAL jarang terjadi dan operator OK dengan latency sedikit lebih tinggi untuk konteks tambahan).

### 5.3 Caching SHAP Results

```
Cache key: m5:shap:{shipment_id}:{model_version}
TTL: 1 jam (sampai fitur shipment berubah signifikan)
Invalidate: shipment status change OR new M1 prediction
```

Untuk shipment yang sama di-query berulang oleh dashboard, cache hit → <5ms.

---

## 6. Integrasi dengan M2 (Opsional)

### 6.1 SHAP untuk Dwell Time Prediction

M5 dapat juga menjelaskan prediksi M2 (dwell time per hub). Karena M2 juga LightGBM (tree-based), TreeExplainer dapat dipakai dengan pola yang sama.

### 6.2 Output Schema M2-SHAP

```json
{
  "hub_id": "HUB-CGK-01",
  "predicted_dwell_p50": 38.5,
  "predicted_dwell_p90": 52.0,
  "shap_explanation_p50": {
    "top_features": [
      {"feature": "queue_length_current", "value": 14, "shap_value": +8.2},
      {"feature": "dock_utilization_pct", "value": 0.92, "shap_value": +5.1},
      {"feature": "is_peak_hour", "value": 1, "shap_value": +3.4},
      {"feature": "weather_severity_score", "value": 2, "shap_value": +1.8},
      {"feature": "dwell_lag_1h", "value": 32, "shap_value": +1.2}
    ]
  }
}
```

### 6.3 Kapan M5-M2 Dipanggil

Sama dengan M1 — on-demand only:
- Saat dwell P90 > threshold (e.g., > 60 menit) → SHAP untuk membantu operator diagnosa penyebab kemacetan
- Saat operator click "Explain" di hub monitoring dashboard

---

## 7. Performance Budget

### 7.1 Latency Budget M5

| Operasi | Target | Catatan |
|---|---|---|
| Single-instance TreeExplainer (M1) | <50ms | Sinkron di request M1 untuk WARNING/CRITICAL |
| Single-instance TreeExplainer (M2) | <50ms | On-demand, async |
| Batch 1000 instances | <5 detik | Background job, untuk analisis mingguan |
| Force plot render di dashboard | <200ms | Client-side, library shap.js |

### 7.2 Memory Budget

TreeExplainer menyimpan tree structure di memory. Untuk M1 dengan 800 pohon:
- Memory footprint: ~50-100MB per explainer instance
- M1 + M2 = ~200MB total
- Acceptable untuk server dengan 4GB+ RAM

### 7.3 CPU Budget

SHAP computation TreeExplainer adalah CPU-bound. Untuk mencegah blocking di request handler:
- M1 SHAP compute: sinkron (cepat, <50ms)
- M2 SHAP compute: async via thread pool (tidak block M1)
- Batch SHAP: background worker dengan Celery/RQ

---

## 8. Validasi & Trust

### 8.1 Additivity Check

Properti fundamental SHAP: `base_value + Σ shap_values = prediction`. Setiap M5 deployment harus melewati additivity check:

```python
def validate_additivity(explainer, features_df, model):
    shap_values = explainer.shap_values(features_df)
    base_value = explainer.expected_value
    pred_from_shap = base_value + shap_values.sum(axis=1)
    pred_from_model = model.predict(features_df)
    assert np.allclose(pred_from_shap, pred_from_model, atol=1e-4)
```

Jika gagal, ada bug di explainer atau model — jangan deploy M5.

### 8.2 Sanity Check di Sample

Manual verify top-5 feature di 10 shipment sampel:
- Apakah kontribusi masuk akal bisnis? (e.g., congestion_index tinggi → +shap_value positif)
- Apakah ada fitur dengan shap_value konstan tinggi? (pertanda fitur tidak variatif, bisa di-drop)
- Apakah ada interaksi tak terduga? (analisis dengan shap.interaction_values untuk subset)

### 8.3 Auditability untuk Juri

M5 output dapat ditelusuri:
- `model_version` M1 → tree structure yang dapat di-load
- `explainer_version` shap → versi library yang dapat direproduce
- `base_value` → rata-rata prediksi di training set (dapat diverifikasi)

Ini memenuhi prinsip "auditability" yang kalian klaim di proposal — tidak ada angka yang tidak dapat ditelusuri.

---

## 9. Risiko & Mitigasi

| Risiko | Severity | Mitigasi |
|---|---|---|
| SHAP computation memperlambat M1 untuk shipment WARNING/CRITICAL | Sedang | TreeExplainer cepat (<50ms); untuk batch, pakai background worker |
| SHAP values salah interpretasi oleh operator | Tinggi | Visualisasi jelas (force plot) + dokumentasi "cara baca SHAP" di dashboard help |
| Feature importance global vs lokal berbeda → operator bingung | Sedang | Selalu label "local explanation for this shipment" di UI |
| TreeExplainer memory bengkak dengan model besar | Sedang | Load explainer sekali di service start, share across request |
| shap library update breaking change | Sedang | Pin versi shap di requirements.txt (`shap==0.44.x`); test additivity di CI |
| Operator kelewat informasi karena top-5 cutoff | Sedang | Sediakan "show all features" toggle untuk user power |

---

## 10. Roadmap (post-MVP)

| Fase | Upgrade |
|---|---|
| Production 3 bulan | SHAP interaction values untuk analisis pairwise feature interaction |
| Production 6 bulan | Counterfactual explanations: "apa yang harus diubah agar shipment tidak CRITICAL?" (e.g., "kalau departure di-delay 30 menit, risk turun ke WARNING") |
| Production 12 bulan | Natural language explanation via LLM: konversi SHAP top-5 ke kalimat ("Shipment ini diperkirakan telat karena kemacetan tinggi di rute + cuaca buruk + jam sibuk") |
| Production 18 bulan | Per-feature what-if analysis di dashboard (slider congestion_index → lihat prediksi ETA update real-time) |

---

## 11. Acceptance Criteria (untuk demo kompetisi)

- [ ] TreeExplainer (bukan KernelExplainer) digunakan untuk M1 dan M2
- [ ] SHAP hanya dihitung untuk shipment WARNING/CRITICAL (lazy evaluation terverifikasi)
- [ ] Output top-5 feature contribution ditampilkan di dashboard sesuai schema §2.3
- [ ] Additivity check lulus di CI (base_value + Σ shap = prediction)
- [ ] Latency M1 + M5 sinkron untuk WARNING/CRITICAL tetap <100ms
- [ ] Force plot render di dashboard drill-down
- [ ] Caching SHAP results aktif (Redis)
- [ ] Model version + explainer version dilog untuk reproducibility
- [ ] Dokumentasi "cara baca SHAP" tersedia di dashboard help

---

**Referensi internal:** M1 (consumer — SHAP di atas M1), M2 (opsional consumer), Dashboard (force plot + top-5 list), M6 (SHAP explanation dapat dilampirkan ke human-in-the-loop escalation message).
