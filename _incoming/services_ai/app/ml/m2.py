"""M2 — Hub dwell forecast. Port m2_predict() dari notebook M2 (FASE 15) + degraded path.

Dua mode:
- FULL   : model dual-quantile tersedia -> prediksi 21 fitur, non-crossing enforce.
- DEGRADED: model tidak ada -> historical median hub (configs) atau default global,
            model_confidence rendah, m2_degraded=True. Sesuai failure-cascade design
            (M2 down = degradasi anggun, confidence M6 turun, sistem tetap jalan).

Telemetry: request boleh kirim fitur lengkap; kalau tidak, snapshot diambil dari
data/hub_telemetry.json berdasarkan (hub_id, condition). Fitur hilang -> 0.0 (fail-soft,
identik notebook).
"""
from __future__ import annotations

import time
from typing import Optional

import pandas as pd

from _incoming.services_ai.app.core.artifacts import ART

FEATURE_COLS_M2 = [
    "queue_length_current", "dock_utilization_pct",
    "incoming_shipment_rate_last_1h", "incoming_shipment_rate_last_15m",
    "avg_service_time_last_1h",
    "dwell_lag_1h", "dwell_lag_24h", "dwell_lag_168h",
    "dwell_rolling_mean_6h", "dwell_rolling_std_6h", "queue_rolling_max_3h",
    "hour_of_day_sin", "hour_of_day_cos", "day_of_week_sin", "day_of_week_cos",
    "is_weekend", "is_peak_hour",
    "hub_id_target_encoded", "hub_capacity", "hub_num_docks",
    "weather_severity_score",
]

DWELL_P90_THRESHOLD_MULTIPLIER = 2.0
GLOBAL_HIST_MEDIAN_FALLBACK = 12.0   # dipakai HANYA kalau configs m2 belum di-drop
DEGRADED_CONFIDENCE = 0.50


def _cfg_lookup(d: dict, hub_id: str, key_global: str, default):
    """Toleran terhadap dua bentuk yaml: flat {hub: val} atau {'hubs': {...}, 'global': val}."""
    if not d:
        return default
    if "hubs" in d:
        return d["hubs"].get(hub_id, d.get(key_global, d.get("global", default)))
    return d.get(hub_id, d.get(key_global, d.get("global", default)))


def _resolve_telemetry(hub_id: str, condition: str, overrides: Optional[dict]) -> dict:
    snap = {}
    hub_block = ART.hub_telemetry.get(hub_id, {})
    snap.update(hub_block.get(condition, hub_block.get("normal", {})))
    if overrides:
        snap.update(overrides)
    snap["hub_id"] = hub_id
    # target encoding dari configs (serving-side, bukan dari klien)
    enc = _cfg_lookup(ART.m2_target_encoding, hub_id, "global_mean", None)
    if enc is not None and "hub_id_target_encoded" not in snap:
        snap["hub_id_target_encoded"] = float(enc)
    return snap


def predict(hub_id: str, condition: str = "normal", overrides: Optional[dict] = None) -> dict:
    t0 = time.perf_counter()
    hub_status = _resolve_telemetry(hub_id, condition, overrides)
    hist_median = float(_cfg_lookup(ART.m2_hist_median, hub_id,
                                    "global_median", GLOBAL_HIST_MEDIAN_FALLBACK))
    threshold = hist_median * DWELL_P90_THRESHOLD_MULTIPLIER

    if ART.m2_available:
        X = pd.DataFrame([{c: hub_status.get(c, 0.0) for c in FEATURE_COLS_M2}],
                         columns=FEATURE_COLS_M2)
        p50 = float(ART.m2_p50.predict(X)[0])
        p90 = max(p50, float(ART.m2_p90.predict(X)[0]))  # non-crossing
        conf_block = _cfg_lookup(ART.m2_confidence, hub_id, "global", {}) or {}
        coverage = float(conf_block.get("coverage_p90_rolling_7d",
                                        ART.m2_confidence.get("global_coverage_p90", 0.896)))
        confidence = float(conf_block.get("model_confidence_m2",
                                          ART.m2_confidence.get("global_model_confidence", 0.95)))
        degraded = False
        version = "m2_v1.0.0-lightgbm-quantile"
    else:
        p50 = hist_median
        p90 = hist_median * 1.8
        coverage = 0.0
        confidence = DEGRADED_CONFIDENCE
        degraded = True
        version = "m2_degraded-historical-median"

    return {
        "hub_id": hub_id,
        "dwell_p50_minutes": round(p50, 2),
        "dwell_p90_minutes": round(p90, 2),
        "coverage_P90": round(coverage, 4),
        "model_confidence": round(confidence, 4),
        "dwell_p90_exceeds_threshold": bool(p90 > threshold),
        "queue_state": {
            "queue_length": int(hub_status.get("queue_length_current", 0)),
            "truck_count": int(hub_status.get("truck_count",
                                              hub_status.get("queue_length_current", 0))),
            "dock_utilization": round(float(hub_status.get("dock_utilization_pct", 0.0)), 4),
        },
        "m2_degraded": degraded,
        "model_version": version,
        "latency_ms": round((time.perf_counter() - t0) * 1000, 3),
    }
