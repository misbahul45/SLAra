# ==========================================================
# M2 REPRODUCTION — Hub Dwell Forecast (dual quantile LightGBM)
# Simulator M/M/c: VERBATIM dari notebook (FASE 2).
# Feature engineering: REKONSTRUKSI dari spec markdown FASE 4
#   (cell kode aslinya hilang dari ipynb yang di-export).
# Hyperparams: best params Optuna dari output notebook (FASE 9).
# Artifacts: format persis FASE 14 (per_hub/global yaml).
# ==========================================================
import numpy as np, pandas as pd, lightgbm as lgb, yaml, json, time, os
from sklearn.metrics import mean_absolute_error

RANDOM_SEED = 42
rng_global = np.random.default_rng(RANDOM_SEED)
OUT = '/home/claude/m2_artifacts'
os.makedirs(f'{OUT}/models', exist_ok=True); os.makedirs(f'{OUT}/configs', exist_ok=True)

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
TARGET = "dwell_time_minutes"

# ---------- FASE 2: simulator (verbatim) ----------
HUBS = [
    {"hub_id": "HUB-CGK-01", "hub_region": "urban_dense", "hub_num_docks": 20, "hub_capacity": 480},
    {"hub_id": "HUB-CGK-02", "hub_region": "urban_dense", "hub_num_docks": 15, "hub_capacity": 360},
    {"hub_id": "HUB-BDG-01", "hub_region": "urban",       "hub_num_docks": 10, "hub_capacity": 240},
    {"hub_id": "HUB-SBY-01", "hub_region": "urban",       "hub_num_docks": 10, "hub_capacity": 240},
    {"hub_id": "HUB-SMG-01", "hub_region": "intercity",   "hub_num_docks": 5,  "hub_capacity": 120},
    {"hub_id": "HUB-JOG-01", "hub_region": "intercity",   "hub_num_docks": 5,  "hub_capacity": 120},
]
N_WEEKS_SIM = 8; HOURS_SIM = N_WEEKS_SIM*7*24; WARMUP_HOURS = 24*7*2
MU_PER_DOCK_BASE = 6.0

def lambda_t(hod, dow, base_lambda):
    peak_pagi = np.exp(-0.5*((hod-9)/2.2)**2)
    peak_sore = np.exp(-0.5*((hod-17)/2.5)**2)
    diurnal = 0.15 + 0.85*np.maximum(peak_pagi, peak_sore)
    return base_lambda * diurnal * (0.65 if dow >= 5 else 1.0)

