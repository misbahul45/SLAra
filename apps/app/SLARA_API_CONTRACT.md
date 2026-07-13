# SLAra API Contract — v1 (FROZEN 13 Jul 2026)

> **Aturan main:** kontrak ini FROZEN untuk semifinal. Perubahan field = wajib sepakat di grup + update file ini.
> Frontend hanya konsumsi **4 endpoint FE-facing**. Endpoint internal M1–M5 urusan `ai` service, di-aggregate oleh M6 (`/decide`).
> Base URL dev: `http://localhost:8000/api/v1` (FastAPI `ai` service). Semua response `application/json`.
> Konvensi: snake_case, waktu ISO 8601 UTC, jarak km, durasi menit, uang IDR integer, emisi kg CO₂e.

---

## A. Endpoint FE-facing (yang dipakai dashboard)

### 1. `GET /kpi/summary`
KPI strip di atas Risk Monitor.

```json
{
  "generated_at": "2026-07-15T02:10:00Z",
  "active_shipments": 128,
  "tier_counts": { "SAFE": 96, "WARNING": 21, "CRITICAL": 11 },
  "on_time_rate_pct": 91.4,
  "auto_execute_rate_pct": 84.3,
  "co2_saved_today_kg": 142.7,
  "avg_decision_latency_ms": 1980
}
```

### 2. `GET /shipments`
List untuk Risk Monitor. Query opsional: `?tier=CRITICAL`, `?limit=50`.

```json
{
  "shipments": [
    {
      "shipment_id": "SHP-2026-00417",
      "created_at": "2026-07-15T01:05:00Z",
      "origin_hub": { "hub_id": "HUB-SBY-01", "name": "Surabaya Rungkut", "lat": -7.3315, "lng": 112.7681 },
      "destination": { "label": "Gubeng", "lat": -7.2653, "lng": 112.7519 },
      "sla_type": "SAME_DAY",
      "promised_deadline": "2026-07-15T05:00:00Z",
      "distance_km": 14.2,
      "vehicle_type": "MOTORCYCLE",
      "load_kg": 8.5,
      "eta_p50_min": 47.2,
      "eta_p90_min": 78.5,
      "risk_tier": "WARNING",
      "hub_dwell_p50_min": 12.3,
      "co2_kg": 0.41,
      "decision_status": "PENDING"
    }
  ],
  "total": 128
}
```

- `risk_tier` ∈ `SAFE | WARNING | CRITICAL`
- `vehicle_type` ∈ `MOTORCYCLE | VAN | TRUCK_CDE | TRUCK_CDD`
- `sla_type` ∈ `SAME_DAY | NEXT_DAY | REGULAR`
- `decision_status` ∈ `PENDING | AUTO_EXECUTED | ESCALATED | APPROVED | REJECTED`

### 3. `POST /shipments/{shipment_id}/decide`
Trigger full pipeline M6 (M1→M2→M3→M4→M5→confidence). **Payload paling penting — jantung Decision View.**
Request body: `{}` (kosong; semua konteks dari shipment_id).

