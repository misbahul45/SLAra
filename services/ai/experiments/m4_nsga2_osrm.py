# ==========================================================
# M4 — Route Optimization (NSGA-II / DEAP) · OSRM road-distance variant
#
# Perbedaan vs m4_nsga2.py (evidence lama):
#   - Matriks jarak antar-stop = JARAK JALAN NYATA dari OSRM /table (bukan haversine×1.3).
#   - Skenario (hub + 16 stop + load + deadline) DI-REUSE dari data/pareto_routes_*.json
#     supaya peta & deadline stabil; yang berubah hanya basis jarak → urutan optimal.
# Sisanya identik: physics-core leg ETA (konsisten generator M1), M1 v2 memberi rasio
# ketidakpastian P90/P50, NSGA-II 3 objektif (cost · sla_risk · co2), pilih 3 kandidat.
#
# Jalankan (dari services/ai/):
#   uv run --with deap python experiments/m4_nsga2_osrm.py
# Output: data/pareto_routes_jabodetabek_urban.json (lalu jalankan
#   python scripts/snap_routes_to_roads.py untuk mengisi road_geometry).
# ==========================================================
import json, time, random, math, os, urllib.request
from pathlib import Path

import numpy as np
import lightgbm as lgb
import yaml
from deap import base, creator, tools

SEED = 42
random.seed(SEED); np.random.seed(SEED)
rng = np.random.default_rng(SEED)
T0 = time.time()

ROOT = Path(__file__).resolve().parent.parent        # services/ai
DATA = ROOT / "data" / "pareto_routes_jabodetabek_urban.json"
MATRIX_CACHE = ROOT / "experiments" / "osrm_matrix_jabodetabek.json"
OSRM = "https://router.project-osrm.org"

ART = ROOT / "models" / "m1"
CFG = ROOT / "configs" / "m1"
m50 = lgb.Booster(model_file=str(ART / "m1_eta_v2_p50.txt"))
m90 = lgb.Booster(model_file=str(ART / "m1_eta_v2_p90.txt"))
th = yaml.safe_load(open(CFG / "risk_thresholds.yaml"))
TS, TC, DELTA = th['safe_min_slack_minutes'], th['critical_max_slack_minutes'], th['conformal_delta_p90_minutes']

# ---------- 1. Skenario (REUSE dari JSON yang sudah ada) ----------
prev = json.loads(DATA.read_text(encoding="utf-8"))
HUB = prev['scenario']['hub']
STOPS = prev['scenario']['stops']
N_STOPS = len(STOPS)                                              # 16
lat = np.array([s['lat'] for s in STOPS])
lng = np.array([s['lng'] for s in STOPS])
load = np.array([s['load_kg'] for s in STOPS])
deadline = np.array([s['deadline_min'] for s in STOPS])
SERVICE_MIN = 0.0
VEHICLE = {'type': 'VAN', 'enc': 1, 'cap_kg': 600.0, 'ef': 0.18}
COST = {'base': 150_000, 'per_km': 2_300, 'per_min': 700, 'toll': 15_000}
MAX_TOUR_MIN = 480.0
WEATHER = 1

nodes_lat = np.concatenate([[HUB['lat']], lat])
nodes_lng = np.concatenate([[HUB['lng']], lng])
NN = N_STOPS + 1

# ---------- 1b. Matriks jarak jalan NYATA via OSRM /table (cache) ----------
def osrm_distance_matrix():
    if MATRIX_CACHE.exists():
        return np.array(json.loads(MATRIX_CACHE.read_text())['distances_km'])
    coords = ";".join(f"{nodes_lng[i]},{nodes_lat[i]}" for i in range(NN))
    url = f"{OSRM}/table/v1/driving/{coords}?annotations=distance,duration"
    with urllib.request.urlopen(url, timeout=90) as r:
        payload = json.load(r)
    if payload.get("code") != "Ok":
        raise RuntimeError(f"OSRM table code={payload.get('code')}")
    dm_km = [[(payload["distances"][i][j] or 0.0) / 1000.0 for j in range(NN)] for i in range(NN)]
    MATRIX_CACHE.write_text(json.dumps(
        {"nodes": [[float(nodes_lat[i]), float(nodes_lng[i])] for i in range(NN)],
         "distances_km": dm_km,
         "durations_s": payload["durations"],
         "source": "OSRM /table driving (public server)"}, indent=1))
    return np.array(dm_km)

road_km = osrm_distance_matrix()

