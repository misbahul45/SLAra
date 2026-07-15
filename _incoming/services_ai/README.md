# SLAra AI Service (services/ai) — Serving M1–M5

FastAPI + uv. Semua model di-load sekali saat startup (lifespan). Startup ~25–30s (SHAP TreeExplainer init di model 2000-tree) — normal, jangan panik.

## Jalankan
```bash
cd services/ai
uv sync                                   # atau: pip install -e .
uv run uvicorn app.main:app --port 8000
# tunggu log "Startup selesai", lalu: curl localhost:8000/health
```
Test: `uv run pytest tests/ -q` (golden test M1 — 3 skenario identik m1_v2_inference.py + additivity M5).

## ⚠️ WAJIB: drop artifacts M2 dari Colab
Service jalan TANPA M2 (mode DEGRADED: historical median, confidence 0.5, `m2_degraded: true`) —
sesuai failure-cascade design. Untuk FULL mode, taruh dari notebook M2:
```
models/m2/m2_dwell_p50.txt        configs/m2/hub_target_encoding.yaml
models/m2/m2_dwell_p90.txt        configs/m2/hub_historical_median.yaml
                                  configs/m2/coverage_confidence.yaml
```
Restart → log "M2 loaded" + /health `m2.mode: FULL`. Verifikasi: `condition: congested` harus
menghasilkan dwell > `normal` (di DEGRADED keduanya sama — itu cara bedainnya).

## Endpoint (kontrak docs/contracts/rest/v1.md §B)
| Endpoint | Model | Catatan |
|---|---|---|
| `POST /internal/m1/eta` | M1 v2 | dual quantile + conformal δ + tier + **conf_m1** · warm P95 ~3ms |
| `POST /internal/m2/dwell` | M2 | body `{hub_id, condition: normal\|congested, overrides?}` · telemetry dari `data/hub_telemetry.json` · **model_confidence = conf_m2** |
| `POST /internal/m3/carbon` | M3 | rule GLEC/ISO-14083-aligned, EF: MC .029 / VAN .18 / CDE .32 / CDD .45 kg/km |
| `GET /internal/m4/routes?scenario=jabodetabek_urban_sameday` | M4 | precomputed Pareto (ADR-004) + **cs_m4** + convergence series + stop_arrivals |
| `POST /internal/m5/explain` | M5 | TreeExplainer di **M1 P90** (tier ditentukan P90) · fitur = request M1 · lazy: panggil hanya utk WARNING/CRITICAL (kebijakan di M6) · first call ~230ms |
| `GET /health` | — | status semua model + additivity M5 |

## Keputusan teknis (bahan docs/specifications/ai/serving.md)
1. **M5 menjelaskan P90**, bukan P50 — risk tier & slack ditentukan P90; "kenapa berisiko" == "kenapa P90 besar". Prediksi yang dijelaskan = model mentah (tanpa δ konformal; offset konstan tak mengubah atribusi).
2. **M2 degraded-tolerant, M1/M4 fail-fast** — sesuai failure cascade (M1/M4 down = KRITIS, M2 down = degradasi anggun).
3. hour_sin/cos digabung jadi satu fitur tampilan `hour_of_day` di output SHAP.
4. `hub_dwell_time_predicted` di M1 diisi `dwell_p50_minutes` dari M2 **oleh M6/agent** (serving-time link M2→M1). Kalimat video: "designed to consume M2 dwell predictions at serving time".
5. Semua response bawa `latency_ms` + header `X-Latency-Ms`.
