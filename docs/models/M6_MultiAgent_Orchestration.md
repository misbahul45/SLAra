# M6 — Multi-Agent Orchestration & Confidence Aggregation

> **Model ID:** M6
> **Jenis:** LangGraph orchestration + rule-based confidence scoring (BUKAN ML training)
> **Prioritas:** P1
> **Owner:** SLAra AI — Agent Engineer + BA (kalibrasi bobot confidence)
> **Status desain:** Final — formula confidence aggregation eksplisit, human-in-the-loop gate terdefinisi

---

## 1. Ringkasan Eksekutif

M6 adalah **otak orkestrasi** SLAra — bukan model ML, tapi sistem yang mengkoordinasikan M1–M5 menjadi pipeline end-to-end yang dapat dijelaskan. M6 menggunakan **LangGraph** untuk mengelola state graph 6 agent (Traffic, Delay/ETA, Carbon, Hub Risk, Route Optimizer, Decision) dengan conditional edge berbasis confidence.

Tugas inti M6 adalah menghasilkan **Aggregate Decision Confidence** — angka tunggal (0–1) yang mewakili seberapa yakin sistem terhadap keputusan akhirnya. Angka ini muncul di dashboard kalian ("Aggregate Decision Confidence 86%") dan **tidak boleh** menjadi angka yang di-hardcode manual saat demo. M6 mendefinisikan formula eksplisit untuk angka ini, dengan bobot yang dikalibrasi dan didokumentasikan sebagai asumsi bisnis — bukan black-box.

Output M6 adalah keputusan actionable: **auto-execute** (confidence tinggi) atau **escalate to human** (confidence rendah), dengan threshold yang sudah kalian tentukan di mockup (70% threshold).

---

## 2. Arsitektur LangGraph

### 2.1 Node Design — 6 Agent

```
┌─────────┐   ┌─────────┐   ┌─────────┐
│ Traffic │   │  ETA    │   │ Carbon  │
│ Agent   │   │  Agent  │   │ Agent   │
│ (M1-feat)│   │  (M1)   │   │  (M3)   │
└────┬────┘   └────┬────┘   └────┬────┘
     │              │              │
     └──────────────┼──────────────┘
                    ↓
            ┌──────────────┐
            │  Hub Risk    │
            │  Agent (M2)  │
            └──────┬───────┘
                   ↓
            ┌──────────────┐
            │ Route Opt    │
            │ Agent (M4)   │
            └──────┬───────┘
                   ↓
            ┌──────────────┐
            │ Decision     │
            │ Agent (M6-core)│
            └──────┬───────┘
                   ↓
        ┌──────────┴──────────┐
        ↓                     ↓
   auto-execute         escalate-to-human
   (conf ≥ 0.70)         (conf < 0.70)
```

### 2.2 Detail per Node

| Node | Model | Input | Output | Confidence component |
|---|---|---|---|---|
| Traffic Agent | Rule-based aggregator (HERE/Google/BMKG cache) | Origin, destination, timestamp | `traffic_index`, `weather_severity` | `w_traffic` × data_freshness |
| ETA Agent | M1 (XGBoost) | Features from Traffic + Hub + shipment | `eta_pred`, `risk_tier` | `w1` × model_confidence(M1) |
| Carbon Agent | M3 (rule-based) | Route, vehicle, load | `co2_kg`, `tce_breakdown` | `w_carbon` × audit_validity_score |
| Hub Risk Agent | M2 (LightGBM quantile) | Hub state, queue, time | `dwell_p50`, `dwell_p90` | `w2` × model_confidence(M2) |
| Route Opt Agent | M4 (NSGA-II) | All shipments, fleet | `pareto_front`, `selected_route` | `w3` × constraint_satisfaction(M4) |
| Decision Agent | Formula aggregation | All agent outputs | `decision`, `confidence_aggregate` | — (this node COMPUTES confidence, tidak punya confidence sendiri) |

### 2.3 Edge — Conditional Flow

```python
# LangGraph conditional edges
graph.add_conditional_edges(
    "decision_agent",
    lambda state: "auto_execute" if state.confidence >= 0.70 else "escalate_human",
    {
        "auto_execute": "execute_node",
        "escalate_human": "human_review_node",
    }
)
```

