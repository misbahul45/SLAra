# Spec — `ai` service serving layer (M1, M2, M3, M5)

- **Status:** Implemented · diverifikasi 15 Jul 2026 (host, bukan container)
- **Kode:** `services/ai/` · **Kontrak:** [`../../contracts/rest/v1.md`](../../contracts/rest/v1.md) §B-bis
- **Terkait:** [M4 spec](m4-route-optimization.md) · [ADR-004](../../architecture/adr/ADR-004-m4-precomputed.md) · [integration log](../../progress/ai/integration-log.md)

## 1. Tanggung jawab

`ai` adalah **penyaji model**, bukan pengambil keputusan. Ia mengeksekusi M1/M2/M3/M5 dan menyerahkan
Pareto M4 yang sudah dihitung. Semua kebijakan — kapan memanggil M5, bagaimana merakit confidence,
kapan auto-execute — ada di **M6 (`agent`)**, lihat [ADR-002](../../architecture/adr/ADR-002-m6-deterministic-core.md).

Batas ini yang membuat `ai` bisa di-golden-test: input sama → output sama, tanpa kebijakan tersembunyi.

## 2. Endpoint

| Endpoint | Model | Catatan |
|---|---|---|
| `POST /internal/m1/eta` | M1 v2 | dual quantile + conformal δ + tier + **`conf_m1`** · warm P95 ~3 ms |
| `POST /internal/m2/dwell` | M2 | body `{hub_id, condition: normal\|congested, overrides?}` · telemetry dari `data/hub_telemetry.json` · **`model_confidence` = `conf_m2`** |
| `POST /internal/m3/carbon` | M3 | rule GLEC/ISO-14083-aligned · EF: MC .029 / VAN .18 / CDE .32 / CDD .45 kg/km |
| `GET /internal/m4/routes?scenario=jabodetabek_urban_sameday` | M4 | precomputed Pareto ([ADR-004](../../architecture/adr/ADR-004-m4-precomputed.md)) + **`cs_m4`** + convergence series + `stop_arrivals` |
| `POST /internal/m5/explain` | M5 | TreeExplainer di **M1 P90** · fitur = request M1 · lazy (kebijakan di M6) · first call ~230 ms |
| `GET /health` | — | status semua model + `m2.mode` + `m5.additivity_ok` |

Signature field lengkap: kontrak §B-bis. Semua response membawa `latency_ms`; semua HTTP response
membawa header `X-Latency-Ms`.

## 3. Keputusan teknis

### 3.1 M5 menjelaskan **P90**, bukan P50
Risk tier dan slack ditentukan oleh **P90** (`slack = deadline − p90`). Jadi pertanyaan "kenapa
shipment ini berisiko" secara harfiah adalah "kenapa **P90**-nya besar". Menjelaskan P50 akan
menjawab pertanyaan yang tidak seorang pun ajukan.

Yang di-explain adalah **prediksi model mentah** — tanpa offset konformal δ. Alasannya bukan
kepraktisan: δ adalah **offset konstan** (+0.83 menit), dan konstanta tidak mengubah atribusi SHAP
sama sekali. Menambahkannya hanya menggeser `base_value` tanpa mengubah satu pun ranking fitur.

Additivity di-cek saat startup (`base + Σshap ≈ prediksi`, toleransi 1e-3) dan **fail-fast** kalau
tidak lolos — penjelasan yang tidak additive adalah penjelasan yang salah, lebih buruk daripada
tidak ada penjelasan.

### 3.2 M2 degraded-tolerant; M1 & M4 fail-fast
Langsung mengikuti failure cascade design:

| Model | Kebijakan | Alasan |
|---|---|---|
| **M1** | fail-fast (`RuntimeError` saat startup) | tanpa ETA, `/decide` tidak bermakna — tier & slack mustahil |
| **M4** | fail-fast | tanpa Pareto set, tidak ada rute untuk diputuskan |
| **M2** | **degraded-tolerant** | M2 down = degradasi anggun, bukan outage |

Mode DEGRADED M2 (model hilang): `p50 = historical median` hub, `p90 = median × 1.8`,
`model_confidence = 0.50`, `m2_degraded = true`. Sistem tetap jalan; confidence M6 turun sendirinya
karena `conf_m2` berbobot 0.15 — **degradasi mengalir ke keputusan tanpa kode khusus**.

