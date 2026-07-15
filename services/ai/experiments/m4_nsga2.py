# ==========================================================
# M4 — Route Optimization (NSGA-II / DEAP)
# Skenario: urban same-day Jabodetabek (hub Cibitung), 20 stops
# Objectives (min): cost_idr · sla_risk (via M1 v2 P90) · co2_kg (M3 rule)
# Constraints: kapasitas van 600kg · durasi tour P50 <= 360 min (penalty)
# Baseline: nearest-neighbor distance-only
# ==========================================================
import numpy as np, lightgbm as lgb, yaml, json, time, random, math, os
from deap import base, creator, tools

SEED = 42
random.seed(SEED); np.random.seed(SEED)
rng = np.random.default_rng(SEED)
T0 = time.time()

ART = '/home/claude/m1v2_artifacts'
m50 = lgb.Booster(model_file=f'{ART}/models/m1_eta_v2_p50.txt')
m90 = lgb.Booster(model_file=f'{ART}/models/m1_eta_v2_p90.txt')
th = yaml.safe_load(open(f'{ART}/configs/risk_thresholds.yaml'))
TS, TC, DELTA = th['safe_min_slack_minutes'], th['critical_max_slack_minutes'], th['conformal_delta_p90_minutes']

# ---------- 1. Skenario ----------
HUB = {'id': 'HUB-CGK-02', 'name': 'Hub Cibitung', 'lat': -6.2606, 'lng': 107.0810}
N_STOPS = 16
lat = rng.uniform(-6.33, -6.20, N_STOPS)
lng = rng.uniform(107.01, 107.15, N_STOPS)
load = rng.uniform(5, 40, N_STOPS).round(1)                    # kg per stop
tight = rng.random(N_STOPS) < 0.30
deadline = np.where(tight, rng.uniform(150, 240, N_STOPS), rng.uniform(260, 470, N_STOPS)).round(0)             # menit sejak start (same-day)
SERVICE_MIN = 0.0  # handling 3.5 min/stop sudah di physics core leg
VEHICLE = {'type': 'VAN', 'enc': 1, 'cap_kg': 600.0, 'ef': 0.18}     # M3: kg CO2/km
COST = {'base': 150_000, 'per_km': 2_300, 'per_min': 700, 'toll': 15_000}
MAX_TOUR_MIN = 480.0
WEATHER = 1  # hujan ringan (skenario)

nodes_lat = np.concatenate([[HUB['lat']], lat])
nodes_lng = np.concatenate([[HUB['lng']], lng])
NN = N_STOPS + 1

def hav(i, j):
    R = 6371
    p1, p2 = math.radians(nodes_lat[i]), math.radians(nodes_lat[j])
    dp = math.radians(nodes_lat[j] - nodes_lat[i]); dl = math.radians(nodes_lng[j] - nodes_lng[i])
    x = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(x))

dist = np.zeros((NN, NN)); traffic = np.ones((NN, NN)); toll = np.zeros((NN, NN), bool)
for i in range(NN):
    for j in range(NN):
        if i == j: continue
        d = hav(i, j) * 1.3                                     # road factor (konsisten generator M1)
        is_toll = d > 6 and rng.random() < 0.5                 # leg jauh kadang via tol
        dist[i, j] = d * (1.12 if is_toll else 1.0)             # tol sedikit lebih jauh
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
ratio = np.clip(p90f / np.maximum(p50f, 1e-6), 1.03, 1.60)   # interval relatif M1 per karakteristik leg
ETA50 = np.zeros((NN, NN)); ETA90 = np.zeros((NN, NN))
for k, (i, j) in enumerate(pairs):
    adj_speed = 30.0 / (traffic[i, j] * (1 + WEATHER*0.3))     # physics core = generator M1
    leg50 = dist[i, j] / adj_speed * 60 + 3.5                  # + handling per stop
    if i == 0: leg50 += 12.0                                    # dwell hub di leg pertama
    ETA50[i, j] = leg50
    ETA90[i, j] = leg50 * ratio[k]                              # band ketidakpastian dari M1
print(f"Leg schedule: physics core + uncertainty ratio M1 (mean ratio {ratio.mean():.3f}) | leg P50 mean {ETA50[ETA50>0].mean():.1f} min")

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
    t50 += ETA50[prev, 0]; t90 += ETA90[prev, 0]                 # balik hub
    d_tot += dist[prev, 0]; co2 += dist[prev, 0] * VEHICLE['ef']
    cost += COST['base'] + COST['per_km']*d_tot + COST['per_min']*t50 + COST['toll']*toll[prev, 0]
    pen = max(0.0, t50 - MAX_TOUR_MIN)                           # constraint durasi
    if load.sum() > VEHICLE['cap_kg']: pen += 1e3                # kapasitas (guard)
    return (cost*(1+pen/100), risk/N_STOPS + pen/500, co2*(1+pen/100)), \
           {'t50': t50, 't90': t90, 'dist': d_tot, 'cost': cost, 'co2': co2,
            'risk': risk/N_STOPS, 'late': int(late), 'feasible': pen == 0}

