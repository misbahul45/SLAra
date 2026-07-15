"""
M1 v2 Inference Helper — SLAra AI
Dual Quantile LightGBM (P50 & P90) + conformal offset + risk tier + conf_m1.

Pakai:
    from m1_v2_inference import M1Predictor
    m1 = M1Predictor(artifacts_dir="m1v2_artifacts")
    out = m1.predict({
        "distance_km": 14.2, "weather_severity": 1, "traffic_index": 1.3,
        "is_weekend": 0, "vehicle_type_encoded": 0, "pickup_hour": 17,
        "hub_dwell_time_predicted": 12.3,   # dari M2 saat serving
        "promised_deadline": 90.0,
    })
    # -> {"eta_p50_min", "eta_p90_min", "risk_tier", "conf_m1", "slack_p90_min"}
"""
import os
import numpy as np
import lightgbm as lgb
import yaml

FEATURE_COLS = ['distance_km', 'weather_severity', 'traffic_index', 'is_weekend',
                'vehicle_type_encoded', 'hour_sin', 'hour_cos',
                'dist_traffic_interaction', 'dist_weather_interaction',
                'hub_dwell_time_predicted']


class M1Predictor:
    def __init__(self, artifacts_dir: str):
        mdir = os.path.join(artifacts_dir, 'models')
        cdir = os.path.join(artifacts_dir, 'configs')
        self.p50 = lgb.Booster(model_file=os.path.join(mdir, 'm1_eta_v2_p50.txt'))
        self.p90 = lgb.Booster(model_file=os.path.join(mdir, 'm1_eta_v2_p90.txt'))
        th = yaml.safe_load(open(os.path.join(cdir, 'risk_thresholds.yaml')))
        self.thresh_safe = th['safe_min_slack_minutes']        # +15
        self.thresh_crit = th['critical_max_slack_minutes']    # -30
        self.delta = th.get('conformal_delta_p90_minutes', 0.0)  # +0.83

    @staticmethod
    def _features(f: dict) -> np.ndarray:
        h = f.get('pickup_hour', 12)
        row = {
            'distance_km': f['distance_km'],
            'weather_severity': f['weather_severity'],
            'traffic_index': f['traffic_index'],
            'is_weekend': f.get('is_weekend', 0),
            'vehicle_type_encoded': f['vehicle_type_encoded'],
            'hour_sin': np.sin(2 * np.pi * h / 24),
            'hour_cos': np.cos(2 * np.pi * h / 24),
            'dist_traffic_interaction': f['distance_km'] * f['traffic_index'],
            'dist_weather_interaction': f['distance_km'] * (f['weather_severity'] + 1),
            'hub_dwell_time_predicted': f['hub_dwell_time_predicted'],
        }
        return np.array([[row[c] for c in FEATURE_COLS]])

    def predict(self, f: dict) -> dict:
        X = self._features(f)
        p50 = float(self.p50.predict(X)[0])
        p90 = max(p50, float(self.p90.predict(X)[0])) + self.delta  # monotonic + conformal
        deadline = float(f['promised_deadline'])
        slack = deadline - p90  # tiering pakai P90 (pesimis) — konsisten training
        tier = ('SAFE' if slack >= self.thresh_safe
                else 'WARNING' if slack >= self.thresh_crit
                else 'CRITICAL')
        conf_m1 = 1.0 - min(1.0, (p90 - p50) / (2.0 * max(p50, 1e-6)))  # formula M6
        return {
            'eta_p50_min': round(p50, 1),
            'eta_p90_min': round(p90, 1),
            'risk_tier': tier,
            'slack_p90_min': round(slack, 1),
            'conf_m1': round(conf_m1, 3),
        }


if __name__ == '__main__':
    m1 = M1Predictor(os.path.dirname(os.path.abspath(__file__)))
    demos = [
        ('Urban dekat, cerah, lancar', {'distance_km': 6.0, 'weather_severity': 0, 'traffic_index': 0.8,
         'vehicle_type_encoded': 0, 'pickup_hour': 10, 'hub_dwell_time_predicted': 7.0, 'promised_deadline': 55.0}),
        ('Same-day jauh, hujan, macet', {'distance_km': 32.0, 'weather_severity': 1, 'traffic_index': 1.3,
         'vehicle_type_encoded': 1, 'pickup_hour': 17, 'hub_dwell_time_predicted': 14.0, 'promised_deadline': 85.0}),
        ('Banjir + macet total, jauh', {'distance_km': 45.0, 'weather_severity': 2, 'traffic_index': 1.8,
         'vehicle_type_encoded': 2, 'pickup_hour': 18, 'hub_dwell_time_predicted': 18.0, 'promised_deadline': 120.0}),
    ]
    for label, f in demos:
        print(f"{label:32s} -> {m1.predict(f)}")
