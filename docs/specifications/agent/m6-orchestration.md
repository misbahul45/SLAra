# Spesifikasi — M6 Deterministic Orchestration Core (`agent`)

- **Status:** Implemented (Phase 3)
- **Tanggal:** 2026-07-16
- **Rumah:** `services/agent/` (Hono + Node 22, TypeScript biasa)
- **Terkait:** [ADR-002](../../architecture/adr/ADR-002-m6-deterministic-core.md) (deterministic core) · [ADR-005](../../architecture/adr/ADR-005-conf-m1-v2.md) (conf_m1 v2) · [ADR-004](../../architecture/adr/ADR-004-m4-precomputed.md) (M4 precomputed) · `docs/contracts/rest/v1.md` §A · `services/agent/README.md`

> M6 **tidak memakai LLM di jalur keputusan** ([ADR-002](../../architecture/adr/ADR-002-m6-deterministic-core.md)).
> Rute dipilih dari Pareto set M4 + guardrail; confidence adalah aritmatika
> berbobot; threshold konstanta. Struktur node meniru desain LangGraph, tapi
> eksekusinya berurutan-deterministik di `src/orchestration/decide.ts`.

## 1. Urutan node

```
POST /api/v1/shipments/:id/decide
        │
        ▼
  ┌─ Node 1: M2 dwell ────────────  GET/POST ai /internal/m2/dwell  → dwell_p50, dwell_p90, conf_m2
  │      (gagal → degradasi: dwell fallback baked, conf_m2 = 0.5, lanjut)
  ▼
  ┌─ Node 2: M1 eta ──────────────  POST ai /internal/m1/eta
  │      inject dwell_p50 M2 → fitur ke-10 (hub_dwell_time_predicted)
  │      (gagal → FORCED ESCALATE, kritis)
  ▼
  ┌─ Node 3: M3 carbon ───────────  POST ai /internal/m3/carbon
  │      (gagal → co2 = null, lanjut; tidak masuk formula)
  ▼
  ┌─ Node 4: M4 routes ───────────  GET ai /internal/m4/routes?scenario=…
  │      (gagal → FORCED ESCALATE, kritis)
  │      selected = min-tier, lalu min tour_sla_risk, lalu min cost
  ▼
  ┌─ Node 5 (conditional): M5 ─────  POST ai /internal/m5/explain
  │      HANYA jika m1.risk_tier != SAFE
  │      (gagal → shap = null, confidence TIDAK berubah)
  ▼
  ┌─ Node 6: confidence ──────────  Σ(value × weight) → branch
  │      ≥ 0.70 → AUTO_EXECUTE
  │      < 0.70 → ESCALATE (+ primary_uncertainty_driver)
  ▼
  response (kontrak §A3)
```

Injeksi M2→M1 di Node 2 adalah **kontrak serving-time**: `hub_dwell_time_predicted`
di M1 dilatih dari fallback generator, bukan output M2. Integrasi terjadi di sini,
saat serving — bukan saat training (lihat catatan lintas-model di `claude.md`).

## 2. Formula confidence

```
confidence = 0.40·conf_m1 + 0.15·conf_m2 + 0.25·cs_m4 + 0.10·data_freshness + 0.10·audit_validity
```

Bobot berjumlah 1.0 (teruji `tests/confidence.test.ts`). Semua di
`src/config.ts`.

| Komponen | Bobot | Sumber nilai | Catatan |
|---|---|---|---|
| `conf_m1` | 0.40 | `interval_certainty × deadline_certainty` | v2, [ADR-005](../../architecture/adr/ADR-005-conf-m1-v2.md). Sub-term diekspos di `.detail` |
| `conf_m2` | 0.15 | `model_health × situational_certainty` | `situational = exp(−max(0, dwell_p90−45)/40)`; degradasi → 0.5 |
| `cs_m4` | 0.25 | `cs_m4` dari response M4 | composite score Pareto (0.996 skenario saat ini) |
| `data_freshness` | 0.10 | konstanta `0.92` | granularity telemetry 1 jam |
| `audit_validity` | 0.10 | `1.0` sehat / `0.5` | dari `/health`: m1.loaded ∧ m4.loaded ∧ m5.additivity_ok |

