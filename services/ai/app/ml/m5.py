"""M5 — SHAP explainability. TreeExplainer di model M1 v2 **P90**.

Keputusan (ADR di spec serving): yang di-explain adalah prediksi P90 karena tier &
slack ditentukan oleh P90 — "kenapa shipment ini berisiko" == "kenapa P90-nya besar".
Additivity check saat startup (planning M5 §8): base + sum(shap) ~ prediksi.
Lazy policy tetap di M6: endpoint ini hanya dipanggil untuk WARNING/CRITICAL.
"""
from __future__ import annotations

import numpy as np
import shap

from app.core.artifacts import ART
from app.ml.m1 import FEATURE_COLS, _features

FEATURE_LABELS = {
    'distance_km': 'distance_km',
    'weather_severity': 'weather_severity',
    'traffic_index': 'traffic_index',
    'is_weekend': 'is_weekend',
    'vehicle_type_encoded': 'vehicle_type',
    'hour_sin': 'hour_of_day',
    'hour_cos': 'hour_of_day',
    'dist_traffic_interaction': 'distance_x_traffic',
    'dist_weather_interaction': 'distance_x_weather',
    'hub_dwell_time_predicted': 'hub_dwell_time_predicted',
}


def init() -> None:
    ART.m5_explainer = shap.TreeExplainer(ART.m1_p90)
    # additivity check pada 1 sampel sintetis
    X = _features({'distance_km': 14.2, 'weather_severity': 1, 'traffic_index': 1.3,
                   'vehicle_type_encoded': 0, 'pickup_hour': 17,
                   'hub_dwell_time_predicted': 12.0, 'promised_deadline': 90.0})
    sv = ART.m5_explainer.shap_values(X)
    pred = float(ART.m1_p90.predict(X)[0])
    recon = float(ART.m5_explainer.expected_value + sv.sum())
    ART.m5_additivity_ok = abs(pred - recon) < 1e-3
    if not ART.m5_additivity_ok:
        raise RuntimeError(f"M5 additivity FAIL: pred={pred:.4f} recon={recon:.4f}")


def explain(f: dict, top_k: int = 5) -> dict:
    X = _features(f)
    sv = ART.m5_explainer.shap_values(X)[0]
    # gabung pasangan hour_sin/cos jadi satu fitur tampilan
    agg: dict[str, float] = {}
    for col, val in zip(FEATURE_COLS, sv):
        label = FEATURE_LABELS[col]
        agg[label] = agg.get(label, 0.0) + float(val)
    top = sorted(agg.items(), key=lambda kv: abs(kv[1]), reverse=True)[:top_k]
    return {
        'model_explained': 'm1_eta_v2_p90',
        'base_value_min': round(float(ART.m5_explainer.expected_value), 2),
        'prediction_min': round(float(ART.m1_p90.predict(X)[0]), 2),
        'shap_top5': [
            {'feature': name,
             'impact_min': round(val, 2),
             'direction': 'increases_eta' if val >= 0 else 'decreases_eta'}
            for name, val in top
        ],
        'additivity_ok': ART.m5_additivity_ok,
    }
