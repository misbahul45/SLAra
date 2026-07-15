# M2 Artifacts — Hub Dwell Forecast (reproduced 15 Jul 2026)

Reproduksi penuh dari notebook M2 temen (M2_Hub_Congestion_Dwell_Forecast.ipynb):
simulator M/M/c VERBATIM (seed 42 → 49.625 shipment, identik run asli), FE direkonstruksi
dari spec FASE 4 (cell kode asli hilang di export ipynb), hyperparams = best Optuna notebook.

## Validasi vs run asli temen
| Metrik | Run asli | Reproduksi |
|---|---|---|
| Coverage P90 | 89.6% | **89.74%** ✓ band 88–92 |
| Pinball P50 | 3.58 | **3.578** |
| Global model_confidence | 0.9979 | **0.9974** |

## Isi & penempatan (kalau dipasang manual)
- `models/m2_dwell_p50.txt`, `m2_dwell_p90.txt` → `services/ai/models/m2/`
- `configs/*.yaml` (target_encoding, historical_median, coverage_confidence, model_config) → `services/ai/configs/m2/`
- Format yaml: `per_hub` + `global` (format FASE 14 notebook) — loader serving sudah di-patch utk ini.

CATATAN: services_ai.zip terbaru SUDAH berisi semua file ini + patch loader → gak perlu pasang manual.