Edge lainnya adalah sequential (Traffic → ETA → Hub → Route → Decision), tapi beberapa dapat di-parallel:
- Traffic + Hub Risk dapat jalan paralel (tidak ada dependency)
- Carbon menunggu output Route (perlu distance & vehicle assignment)

### 2.4 State Schema

```python
from typing import TypedDict, List

class SLAraState(TypedDict):
    shipment_id: str
    shipment_features: dict
    traffic_index: float
    weather_severity: int
    eta_pred: float
    risk_tier: str
    dwell_p50: float
    dwell_p90: float
    co2_kg: float
    co2_tce_breakdown: List[dict]
    pareto_front: List[dict]
    selected_route: dict
    confidence_aggregate: float
    confidence_breakdown: dict
    decision: str  # "auto_execute" | "escalate_human"
    shap_explanation: dict  # from M5 jika WARNING/CRITICAL
    audit_trail_id: str
```

LangGraph mengelola state ini via checkpointing — setiap transisi node disimpan, sehingga pipeline dapat di-resume dari node terakhir sukses jika ada failure.

---

## 3. Confidence Aggregation Formula

### 3.1 Formula Utama

```
confidence_aggregate = w1 × model_confidence(M1)
                     + w2 × model_confidence(M2)
                     + w3 × constraint_satisfaction(M4)
                     + w_traffic × data_freshness(Traffic)
                     + w_carbon × audit_validity(Carbon)
```

Dimana bobot dinormalisasi: `Σ w_i = 1.0`.

### 3.2 Default Bobot (Kalibrasi Awal)

| Komponen | Bobot | Justifikasi |
|---|---|---|
| `w1` (M1 ETA) | 0.40 | Model inti, paling berpengaruh ke decision |
| `w2` (M2 Hub) | 0.15 | Penting tapi upstream dari M1 — dobel count jika bobot tinggi |
| `w3` (M4 Route) | 0.25 | Constraint satisfaction penting untuk feasibility |
| `w_traffic` (Traffic data) | 0.10 | Data freshness, bukan model — bobot lebih rendah |
| `w_carbon` (Carbon audit) | 0.10 | Rule-based, confidence tinggi by design |

**Catatan:** bobot di atas adalah **starting point**, bukan angka final. Kalibrasi awal dipimpin BA tim (Orwin) berdasarkan business judgment — lihat §4.

### 3.3 Definisi `model_confidence` per Komponen

#### 3.3.1 `model_confidence(M1)` — dari prediction interval

Karena M1 adalah regressor (bukan classifier dengan probabilitas), confidence didekati dari **prediction interval width**:

```
model_confidence(M1) = 1 - min(1, interval_width / (2 × expected_eta))
```

Dimana `interval_width` didapat dari:
- Quantile regression M1 (jika pakai LightGBM quantile di M1) — P90 − P50
- Atau: conformal prediction wrapper di atas M1 (lebih robust, tambahan komputasi minimal)

Implementasi sederhana: jika M1 punya prediksi P50=120, P90=145 → interval_width=25 → expected_eta=120 → `1 - min(1, 25/240)` = 1 - 0.104 = 0.896.

#### 3.3.2 `model_confidence(M2)` — dari quantile coverage historis

```
model_confidence(M2) = 1 - |coverage_P90_historical - 0.90|
```

Jika coverage P90 historis (7 hari rolling) = 0.88 → `1 - |0.88 - 0.90|` = 0.98. Jika coverage = 0.75 (under-predicting) → `1 - 0.15` = 0.85.

#### 3.3.3 `constraint_satisfaction(M4)` — dari feasibility Pareto front

```
constraint_satisfaction(M4) = n_feasible_solutions / n_total_solutions_in_pareto
```

Jika Pareto front punya 10 solusi, 9 di antaranya feasible (constraint terpenuhi) → 0.90. Jika hanya 5 feasible → 0.50 (sinyal kuat untuk escalate).

#### 3.3.4 `data_freshness(Traffic)`

```
data_freshness(Traffic) = max(0, 1 - (age_minutes / max_age_minutes))
```

- `max_age_minutes = 30` (BMKG cache 3-harian, HERE 15-menit — ambil yang lebih ketat untuk safety)
- Jika cache age 5 menit → freshness = 1 - 5/30 = 0.83
- Jika cache age 60 menit (stale) → freshness = max(0, 1 - 60/30) = 0

