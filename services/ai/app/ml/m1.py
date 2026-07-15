"""M1 v2 — ETA dual quantile + risk tier + conf_m1. Port dari m1_v2_inference.py (golden-tested)."""
from __future__ import annotations

import math

import numpy as np

from app.core.artifacts import ART

FEATURE_COLS = ['distance_km', 'weather_severity', 'traffic_index', 'is_weekend',
                'vehicle_type_encoded', 'hour_sin', 'hour_cos',
                'dist_traffic_interaction', 'dist_weather_interaction',
                'hub_dwell_time_predicted']


def _features(f: dict) -> np.ndarray:
    h = f.get('pickup_hour', 12)
    row = {
        'distance_km': f['distance_km'],
        'weather_severity': f['weather_severity'],
        'traffic_index': f['traffic_index'],
        'is_weekend': f.get('is_weekend', 0),
        'vehicle_type_encoded': f['vehicle_type_encoded'],
        'hour_sin': math.sin(2 * math.pi * h / 24),
        'hour_cos': math.cos(2 * math.pi * h / 24),
        'dist_traffic_interaction': f['distance_km'] * f['traffic_index'],
        'dist_weather_interaction': f['distance_km'] * (f['weather_severity'] + 1),
        'hub_dwell_time_predicted': f['hub_dwell_time_predicted'],
    }
    return np.array([[row[c] for c in FEATURE_COLS]])


def predict(f: dict) -> dict:
    th = ART.m1_thresholds
    delta = th.get('conformal_delta_p90_minutes', 0.0)
    X = _features(f)
    p50 = float(ART.m1_p50.predict(X)[0])
    p90 = max(p50, float(ART.m1_p90.predict(X)[0])) + delta
    deadline = float(f['promised_deadline'])
    slack = deadline - p90
    tier = ('SAFE' if slack >= th['safe_min_slack_minutes']
            else 'WARNING' if slack >= th['critical_max_slack_minutes']
            else 'CRITICAL')
    conf_m1 = 1.0 - min(1.0, (p90 - p50) / (2.0 * max(p50, 1e-6)))
    return {
        'eta_p50_min': round(p50, 1),
        'eta_p90_min': round(p90, 1),
        'risk_tier': tier,
        'slack_p90_min': round(slack, 1),
        'conf_m1': round(conf_m1, 3),
        'model_version': ART.m1_config.get('version', 'unknown'),
    }