def simulate_hub(hub, rng, weather_series, shock_hours):
    c = hub["hub_num_docks"]; base_lambda = hub["hub_capacity"]/24.0*1.15
    hourly, ships = [], []; queue = 0.0
    for h in range(HOURS_SIM):
        dow, hod = (h//24) % 7, h % 24
        weather = weather_series[h]; is_shock = h in shock_hours
        lam = lambda_t(hod, dow, base_lambda) * (1.6 if is_shock else 1.0)
        weather_penalty = 1.0 - 0.12*weather - (0.15 if is_shock else 0.0)
        mu_eff = MU_PER_DOCK_BASE * max(weather_penalty, 0.45)
        arrivals = rng.poisson(max(lam, 0.01))
        rho = min(lam / max(c*mu_eff, 1e-6), 0.98)
        processed = min(queue + arrivals, c*mu_eff)
        queue_new = max(queue + arrivals - processed, 0.0)
        base_svc = 60.0/mu_eff
        mean_dwell = base_svc + base_svc*(rho/max(1-rho, 0.02))*(1 + queue/(c*3))
        n = int(arrivals)
        dsamp = rng.gamma(2.0, mean_dwell/2.0, size=n) if n else np.array([])
        hourly.append({"hub_id": hub["hub_id"], "hour_idx": h, "dow": dow, "hod": hod,
                       "arrivals": n, "queue_length": queue_new,
                       "dock_utilization": min(rho, 1.0),
                       "dwell_p50_hourly": float(np.median(dsamp)) if n else mean_dwell,
                       "base_service_min": base_svc, "weather_severity": weather})
        for d in dsamp:
            ships.append({"hub_id": hub["hub_id"], "hour_idx": h, TARGET: float(d)})
        queue = queue_new
    return hourly, ships

weather_series = rng_global.choice([0, 1, 2, 3], size=HOURS_SIM, p=[0.50, 0.30, 0.15, 0.05])
shock_hours = set(rng_global.choice(HOURS_SIM, size=int(HOURS_SIM*0.01), replace=False))
hourly_all, ship_all = [], []
for hub in HUBS:
    hr, sr = simulate_hub(hub, rng_global, weather_series, shock_hours)
    hourly_all += hr; ship_all += sr
dfh = pd.DataFrame(hourly_all); dfs = pd.DataFrame(ship_all)
print(f"Simulator: {len(dfh):,} hourly · {len(dfs):,} shipment")

# ---------- FASE 4 (rekonstruksi per spec markdown, anti-leakage shift(1)) ----------
dfh = dfh.sort_values(["hub_id", "hour_idx"]).reset_index(drop=True)
g = dfh.groupby("hub_id", group_keys=False)
dfh["dwell_lag_1h"]   = g["dwell_p50_hourly"].shift(1)
dfh["dwell_lag_24h"]  = g["dwell_p50_hourly"].shift(24)
dfh["dwell_lag_168h"] = g["dwell_p50_hourly"].shift(168)
dfh["dwell_rolling_mean_6h"] = g["dwell_p50_hourly"].apply(lambda s: s.shift(1).rolling(6).mean())
dfh["dwell_rolling_std_6h"]  = g["dwell_p50_hourly"].apply(lambda s: s.shift(1).rolling(6).std())
dfh["queue_rolling_max_3h"]  = g["queue_length"].apply(lambda s: s.shift(1).rolling(3).max())
dfh["incoming_shipment_rate_last_1h"]  = g["arrivals"].shift(1)
dfh["incoming_shipment_rate_last_15m"] = dfh["incoming_shipment_rate_last_1h"] / 4.0
dfh["avg_service_time_last_1h"] = g["base_service_min"].shift(1)
dfh["queue_length_current"] = dfh["queue_length"]
dfh["dock_utilization_pct"] = dfh["dock_utilization"]
dfh["hour_of_day_sin"] = np.sin(2*np.pi*dfh["hod"]/24); dfh["hour_of_day_cos"] = np.cos(2*np.pi*dfh["hod"]/24)
dfh["day_of_week_sin"] = np.sin(2*np.pi*dfh["dow"]/7);  dfh["day_of_week_cos"] = np.cos(2*np.pi*dfh["dow"]/7)
dfh["is_weekend"] = (dfh["dow"] >= 5).astype(int)
dfh["is_peak_hour"] = dfh["hod"].isin([8, 9, 10, 16, 17, 18]).astype(int)
hub_static = pd.DataFrame(HUBS)[["hub_id", "hub_capacity", "hub_num_docks"]]
dfh = dfh.merge(hub_static, on="hub_id")
dfh["weather_severity_score"] = dfh["weather_severity"]

df = dfs.merge(dfh, on=["hub_id", "hour_idx"])
df = df[df["hour_idx"] >= WARMUP_HOURS].dropna(
    subset=[c for c in FEATURE_COLS_M2 if c != "hub_id_target_encoded"]).reset_index(drop=True)
print(f"Setelah FE + drop warmup/NaN: {len(df):,} baris")

# ---------- FASE 5: split 4/1/1 minggu + target encoding (train only) ----------
hmin, hmax = df["hour_idx"].min(), df["hour_idx"].max()
span = hmax - hmin
tr_end, va_end = hmin + int(span*4/6), hmin + int(span*5/6)
dtr = df[df["hour_idx"] <= tr_end].copy()
dva = df[(df["hour_idx"] > tr_end) & (df["hour_idx"] <= va_end)].copy()
dte = df[df["hour_idx"] > va_end].copy()
hub_target_encoding = dtr.groupby("hub_id")[TARGET].mean().to_dict()
global_mean_dwell = dtr[TARGET].mean()
for part in (dtr, dva, dte):
    part["hub_id_target_encoded"] = part["hub_id"].map(hub_target_encoding).fillna(global_mean_dwell)
print(f"Split: train {len(dtr):,} | val {len(dva):,} | test {len(dte):,}")

# ---------- FASE 10: train final (train+val) dgn best params notebook ----------
BEST = dict(n_estimators=200, num_leaves=37, max_depth=3, learning_rate=0.02413338039141455,
            subsample=0.7554709158757928, colsample_bytree=0.7085396127095583,
            reg_lambda=2.558586885593425, min_child_samples=84,
            random_state=RANDOM_SEED, verbosity=-1)
Xtv = pd.concat([dtr, dva])[FEATURE_COLS_M2]; ytv = pd.concat([dtr, dva])[TARGET]
Xte, yte = dte[FEATURE_COLS_M2], dte[TARGET]
m50 = lgb.LGBMRegressor(objective="quantile", alpha=0.5, **BEST).fit(Xtv, ytv)
m90 = lgb.LGBMRegressor(objective="quantile", alpha=0.9, **BEST).fit(Xtv, ytv)
p50 = m50.predict(Xte); p90 = np.maximum(p50, m90.predict(Xte))

def pinball(y, p, a): d = y - p; return np.mean(np.maximum(a*d, (a-1)*d))
mae = mean_absolute_error(yte, p50)
pb50, pb90 = pinball(yte.values, p50, 0.5), pinball(yte.values, p90, 0.9)
cov = (yte.values <= p90).mean()
print(f"\nTest: MAE P50 {mae:.3f} · pinball P50 {pb50:.3f} / P90 {pb90:.3f} · Coverage P90 {cov*100:.2f}%")
assert 0.86 <= cov <= 0.94, "Coverage jauh dari band — cek FE"

# ---------- FASE 13: rolling coverage & confidence ----------
ev = dte.copy(); ev["pred_p90"] = p90
ev["covered"] = (ev[TARGET] <= ev["pred_p90"]).astype(int)
ev["day_idx"] = ev["hour_idx"] // 24
dc = ev.groupby(["hub_id", "day_idx"])["covered"].mean().reset_index().sort_values(["hub_id", "day_idx"])
dc["cov7"] = dc.groupby("hub_id")["covered"].transform(lambda s: s.rolling(7, min_periods=1).mean())
dc["conf"] = 1 - (dc["cov7"] - 0.90).abs()
latest = dc.sort_values("day_idx").groupby("hub_id").tail(1)
GLOBAL_COV = float(cov); GLOBAL_CONF = float(1 - abs(GLOBAL_COV - 0.90))
print(f"Global confidence M2: {GLOBAL_CONF:.4f}")
print(latest[["hub_id", "cov7", "conf"]].to_string(index=False))

# ---------- FASE 14: save artifacts (format notebook: per_hub/global) ----------
m50.booster_.save_model(f"{OUT}/models/m2_dwell_p50.txt")
m90.booster_.save_model(f"{OUT}/models/m2_dwell_p90.txt")
hist = pd.concat([dtr, dva]).groupby("hub_id")[TARGET].median().to_dict()
yaml.dump({"per_hub": {k: round(float(v), 3) for k, v in hist.items()},
           "global": round(float(pd.concat([dtr, dva])[TARGET].median()), 3),
           "fallback_multiplier_p90": 1.4},
          open(f"{OUT}/configs/hub_historical_median.yaml", "w"), sort_keys=False)
yaml.dump({"per_hub": {k: round(float(v), 3) for k, v in hub_target_encoding.items()},
           "global_mean": round(float(global_mean_dwell), 3)},
          open(f"{OUT}/configs/hub_target_encoding.yaml", "w"), sort_keys=False)
yaml.dump({"global": {"coverage_P90": round(GLOBAL_COV, 4), "model_confidence": round(GLOBAL_CONF, 4)},
           "per_hub": {r["hub_id"]: {"coverage_p90_rolling_7d": round(float(r["cov7"]), 4),
                                     "model_confidence_m2": round(float(r["conf"]), 4)}
                       for _, r in latest.iterrows()}},
          open(f"{OUT}/configs/coverage_confidence.yaml", "w"), sort_keys=False)
yaml.dump({"version": "m2_v1.0.1-reproduced", "features": FEATURE_COLS_M2,
           "alphas": {"p50": 0.5, "p90": 0.9}, "best_params_source": "optuna notebook FASE 9",
           "metrics_test": {"mae_p50": round(mae, 3), "pinball_p50": round(pb50, 3),
                            "pinball_p90": round(pb90, 3), "coverage_p90_pct": round(cov*100, 2)},
           "note": "retrained from scratch; FE direkonstruksi dari spec FASE 4 (cell asli hilang di export)"},
          open(f"{OUT}/configs/model_config.yaml", "w"), sort_keys=False)
json.dump({"mae_p50": round(mae, 3), "pinball_p50": round(pb50, 3), "pinball_p90": round(pb90, 3),
           "coverage_p90_pct": round(cov*100, 2), "global_confidence": round(GLOBAL_CONF, 4)},
          open(f"{OUT}/results_summary.json", "w"), indent=2)
print(f"\nArtifacts -> {OUT}")