#### 3.3.5 `audit_validity(Carbon)`

```
audit_validity(Carbon) = 1.0 - deviation_from_reference
```

Jika audit trail M3 menunjukkan deviation 5% dari EPA/DEFRA → `1 - 0.05` = 0.95. Default 1.0 jika tidak ada audit terbaru.

### 3.4 Contoh Perhitungan End-to-End

```
Skenario:
- M1: P50=120, P90=145 → interval_width=25, expected=120
       model_confidence(M1) = 1 - min(1, 25/240) = 0.896
- M2: coverage P90 historis 0.88
       model_confidence(M2) = 1 - |0.88-0.90| = 0.98
- M4: Pareto front 10 solusi, 8 feasible
       constraint_satisfaction(M4) = 0.80
- Traffic: cache age 8 menit
       data_freshness = 1 - 8/30 = 0.73
- Carbon: audit deviation 4%
       audit_validity = 0.96

confidence_aggregate = 0.40 × 0.896
                     + 0.15 × 0.98
                     + 0.25 × 0.80
                     + 0.10 × 0.73
                     + 0.10 × 0.96
                     = 0.358 + 0.147 + 0.200 + 0.073 + 0.096
                     = 0.874 → 87.4%

Decision: 87.4% ≥ 70% → auto-execute
```

Angka ini dapat dilacak ke komponen-komponennya — tidak ada black-box.

---

## 4. Kalibrasi Bobot Confidence

### 4.1 Pendekatan — Manual dengan Business Judgment

Bobot `w1, w2, w3, w_traffic, w_carbon` **tidak** dioptimasi via ML (data tidak cukup untuk tuning data-driven di MVP). Sebagai gantinya, kalibrasi manual dipimpin BA (Orwin) berdasarkan:

1. **Domain expertise** — mana komponen yang paling kritikal untuk keputusan Blibli?
2. **Historical incident review** — kalau ada data logistik sebelumnya, komponen mana yang paling sering jadi root cause delay?
3. **Stakeholder interview** — apa yang paling dikhawatirkan operations manager?

### 4.2 Dokumentasi Asumsi

Setiap bobot harus didokumentasikan di `m6_confidence_config.yaml`:

```yaml
confidence_weights:
  w1_eta: 0.40
  w2_hub: 0.15
  w3_route: 0.25
  w_traffic: 0.10
  w_carbon: 0.10

assumptions:
  - "ETA adalah model inti → bobot tertinggi (0.40)"
  - "Hub adalah upstream ETA, dobel count jika bobot tinggi → 0.15"
  - "Route opt feasibility krusial untuk eksekusi → 0.25"
  - "Traffic & Carbon adalah support, bobot lebih rendah → 0.10 masing-masing"

calibration_method: "Manual judgment by BA (Orwin) + Agent Engineer, 2026-07-09"
last_calibrated: "2026-07-09"
```

File ini **dilampirkan di laporan teknis** — juri dapat melihat asumsi dan menanyakan alasannya. Lebih credible daripada angka tanpa justifikasi.

### 4.3 Sensitivity Analysis (Wajib)

Setelah kalibrasi, jalankan sensitivity analysis:
- Variasikan bobot ±10% dari nilai default
- Catat perubahan confidence_aggregate di 100 shipment sampel
- Jika >5% shipment berganti decision (auto→escalate atau sebaliknya) → bobot perlu re-kalibrasi

Sensitivity analysis dilampirkan di laporan sebagai bukti robustness.

### 4.4 Roadmap — Bayesian Weight Learning

Di production (12+ bulan), bobot dapat dioptimasi via Bayesian approach:
- Prior: distribusi bobot di sekitar nilai manual
- Likelihood: kalibrasi terhadap outcome (shipment yang sebelumnya di-escalate ternyata OK → naikkan threshold; shipment yang di-auto ternyata gagal → turunkan threshold)
- Posterior: bobot updated

Tidak untuk MVP — butuh data outcome historis yang tidak ada di fase kompetisi.

---

## 5. Human-in-the-Loop Escalation

### 5.1 Threshold

Sesuai mockup dashboard kalian: **confidence < 0.70 → escalate to human**.