**Sub-term `conf_m1` (ADR-005):**
```
interval_certainty = 1 − min(1, (P90 − P50) / (2 · P50))
deadline_certainty = sigmoid(slack_p90 / 30)        slack_p90 = deadline − eta_p90
conf_m1            = clamp(interval_certainty × deadline_certainty)
```

**`primary_uncertainty_driver`** (hanya saat ESCALATE): komponen dengan kontribusi
tertimbang paling hilang = `weight × (1 − value)` terbesar. Kalau `conf_m1` yang
terlemah, dibedakan lagi: `deadline_pressure` (deadline_certainty < interval_certainty)
atau `wide_eta_interval`.

## 3. Threshold & guardrail

- Threshold **0.70** (`CONFIG.threshold`). ≥ → AUTO_EXECUTE, < → ESCALATE.
- Guardrail escalation rate: **5–20%** sehat. Verifikasi 12 shipment: **2/12 =
  16.7%** ✓.

## 4. Failure cascade

| Model gagal | Efek | Alasan |
|---|---|---|
| **M1** | FORCED ESCALATE (`confidence=0`, breakdown=null, driver=`critical_model_unavailable`) | ETA & tier adalah inti keputusan |
| **M4** | FORCED ESCALATE | tanpa rute tak ada yang bisa dieksekusi |
| **M2** | Degradasi: dwell fallback baked (12.0/21.6), `conf_m2=0.5`, `dwell_source=fallback` | M2 down = degradasi anggun, bukan outage |
| **M3** | `eta.co2_kg = null`, lanjut | carbon tidak masuk formula confidence |
| **M5** | `shap_top5 = null`, confidence TIDAK berubah | explainability additive, bukan penentu |

Kolom `degraded[]` di response mencatat model yang terdegradasi (null kalau semua
sehat).

## 5. Pemetaan response → kontrak / UI

Kontrak §A3 (`docs/contracts/rest/v1.md`). Pemetaan ke elemen UI Phase 4 ada di
`services/agent/README.md` section "Pemetaan response /decide → UI" dan
`docs/specifications/app/dashboard.md`.

| Field response | Isi |
|---|---|
| `decision` | `AUTO_EXECUTE` \| `ESCALATE` |
| `confidence`, `threshold` | skor agregat + 0.70 |
| `confidence_breakdown` | 5 komponen `{value, weight, label, detail?}`; null saat forced-escalate |
| `primary_uncertainty_driver` | null saat AUTO_EXECUTE |
| `eta` | `{p50_min, p90_min, risk_tier, slack_p90_min, co2_kg, dwell_source}`; null saat M1 down |
| `hub` | `{hub_id, dwell_p50_min, dwell_p90_min, queue, dwell_above_threshold}`; null saat M2 degraded |
| `routes[]` + `selected_route_id` | metrik **level-plan** tur M4, bukan per-shipment |
| `shap_top5` | 5 item saat non-SAFE; null saat SAFE |
| `explanation` | kalimat human-readable |
| `degraded` | daftar model terdegradasi \| null |
| `latency_ms` | latency M6 end-to-end (ukur agent) |

## 6. Verifikasi (2026-07-16, host)

| Skenario | decision | confidence | driver | shap | latency |
|---|---|---|---|---|---|
| SHP-2026-00400 | AUTO_EXECUTE | **0.864** | — | null | ~40 ms |
| SHP-2026-00403 | ESCALATE | **0.686** | `deadline_pressure` | 5 item | ~400 ms (jalur SHAP) |

- Σ(value × weight) == confidence **PERSIS** di kedua skenario.
- Escalation rate 12 shipment: **2/12 = 16.7%** (band 5–20% ✓).
- Unit test `tests/confidence.test.ts`: **6 pass, 0 fail**.