dist = np.zeros((NN, NN)); traffic = np.ones((NN, NN)); toll = np.zeros((NN, NN), bool)
for i in range(NN):
    for j in range(NN):
        if i == j: continue
        d = float(road_km[i, j])                                 # jarak jalan NYATA (OSRM)
        is_toll = d > 6 and rng.random() < 0.5                   # leg jauh kadang via tol
        dist[i, j] = d                                            # OSRM sudah termasuk rute tol bila lebih cepat
        traffic[i, j] = 0.85 if is_toll else float(rng.choice([1.0, 1.4, 1.9], p=[0.30, 0.40, 0.30]))
        toll[i, j] = is_toll

# ---------- 2. Leg ETA via M1 v2 (batch, SEKALI) ----------
pairs = [(i, j) for i in range(NN) for j in range(NN) if i != j]
h = 10
feat = np.array([[dist[i, j], WEATHER, traffic[i, j], 0, VEHICLE['enc'],
                  math.sin(2*math.pi*h/24), math.cos(2*math.pi*h/24),
                  dist[i, j]*traffic[i, j], dist[i, j]*(WEATHER+1),
                  12.0 if i == 0 else 6.0] for i, j in pairs])
p50f, p90f = m50.predict(feat), m90.predict(feat)
p90f = np.maximum(p50f, p90f) + DELTA
ratio = np.clip(p90f / np.maximum(p50f, 1e-6), 1.03, 1.60)
ETA50 = np.zeros((NN, NN)); ETA90 = np.zeros((NN, NN))
for k, (i, j) in enumerate(pairs):
    adj_speed = 30.0 / (traffic[i, j] * (1 + WEATHER*0.3))
    leg50 = dist[i, j] / adj_speed * 60 + 3.5
    if i == 0: leg50 += 12.0
    ETA50[i, j] = leg50
    ETA90[i, j] = leg50 * ratio[k]
print(f"OSRM road matrix | mean leg {dist[dist>0].mean():.1f}km | leg P50 mean {ETA50[ETA50>0].mean():.1f} min | mean ratio {ratio.mean():.3f}")

# ---------- 3. Evaluasi tour ----------
def evaluate(perm):
    order = list(perm)
    t50 = t90 = d_tot = cost = co2 = risk = 0.0
    late = 0; rem = load.sum(); prev = 0
    for s in order:
        node = s + 1
        t50 += ETA50[prev, node]; t90 += ETA90[prev, node]
        d_tot += dist[prev, node]
        co2 += dist[prev, node] * VEHICLE['ef'] * (1 + rem/1000)
        cost += COST['toll'] * toll[prev, node]
        slack90 = deadline[s] - t90
        risk += min(1.0, max(0.0, -slack90) / 60.0)
        late += slack90 < 0
        t50 += SERVICE_MIN; t90 += SERVICE_MIN
        rem -= load[s]; prev = node
    t50 += ETA50[prev, 0]; t90 += ETA90[prev, 0]
    d_tot += dist[prev, 0]; co2 += dist[prev, 0] * VEHICLE['ef']
    cost += COST['base'] + COST['per_km']*d_tot + COST['per_min']*t50 + COST['toll']*toll[prev, 0]
    pen = max(0.0, t50 - MAX_TOUR_MIN)
    if load.sum() > VEHICLE['cap_kg']: pen += 1e3
    return (cost*(1+pen/100), risk/N_STOPS + pen/500, co2*(1+pen/100)), \
           {'t50': t50, 't90': t90, 'dist': d_tot, 'cost': cost, 'co2': co2,
            'risk': risk/N_STOPS, 'late': int(late), 'feasible': pen == 0}

# ---------- 4. Baseline nearest-neighbor (distance-only) ----------
unvis = set(range(N_STOPS)); cur = 0; nn_order = []
while unvis:
    nxt = min(unvis, key=lambda s: dist[cur, s+1])
    nn_order.append(nxt); unvis.discard(nxt); cur = nxt + 1

# Deadlines dulu dikalibrasi ke jarak haversine×1.3 (tour lebih pendek). Dengan jarak
# jalan OSRM, tour ~25% lebih lama → deadline lama membuat SEMUA stop telat (semua
# CRITICAL, tak realistis). Rescale same-day deadline ke basis-waktu jarak-jalan
# memakai rasio t50 baseline (deadline-independent), pertahankan struktur tight/loose.
_, _base_t = evaluate(nn_order)                                   # t50 tak bergantung deadline
R_DEADLINE = _base_t['t50'] / prev['baseline_distance_only_nn']['t50']
deadline = np.round(deadline * R_DEADLINE)
print(f"Deadline rescale ×{R_DEADLINE:.3f} (basis-waktu jarak-jalan OSRM)")

_, BASE = evaluate(nn_order)
print(f"Baseline NN: cost {BASE['cost']/1e3:.0f}k · risk {BASE['risk']:.3f} · CO2 {BASE['co2']:.2f}kg · t50 {BASE['t50']:.0f}m · late(P90) {BASE['late']}")