> **Cara membedakan FULL vs DEGRADED tanpa lihat log:** di DEGRADED, `condition: normal` dan
> `congested` menghasilkan angka **identik** (keduanya jatuh ke historical median, `condition`
> diabaikan). Di FULL, congested harus **lebih tinggi**. Lihat §5.

### 3.3 `hour_sin`/`hour_cos` digabung jadi satu fitur tampilan
Model memakai encoding siklik (dua kolom). Output SHAP menjumlahkan kontribusi keduanya menjadi satu
label **`hour_of_day`**. Operator tidak boleh disuruh menafsirkan "kontribusi hour_cos" — itu artefak
representasi, bukan konsep bisnis. Penjumlahan ini aman secara matematis: SHAP additive, jadi
menjumlahkan dua fitur yang mewakili satu konsep tetap benar.

### 3.4 Link M2 → M1 terjadi di **serving time**, dilakukan M6
Fitur ke-10 M1 `hub_dwell_time_predicted` diisi `dwell_p50_minutes` dari M2 — **oleh M6/agent**,
bukan oleh `ai` service. Endpoint M1 menerima nilai itu sebagai input biasa.

**Caveat yang wajib jujur:** M1 dilatih dengan `hub_dwell_time_predicted` dari **fallback generator**,
bukan dari output M2. Integrasi M2→M1 adalah kontrak **serving-time**. Kalimat yang benar untuk video:
*"designed to consume M2 dwell predictions at serving time"* — bukan "dilatih di atas output M2".

### 3.5 Latency di setiap response
Semua endpoint mengembalikan `latency_ms`; middleware menambahkan header `X-Latency-Ms`. Anggaran
latency M6 ~2 s hanya bisa dijaga kalau tiap komponen bisa diukur sendiri-sendiri saat demo.

## 4. Artifacts & startup

```
services/ai/
├── models/m1/{m1_eta_v2_p50,m1_eta_v2_p90}.txt      # fail-fast
├── models/m2/{m2_dwell_p50,m2_dwell_p90}.txt        # degraded-tolerant
├── configs/m1/{risk_thresholds,model_config}.yaml   # fail-fast (thresholds)
├── configs/m2/{hub_target_encoding,hub_historical_median,coverage_confidence}.yaml
├── data/pareto_routes_jabodetabek_urban.json        # M4, fail-fast
└── data/hub_telemetry.json                          # mock telemetry 3 hub × 2 kondisi
```

Semua di-load **sekali** saat startup (lifespan singleton `app/core/artifacts.py`). **Startup ~25–37
detik** — didominasi init SHAP TreeExplainer di model 2000-tree. Ini normal, bukan hang.

> ⚠️ **`.dockerignore` mengecualikan `models/`** (by design: model di-mount sebagai volume, tidak
> di-bake ke image). Karena M1 fail-fast, container **mati saat startup** kalau compose tidak mount
> `./models`. Lihat [integration log](../../progress/ai/integration-log.md) §4.

## 5. Verifikasi (observasi nyata 15 Jul 2026)

```bash
cd services/ai
uv sync
uv run pytest tests/ -q                       # → 4 passed
uv run uvicorn app.main:app --port 8000       # tunggu "Startup selesai"
curl localhost:8000/health
```

Startup log yang benar: `Startup selesai. M5 additivity: PASS | M2 mode: FULL`

**Tes link M2 — `HUB-CGK-02`:**

| Kondisi | `dwell_p50_minutes` | `dwell_p90_minutes` | `m2_degraded` |
|---|---|---|---|
| `normal` | **16.09** | 34.07 | `false` |
| `congested` | **29.13** | 95.21 | `false` |

congested > normal (**+81%**) dan `m2_degraded: false` → M2 FULL terbukti.

## 6. Environment & versi

- **Python 3.12** (`requires-python = ">=3.12,<3.13"`). Bukan 3.14: `shap` → `numba`/`llvmlite`
  belum mendukungnya.
- **`numpy` dibatasi `<2.5`** — numba modern butuh `numpy<2.5`; tanpa batas ini resolver memilih
  numpy 2.5.1 lalu backtrack numba ke 0.53.1 (2021, tanpa wheel 3.12) dan build gagal. Rincian +
  cara reproduksi: [integration log](../../progress/ai/integration-log.md) §D3.
- Dependency ML **tidak** di-downgrade: `shap` 0.52.0, `lightgbm` 4.6.0.