```
if confidence_aggregate >= 0.70:
    decision = "auto_execute"
    # eksekusi reroute, push notification ke driver, dll.
else:
    decision = "escalate_human"
    # kirim ke dashboard human review dengan konteks lengkap
```

### 5.2 Escalation Message Schema

Saat escalate, M6 menyusun message untuk human reviewer:

```json
{
  "escalation_id": "ESC-2026-000456",
  "shipment_id": "SHP-2026-000123",
  "timestamp": "2026-07-09T08:30:00+07:00",
  "confidence_aggregate": 0.64,
  "confidence_breakdown": {
    "w1_eta": 0.40,
    "model_confidence_m1": 0.45,
    "w2_hub": 0.15,
    "model_confidence_m2": 0.60,
    "w3_route": 0.25,
    "constraint_satisfaction_m4": 0.50,
    "w_traffic": 0.10,
    "data_freshness": 0.80,
    "w_carbon": 0.10,
    "audit_validity": 0.95
  },
  "primary_uncertainty_driver": "model_confidence_m1 (0.45) — interval P50-P90 terlalu lebar",
  "recommendation": "ETA terlalu tidak pasti untuk auto-execute. Review manual disarankan: cek kondisi traffic real-time di rute ini, konfirmasi dengan driver jika perlu.",
  "shap_explanation": {
    "...": "top-5 SHAP dari M5 (jika WARNING/CRITICAL)"
  },
  "audit_trail_id": "AT-2026-001",
  "actions_available": [
    "approve_auto_execute",
    "modify_route_manual",
    "delay_shipment",
    "reject_decision"
  ]
}
```

Field `primary_uncertainty_driver` adalah **elemen kunci UX** — operator langsung tahu komponen mana yang menyebabkan confidence rendah, jadi tahu area apa yang perlu di-verify manual.

### 5.3 Operator Decision Loop

```
Escalation message masuk ke dashboard operator
  → Operator review konteks (SHAP, audit trail, confidence breakdown)
  → Operator pilih action:
      approve_auto_execute → sistem eksekusi rekomendasi M4
      modify_route_manual  → operator override rute, sistem eksekusi
      delay_shipment       → sistem update deadline, re-run M1
      reject_decision      → shipment di-flag untuk follow-up, tidak dieksekusi
  → Operator decision dilog sebagai feedback untuk kalibrasi bobot (§4.4)
```

### 5.4 Alert Fatigue Mitigation

Jika escalation terlalu sering (>30% shipment), operator akan lelah dan mengabaikan alert. Mitigasi:
- Monitor escalation rate per hari (alert ke tim ML jika >30%)
- Jika escalation rate tinggi persisten, threshold 0.70 mungkin perlu diturunkan ke 0.65 — tapi dokumentasikan perubahan dengan alasan
- Sediakan "quick approve" button untuk escalation yang berulang pola sama (operator approve dengan 1 klik)

---

## 6. Latency Budget

### 6.1 Budget End-to-End (untuk P95 < 3s dashboard)

| Tahap | Target Latency | Catatan |
|---|---|---|
| Feature retrieval (cache BMKG, traffic, queue state) | <50ms | Jangan sinkron call API eksternal per-request |
| M1 (ETA inference) | <50ms | Tree-based, harus sangat cepat |
| M2 (Hub congestion inference) | <30ms | Tree-based quantile |
| M3 (Carbon calculation) | <5ms | Formula matematis sederhana |
| M4 (NSGA-II, time-boxed) | ~2000-2500ms | Komponen paling berat, dominasi budget |
| Orchestration overhead (LangGraph) | <100ms | Checkpointing & routing logic |
| **Total** | **~2.2-2.7s** | Menyisakan margin untuk P95 <3s |

### 6.2 LangGraph Overhead

LangGraph checkpointing menambah overhead ~50-100ms per pipeline run. Mitigasi:
- Checkpoint hanya di node kritis (ETA, Route Opt, Decision) — bukan setiap edge
- Gunakan in-memory checkpointer untuk MVP (SQLite untuk production)
- Async execution antar node yang tidak punya dependency

### 6.3 Parallel Execution

Beberapa node dapat di-parallel:
- Traffic Agent + Hub Risk Agent (no inter-dependency)
- Carbon Agent dapat dimulai setelah Route Agent punya distance (tidak perlu full Pareto)

Parallelisasi dapat menghemat ~200-300ms dari budget.