# ---------- 5. NSGA-II ----------
if not hasattr(creator, "FitnessMin"):
    creator.create("FitnessMin", base.Fitness, weights=(-1.0, -1.0, -1.0))
    creator.create("Individual", list, fitness=creator.FitnessMin)
tb = base.Toolbox()
tb.register("indices", random.sample, range(N_STOPS), N_STOPS)
tb.register("individual", tools.initIterate, creator.Individual, tb.indices)
tb.register("population", tools.initRepeat, list, tb.individual)
tb.register("evaluate", lambda ind: evaluate(ind)[0])
tb.register("mate", tools.cxPartialyMatched)
tb.register("mutate", tools.mutShuffleIndexes, indpb=0.06)
tb.register("select", tools.selNSGA2)

POP, NGEN, CXPB, MUTPB = 120, 150, 0.9, 0.35
pop = tb.population(n=POP)
pop[0] = creator.Individual(nn_order[:])
for ind in pop: ind.fitness.values = tb.evaluate(ind)
pop = tb.select(pop, POP)

def hv_estimate(F, samples=20000):
    F = np.asarray(F)
    lo, hi = F.min(0), F.max(0)
    span = np.where(hi - lo < 1e-9, 1.0, hi - lo)
    Fn = (F - lo) / span
    U = rng.uniform(0, 1.1, (samples, 3))
    dominated = np.zeros(samples, bool)
    for f in Fn:
        dominated |= (U >= f).all(1)
    return dominated.mean() * (1.1**3)

hv_series = []
t_ga = time.time()
for gen in range(1, NGEN + 1):
    off = tools.selTournamentDCD(pop, POP)
    off = [creator.Individual(ind[:]) for ind in off]
    for i in range(0, POP - 1, 2):
        if random.random() < CXPB: tb.mate(off[i], off[i+1])
    for ind in off:
        if random.random() < MUTPB: tb.mutate(ind)
        ind.fitness.values = tb.evaluate(ind)
    pop = tb.select(pop + off, POP)
    front = tools.sortNondominated(pop, POP, first_front_only=True)[0]
    hv_series.append(round(hv_estimate([ind.fitness.values for ind in front]), 4))
runtime = time.time() - t_ga

front = tools.sortNondominated(pop, POP, first_front_only=True)[0]
uniq = {tuple(ind): ind for ind in front}
front = list(uniq.values())
print(f"NSGA-II: {NGEN} gen · {runtime:.1f}s · Pareto {len(front)} solusi · HV {hv_series[-1]:.3f}")

# ---------- 6. Pilih 3 kandidat + cs_m4 ----------
det = [evaluate(ind)[1] for ind in front]
not_base = [i for i in range(len(det)) if list(front[i]) != nn_order]
elig = [i for i in not_base if det[i]['risk'] <= BASE['risk'] + 1e-9] or not_base
# Balanced = knee Pareto (min Chebyshev ke titik ideal pada 3 objektif ter-normalisasi),
# kompromi sejati — bukan ekstrem min-risk. Konsisten dgn selection_weights_post_pareto.
_Fb = np.array([[det[i]['cost'], det[i]['risk'], det[i]['co2']] for i in not_base])
_lo, _hi = _Fb.min(0), _Fb.max(0); _span = np.where(_hi - _lo < 1e-9, 1.0, _hi - _lo)
i_bal = not_base[int(((_Fb - _lo) / _span).max(1).argmin())]
i_fast = min(elig, key=lambda i: det[i]['t50'])
i_green = min(not_base, key=lambda i: det[i]['co2'])
picks, used = [], set()
for lbl, idx in [('Fastest', i_fast), ('Balanced', i_bal), ('Greenest', i_green)]:
    while idx in used:
        alt = [i for i in elig if i not in used] or [i for i in range(len(det)) if i not in used]
        key = {'Fastest': lambda i: det[i]['t50'], 'Balanced': lambda i: det[i]['risk'],
               'Greenest': lambda i: det[i]['co2']}[lbl]
        idx = min(alt, key=key)
    used.add(idx); picks.append((lbl, idx))

stab = 1 - abs(hv_series[-1] - hv_series[-15]) / max(hv_series[-1], 1e-9)
feas = np.mean([d['feasible'] for d in det])
cs_m4 = round(float(0.5*stab + 0.5*feas), 3)