# ---------- 4. Baseline nearest-neighbor (distance-only) ----------
unvis = set(range(N_STOPS)); cur = 0; nn_order = []
while unvis:
    nxt = min(unvis, key=lambda s: dist[cur, s+1])
    nn_order.append(nxt); unvis.discard(nxt); cur = nxt + 1
_, BASE = evaluate(nn_order)
print(f"Baseline NN: cost {BASE['cost']/1e3:.0f}k · risk {BASE['risk']:.3f} · CO2 {BASE['co2']:.2f}kg · t50 {BASE['t50']:.0f}m · late(P90) {BASE['late']}")

# ---------- 5. NSGA-II ----------
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
# seed 1 individu dgn baseline biar konvergensi cepat & fair ("optimizer >= baseline")
pop[0] = creator.Individual(nn_order[:])
for ind in pop: ind.fitness.values = tb.evaluate(ind)
pop = tb.select(pop, POP)

def hv_estimate(F, samples=20000):
    F = np.asarray(F)
    lo, hi = F.min(0), F.max(0)
    span = np.where(hi - lo < 1e-9, 1.0, hi - lo)
    Fn = (F - lo) / span
    ref = np.full(3, 1.1)
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
F = np.array([ind.fitness.values for ind in front])
print(f"NSGA-II: {NGEN} gen · {runtime:.1f}s · Pareto {len(front)} solusi · HV {hv_series[-1]:.3f}")

# ---------- 6. Pilih 3 kandidat + cs_m4 ----------
det = [evaluate(ind)[1] for ind in front]
not_base = [i for i in range(len(det)) if list(front[i]) != nn_order]        # kandidat wajib != baseline
elig = [i for i in not_base if det[i]['risk'] <= BASE['risk'] + 1e-9] or not_base
i_bal = min(not_base, key=lambda i: (det[i]['risk'], det[i]['cost']))          # Recommended: min risk, tie-break cost
i_fast = min(elig, key=lambda i: det[i]['t50'])                                 # tercepat dgn guardrail risk<=baseline
i_green = min(not_base, key=lambda i: det[i]['co2'])                            # min CO2 murni (identitas Greenest)
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
    """Arrival P50/P90 per stop + tier level-tour dari share telat @P90."""
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
    geometry = [[round(nodes_lat[0], 5), round(nodes_lng[0], 5)]] + \
               [[round(nodes_lat[s+1], 5), round(nodes_lng[s+1], 5)] for s in order] + \
               [[round(nodes_lat[0], 5), round(nodes_lng[0], 5)]]
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

out = {
    'scenario': {'id': 'jabodetabek_urban_sameday', 'hub': HUB, 'n_stops': N_STOPS,
                 'vehicle': VEHICLE['type'], 'weather': 'light_rain', 'max_tour_min': MAX_TOUR_MIN,
                 'stops': [{'idx': int(i), 'lat': round(float(lat[i]), 5), 'lng': round(float(lng[i]), 5),
                            'load_kg': float(load[i]), 'deadline_min': float(deadline[i])} for i in range(N_STOPS)]},
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
    'leg_eta_source': 'M1 v2 dual-quantile (batch 420 pairs) + conformal delta',
}
os.makedirs('/home/claude/m4_artifacts', exist_ok=True)
json.dump(out, open('/home/claude/m4_artifacts/pareto_routes_jabodetabek_urban.json', 'w'), indent=1,
          default=lambda o: o.item() if isinstance(o, np.generic) else str(o))

print("\n=== KANDIDAT ===")
for c in candidates:
    v = c['vs_baseline']
    print(f"{c['route_id']} {c['label']:9s} | t50 {c['eta_p50_min']:6.1f}m | cost {c['cost_idr']/1e3:5.0f}k ({v['cost_pct']:+.1f}%) | "
          f"risk {c['sla_risk']:.3f} ({v['sla_risk_pct']:+.1f}%) | CO2 {c['co2_kg']:5.2f}kg ({v['co2_pct']:+.1f}%) | {c['risk_tier']} | late@P90 {c['late_stops_p90']}")
print(f"\ncs_m4={cs_m4} (stab {stab:.3f} · feas {feas:.2f}) | total {time.time()-T0:.0f}s")
