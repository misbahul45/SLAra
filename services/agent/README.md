# SLAra Agent Service (services/agent) — M6 Orchestration Core

Hono + Node 22, plain TS dengan struktur node LangGraph (ADR-002). Deterministic: LLM tidak pernah memutuskan rute.

## Jalankan
```bash
cd services/agent
npm i          # atau pnpm i (sesuaikan workspace)
AI_BASE_URL=http://localhost:8000 npm start    # tsx src/index.ts, port 3000
npm test       # 6 unit test formula confidence + cascade
```
Prasyarat: `ai` service (FastAPI) sudah UP — startup ai ~30s (SHAP init).

## Endpoint (kontrak §A)
| Endpoint | Catatan |
|---|---|
| `GET /api/v1/shipments` | 12 shipment Jabodetabek; **eta/tier di-enrich live** dari M2→M1→M3 saat call pertama |
| `GET /api/v1/kpi/summary` | agregat tier + auto-execute rate dari state |
| `POST /api/v1/shipments/:id/decide` | pipeline penuh M2→M1(inject dwell)→M3→M4→[M5 jika non-SAFE]→confidence→branch |
| `POST /api/v1/shipments/:id/resolve` | `{action: APPROVE\|REJECT, route_id?}` |
| `GET /health` | — |

## Hasil verifikasi E2E (15 Jul, sandbox)
- Escalation rate **2/12 = 16.7%** (band 5–20% ✓) — SHP-00403 & SHP-00408 (hub congested)
- **Σ(value×weight) == confidence EXACT 12/12** (agregat dari nilai yang tampil — juri bisa verifikasi dari layar)
- Latency /decide: p50 34ms · max 293ms (SHAP path) — jauh di bawah budget 3s
- Dua path kanonik: **SHP-2026-00400 → AUTO_EXECUTE (0.864)** · **SHP-2026-00403 → ESCALATE (0.686, driver `deadline_pressure`, SHAP top-5 terisi)**

## ADR-005 (WAJIB dibaca sebelum QnA): conf_m1 v2
Formula desain lama `conf_m1 = 1−min(1,(P90−P50)/(2·ETA))` interval-only → nilai macet ~0.9
berapapun risikonya → eskalasi tak pernah terpicu (melanggar guardrail band 5–20%).
Kalibrasi v2: `conf_m1 = interval_certainty × deadline_certainty`, deadline_certainty = σ(slack_p90/30).
Kedua sub-term DIEKSPOS di `confidence_breakdown.conf_m1.detail` — transparan, bukan black-box.
Analog: `conf_m2 = model_health × exp(−max(0, dwell_p90−45)/40)` (toleransi dwell operasional 45m).
Konstanta di `src/config.ts`. Failure cascade: M1/M4 gagal → forced ESCALATE; M2 → degradasi
(conf_m2=0.5, fallback dwell); M3 → co2 null; M5 → shap null tanpa efek confidence. Teruji unit test.

## Pemetaan response /decide → UI (Phase 4)
| Field | Elemen UI |
|---|---|
| `confidence`, `threshold`, `confidence_breakdown` (5 bar + `detail` sub-term) | Confidence panel + gauge |
| `eta` {p50,p90,tier,slack,co2,dwell_source} | Headline ETA band + tier badge shipment |
| `hub` {dwell_p50/p90, queue, dwell_above_threshold} | Panel hub / Live Fleet sidebar |
| `routes[]` (eta tur, late_share, tier, cost, co2, geometry) + `selected_route_id` | Pareto Plan Comparison + peta |
| `shap_top5` (null utk SAFE) | SHAP bar chart |
| `primary_uncertainty_driver`, `explanation` | Escalation banner |
| `latency_ms` | Latency badge |
CATATAN semantik: `routes[]` = metrik LEVEL-PLAN (tur skenario M4), bukan per-shipment —
persis desain Figma "Pareto Plan Comparison". Risiko live per-shipment ada di blok `eta`.