def tour_detail(order):
    t50 = t90 = 0.0; prev = 0; arr = []; late = 0
    for s in order:
        node = s + 1
        t50 += ETA50[prev, node]; t90 += ETA90[prev, node]
        is_late = t90 > deadline[s]; late += is_late
        arr.append({'stop_idx': int(s), 'arrival_p50_min': round(t50, 1),
                    'arrival_p90_min': round(t90, 1), 'deadline_min': float(deadline[s]),
                    'late_p90': bool(is_late)})
        prev = node
    share = late / len(order)
    tier = 'SAFE' if share < 0.05 else 'WARNING' if share <= 0.20 else 'CRITICAL'
    return arr, tier, share

candidates = []
for k, (lbl, idx) in enumerate(picks):
    d = det[idx]; order = list(front[idx])
    stop_arrivals, tier, late_share = tour_detail(order)
    geometry = [[round(float(nodes_lat[0]), 5), round(float(nodes_lng[0]), 5)]] + \
               [[round(float(nodes_lat[s+1]), 5), round(float(nodes_lng[s+1]), 5)] for s in order] + \
               [[round(float(nodes_lat[0]), 5), round(float(nodes_lng[0]), 5)]]
    candidates.append({
        'route_id': f'R-{chr(65+k)}', 'label': lbl,
        'eta_p50_min': round(d['t50'], 1), 'eta_p90_min': round(d['t90'], 1),
        'risk_tier': tier, 'late_share_p90': round(late_share, 3), 'stop_arrivals': stop_arrivals,
        'cost_idr': int(d['cost']), 'co2_kg': round(d['co2'], 2),
        'distance_km': round(d['dist'], 1), 'sla_risk': round(d['risk'], 4),
        'late_stops_p90': d['late'], 'stop_order': [int(s) for s in order],
        'geometry': geometry,
        'vs_baseline': {'cost_pct': round(100*(d['cost']-BASE['cost'])/BASE['cost'], 1),
                        'sla_risk_pct': round(100*(d['risk']-BASE['risk'])/max(BASE['risk'],1e-9), 1),
                        'co2_pct': round(100*(d['co2']-BASE['co2'])/BASE['co2'], 1)}})

# Skenario di-reuse; hanya deadline yang di-rescale ke basis-waktu jarak-jalan.
scenario_out = {**prev['scenario'],
                'stops': [{**s, 'deadline_min': float(deadline[i])}
                          for i, s in enumerate(prev['scenario']['stops'])]}

out = {
    'scenario': scenario_out,
    'objectives': ['cost_idr', 'sla_risk (via M1 v2 P90)', 'co2_kg (M3 rule)'],
    'constraints': ['vehicle_capacity_600kg', 'tour_duration_p50<=480min'],
    'tier_rule_tour': 'SAFE <5% stop telat@P90 · WARNING 5-20% · CRITICAL >20%',
    'baseline_distance_only_nn': {**{k: (round(v, 3) if isinstance(v, float) else v) for k, v in BASE.items()},
                                  'risk_tier': tour_detail(nn_order)[1], 'late_share_p90': round(tour_detail(nn_order)[2], 3)},
    'candidates': candidates,
    'selection_weights_post_pareto': {'note': 'Pareto dulu, weights hanya utk memilih kandidat tampilan',
                                      'fastest': 'min t50', 'greenest': 'min co2', 'balanced': 'knee (min Chebyshev)'},
    'pareto_stats': {'generations': NGEN, 'population': POP, 'pareto_solutions': len(front),
                     'hypervolume': hv_series[-1], 'runtime_s': round(runtime, 1),
                     'engine': f'DEAP {__import__("deap").__version__} NSGA-II', 'seed': SEED},
    'convergence_hv': hv_series[::3] + [hv_series[-1]],
    'cs_m4': cs_m4,
    'leg_eta_source': 'M1 v2 dual-quantile (batch 272 pairs) + conformal delta; jarak = OSRM /table road distance',
    'distance_source': 'OSRM /table driving (public server) — real road-network distances',
}
DATA.write_text(json.dumps(out, ensure_ascii=True, indent=1), encoding="utf-8")

print("\n=== KANDIDAT (OSRM road distances) ===")
for c in candidates:
    v = c['vs_baseline']
    print(f"{c['route_id']} {c['label']:9s} | t50 {c['eta_p50_min']:6.1f}m | dist {c['distance_km']:5.1f}km | cost {c['cost_idr']/1e3:5.0f}k ({v['cost_pct']:+.1f}%) | "
          f"risk {c['sla_risk']:.3f} ({v['sla_risk_pct']:+.1f}%) | CO2 {c['co2_kg']:5.2f}kg ({v['co2_pct']:+.1f}%) | {c['risk_tier']} | late@P90 {c['late_stops_p90']}")
print(f"\ncs_m4={cs_m4} (stab {stab:.3f} · feas {feas:.2f}) | wrote {DATA.name} | total {time.time()-T0:.0f}s")