---

## 7. Monitoring & Observability

### 7.1 Per-Node Metrics

| Metric | Target | Alert threshold |
|---|---|---|
| Traffic Agent latency | <50ms P95 | >200ms |
| ETA Agent latency | <50ms P95 | >100ms |
| Hub Risk Agent latency | <30ms P95 | >100ms |
| Carbon Agent latency | <5ms P95 | >50ms |
| Route Opt Agent latency | <2500ms P95 | >3000ms |
| Decision Agent latency | <100ms P95 | >500ms |
| Total pipeline latency | <3000ms P95 | >5000ms |

### 7.2 Confidence Distribution Monitoring

Monitor distribusi `confidence_aggregate` harian:
- Median seharusnya stabil di 0.80-0.90
- P10 seharusnya tidak di bawah 0.50 (jika ya, ada komponen yang degradasi)
- Escalation rate (confidence <0.70) seharusnya 5-20%
  - <5%: threshold mungkin terlalu rendah
  - >30%: alert fatigue risk

### 7.3 Audit Trail

Setiap pipeline run menghasilkan audit trail:
- Input state per node
- Output state per node
- Latency per node
- Decision akhir + confidence
- SHAP explanation (jika WARNING/CRITICAL)

Disimpan di database time-series (InfluxDB) untuk retrospective analysis. Juri dapat menanyakan "mengapa shipment X di-escalate?" → tim dapat query audit trail dan tunjukkan confidence breakdown + SHAP.

---

## 8. Risiko & Mitigasi

| Risiko | Severity | Mitigasi |
|---|---|---|
| Bobot confidence tidak terkalibrasi → false escalation/execution | Tinggi | Kalibrasi manual BA + sensitivity analysis §4.3 |
| LangGraph overhead melanggar latency budget | Sedang | Checkpoint minimal, in-memory untuk MVP |
| Failure di satu node → pipeline stuck | Tinggi | LangGraph checkpointing + retry policy + fallback default values |
| Audit trail storage bengkak | Sedang | Retention policy 30 hari untuk raw, aggregate untuk long-term |
| Operator override rate tinggi → indikasi model tidak trustworthy | Tinggi | Monitor override rate per hari; jika >40% → review ulang model & bobot |
| SHAP explanation (M5) tidak tersedia saat escalation → konteks kurang | Sedang | Pastikan M5 aktif untuk semua shipment WARNING/CRITICAL sebelum Decision Agent |

---

## 9. Roadmap (post-MVP)

| Fase | Upgrade |
|---|---|
| Production 3 bulan | Bayesian weight learning §4.4 — bobot dioptimasi dari outcome historis |
| Production 6 bulan | Dynamic threshold: threshold 0.70 menyesuaikan beban operasional (turun saat peak, naik saat low-load) |
| Production 12 bulan | LLM-based escalation summary: konversi confidence breakdown + SHAP ke narasi natural language untuk operator |
| Production 18 bulan | Active learning: shipment yang di-escalate & operator override digunakan sebagai training signal untuk retrain M1/M2 |

---

## 10. Acceptance Criteria (untuk demo kompetisi)

- [ ] 6 node LangGraph terdefinisi dengan state schema §2.4
- [ ] Formula confidence aggregation §3.1 diimplementasikan dan dapat ditelusuri
- [ ] Bobot confidence di-load dari `m6_confidence_config.yaml` (bukan hardcoded)
- [ ] Asumsi kalibrasi bobot didokumentasikan (file YAML + lampiran laporan)
- [ ] Sensitivity analysis §4.3 dilampirkan di laporan
- [ ] Threshold escalation 0.70 aktif dengan conditional edge
- [ ] Escalation message schema §5.2 terimplementasi dengan `primary_uncertainty_driver`
- [ ] Latency end-to-end P95 < 3 detik
- [ ] Audit trail per pipeline run tersimpan dan queryable
- [ ] Escalation rate monitoring aktif (alert jika >30%)
- [ ] Dashboard menampilkan confidence breakdown (bukan hanya angka aggregate)

---

**Referensi internal:** M1 (model_confidence input), M2 (model_confidence input), M3 (audit_validity input), M4 (constraint_satisfaction input), M5 (SHAP explanation di escalation message), Dashboard (confidence breakdown visualization + escalation UI).