```json
{
  "shipment_id": "SHP-2026-00417",
  "decided_at": "2026-07-15T02:11:03Z",
  "decision": "ESCALATE",
  "confidence": 0.65,
  "threshold": 0.70,
  "confidence_breakdown": {
    "conf_m1":        { "value": 0.45, "weight": 0.40, "label": "ETA certainty (M1)" },
    "conf_m2":        { "value": 0.78, "weight": 0.15, "label": "Hub dwell certainty (M2)" },
    "cs_m4":          { "value": 0.66, "weight": 0.25, "label": "Route optimality (M4)" },
    "data_freshness": { "value": 0.90, "weight": 0.10, "label": "Data freshness" },
    "audit_validity": { "value": 1.00, "weight": 0.10, "label": "Audit validity" }
  },
  "primary_uncertainty_driver": "wide_eta_interval",
  "selected_route_id": "R-B",
  "routes": [
    {
      "route_id": "R-B",
      "label": "Balanced",
      "eta_p50_min": 47.2,
      "eta_p90_min": 78.5,
      "risk_tier": "WARNING",
      "cost_idr": 41200,
      "co2_kg": 0.41,
      "distance_km": 14.2,
      "geometry": [[-7.3315, 112.7681], [-7.3102, 112.7654], [-7.2874, 112.7590], [-7.2653, 112.7519]]
    },
    {
      "route_id": "R-A",
      "label": "Fastest",
      "eta_p50_min": 41.0, "eta_p90_min": 92.3, "risk_tier": "CRITICAL",
      "cost_idr": 38900, "co2_kg": 0.48, "distance_km": 13.1,
      "geometry": [[-7.3315, 112.7681], [-7.3210, 112.7480], [-7.2801, 112.7433], [-7.2653, 112.7519]]
    },
    {
      "route_id": "R-C",
      "label": "Greenest",
      "eta_p50_min": 55.8, "eta_p90_min": 71.2, "risk_tier": "SAFE",
      "cost_idr": 46800, "co2_kg": 0.33, "distance_km": 15.6,
      "geometry": [[-7.3315, 112.7681], [-7.3350, 112.7830], [-7.2950, 112.7811], [-7.2653, 112.7519]]
    }
  ],
  "shap_top5": [
    { "feature": "hub_dwell_time_predicted", "impact_min": 12.4, "direction": "increases_eta" },
    { "feature": "distance_km",              "impact_min": 8.1,  "direction": "increases_eta" },
    { "feature": "rain_intensity",           "impact_min": 5.3,  "direction": "increases_eta" },
    { "feature": "hour_of_day",              "impact_min": -3.2, "direction": "decreases_eta" },
    { "feature": "vehicle_type",             "impact_min": 2.0,  "direction": "increases_eta" }
  ],
  "explanation": "Escalated: P90-P50 interval is wide (31.3 min) driven mainly by predicted hub dwell at Surabaya Rungkut. Greenest route R-C is SAFE but costs 13% more.",
  "latency_ms": 2140
}
```

Catatan penting:
- `decision` ∈ `AUTO_EXECUTE | ESCALATE`
- `shap_top5` hanya terisi jika `risk_tier` selected route ∈ `WARNING | CRITICAL` (M5 lazy). Jika SAFE → `"shap_top5": null`.
- `confidence = Σ(value × weight)` — FE boleh verifikasi & render per-komponen bar.
- `geometry` = array `[lat, lng]` (urutan Leaflet). Backend: kalau pakai OSRM polyline, decode dulu di server, FE terima array jadi.

### 4. `POST /shipments/{shipment_id}/resolve`
Aksi operator di escalation view.
Request: `{ "action": "APPROVE", "route_id": "R-C", "operator_note": "picked greenest, SLA buffer ok" }`
`action` ∈ `APPROVE | REJECT`.

```json
{ "shipment_id": "SHP-2026-00417", "decision_status": "APPROVED", "executed_route_id": "R-C", "resolved_at": "2026-07-15T02:13:40Z" }
```

---

## B. Endpoint internal `ai` service (FYI tim — FE TIDAK memanggil ini)

| Endpoint | Model | In → Out (ringkas) |
|---|---|---|
| `POST /internal/m1/eta` | M1 | features → `{eta_p50_min, eta_p90_min, risk_tier}` |
| `POST /internal/m2/dwell` | M2 | hub_id, arrival_ts → `{dwell_p50_min, dwell_p90_min}` |
| `POST /internal/m3/carbon` | M3 | distance_km, vehicle_type, load_kg → `{co2_kg}` |
| `POST /internal/m4/routes` | M4 | shipment ctx → `{routes[]}` (schema sama dgn §A3.routes) |
| `POST /internal/m5/explain` | M5 | shipment features + model ref → `{shap_top5[]}` |

M6 (`agent` service / LangGraph) memanggil kelima ini lalu expose §A3. Untuk semifinal, boleh saja M6 di-embed di FastAPI yang sama — kontrak FE tidak berubah.

---

## C. Error format (semua endpoint)

```json
{ "error": { "code": "MODEL_UNAVAILABLE", "message": "M4 optimizer timed out, served cached Pareto set", "degraded": true } }
```

HTTP 200 + `degraded: true` untuk graceful degradation (sesuai failure cascade design); 4xx/5xx hanya untuk kegagalan nyata.
