# M4 — Route Optimization Engine (NSGA-II)

> **Model ID:** M4
> **Jenis:** Multi-objective metaheuristic (genetic algorithm)
> **Prioritas:** P0 (inti sistem)
> **Owner ML:** SLAra AI — Agent Engineer + Algorithm Engineer
> **Status desain:** Final — 3 objectives (konsolidasi dari 4 sesuai keputusan Bagian 7.2)

---

## 1. Ringkasan Eksekutif

M4 menyelesaikan **Vehicle Routing Problem with Time Windows (VRPTW)** multi-objective menggunakan **NSGA-II** (Non-dominated Sorting Genetic Algorithm II). Output M4 adalah **Pareto front** — himpunan rute yang berbeda trade-off antara biaya, waktu/SLA, dan dampak lingkungan — yang kemudian dipilih oleh Decision Agent M6 berdasarkan konteks bisnis.

Keputusan desain utama (resolusi Bagian 7.2): **konsolidasi 4 objective → 3 objective**. Fuel cost dan CO₂ digabung jadi satu objective `environmental_cost` karena keduanya bergerak searah (CO₂ = fungsi linear dari fuel). Memisahkan keduanya tidak menambah diversitas Pareto front, tapi membuang budget komputasi GA yang seharusnya bisa dipakai eksplorasi trade-off cost vs time vs SLA risk yang benar-benar konflik. Tiga objective adalah **sweet spot** NSGA-II sebelum perlu upgrade ke NSGA-III untuk many-objective problem.

---

## 2. Formulasi Matematis

### 2.1 Problem Statement

Diberikan:
- Set shipment `S = {s_1, s_2, ..., s_n}` dengan origin, destination, deadline, weight
- Set vehicle `V = {v_1, v_2, ..., v_m}` dengan capacity, vehicle_type, cost_per_km
- Set hub `H = {h_1, ..., h_k}` sebagai transit point
- Distance matrix `D` dari OSRM
- ETA prediction function `f_M1` dari M1
- Carbon calculation function `f_M3` dari M3

Cari: assignment shipment ke vehicle + urutan stop per vehicle yang **meminimalkan 3 objective** sambil memenuhi constraint.

### 2.2 Tiga Objective (Final)

```
minimize F(x) = (f1(x), f2(x), f3(x))

f1(x) = total_operational_cost(x)
      = Σ_vehicle [distance(v) × cost_per_km(v) + driver_cost(v)]

f2(x) = total_sla_risk_score(x)
      = Σ_shipment [risk_penalty(s, ETA_predicted(s, x), deadline(s))]

f3(x) = total_environmental_cost(x)
      = Σ_vehicle [fuel_cost(v) + carbon_cost(M3(v))]
```

Dimana:
- `risk_penalty` adalah fungsi deterministic dari M1 (CRITICAL=3.0, WARNING=1.0, SAFE=0.0) — konsisten dengan filosofi turunan rule-based
- `fuel_cost + carbon_cost` dihitung dengan M3 (lihat M3 §5)

### 2.3 Constraint (Bukan Objective)

Constraint ditangani lewat **penalty function**, bukan dimasukkan sebagai objective tambahan:

| Constraint | Penalty jika dilanggar |
|---|---|
| Vehicle capacity | `+1000 × overload_kg` per vehicle |
| Delivery time window | `+100 × late_minutes²` per shipment (kuadratik, scaling) |
| Driver hour limit | `+500 × overtime_minutes` per driver |

Penalty kuadratik untuk time window (bukan linear) karena pelanggaran kecil dapat ditoleransi, pelanggaran besar tidak. Penalty linear untuk kapasitas karena batas keras.

### 2.4 Mengapa 3 Objective (Bukan 4 atau 5)

Literatur optimasi multi-objective (Deb et al., yang kalian kutip di proposal) menunjukkan NSGA-II mulai kehilangan selektivitas Pareto-dominance di atas 3 objective — fenomena ini disebut **"many-objective problem"**. Di 4+ objective, hampir semua solusi non-dominated → seleksi GA tidak efektif → konvergensi lambat.

Dengan konsolidasi:
- Original: cost, travel time, fuel, CO₂, SLA risk (5 objektif) — many-objective, NSGA-II tidak cocok
- Setelah konsolidasi: cost, SLA risk, environmental (3 objektif) — sweet spot NSGA-II

Jika nanti perlu tambah objective (e.g., driver fatigue score, fairness antar driver), **upgrade ke NSGA-III** wajib dipertimbangkan (lihat §9 roadmap).

---

## 3. Chromosome Encoding

### 3.1 Representasi Permutation

**Pilihan:** permutasi urutan stop per route, representasi standar untuk VRP.

```
Chromosome = [route_1, route_2, ..., route_m]
route_i = [stop_1, stop_2, ..., stop_k]  (permutation of shipments assigned to vehicle i)
```

Contoh (3 vehicle, 8 shipment):
```
[ [s1, s3, s7], [s2, s5, s8], [s4, s6] ]
```

### 3.2 Decoder

Chromosome → fenotype (rute aktual) memerlukan decoder:
1. Untuk setiap `route_i`, urutan stop mengikuti permutasi
2. Tambahkan hub visits: pickup_origin → hub → delivery_destinations
3. Hitung distance aktual dengan OSRM
4. Hitung ETA setiap stop dengan M1
5. Hitung CO₂ setiap segment dengan M3
6. Hitung ketiga objective + penalty

Decoder ini dipanggil untuk setiap kromosom di setiap generasi → harus sangat cepat.

### 3.3 Inisialisasi Populasi

Strategi hybrid (bukan pure random):
- 20% populasi: solusi heuristik (nearest neighbor, savings algorithm)
- 20% populasi: solusi dari request sebelumnya (warm-start, lihat §8.2)
- 60% populasi: random permutation

Hybrid inisialisasi mempercepat konvergensi vs pure random.

---

## 4. Operator Genetik

### 4.1 Selection — Tournament Binary

```
tournament_size = 2
select kandidat1, kandidat2 random dari populasi
pilih yang lebih baik berdasarkan non-dominated sorting + crowding distance
```

### 4.2 Crossover — Order Crossover (OX)

Khusus untuk kromosom permutasi. OX mempertahankan urutan sebagian parent, sisanya diisi dari parent kedua dengan urutan yang konsisten.

```
parent1: [1, 2, 3, 4, 5, 6, 7, 8]
parent2: [3, 7, 5, 1, 6, 8, 2, 4]

cut points: index 2 dan 5

child: [?, ?, 3, 4, 5, ?, ?, ?]  ← middle from parent1
        fill remaining from parent2 order: 7, 1, 6, 8, 2, 4
        → [7, 1, 6, 3, 4, 5, 8, 2]
```

Crossover rate: 0.9 (default, tuning di §6).

### 4.3 Mutation — Swap + 2-opt

Dua operator mutation dirotasi:
- **Swap mutation** (50%): tukar 2 stop random dalam route
- **2-opt mutation** (50%): reverse segmen rute (lebih agresif escape local optima)

Mutation rate: 0.1 (default, tuning di §6).

### 4.4 Survival Selection — (μ + λ) with Crowding Distance

Populasi parent + offspring digabung, di-sort berdasarkan:
1. Non-dominated front (Pareto rank) — lower is better
2. Crowding distance (untuk solusi di front yang sama) — higher is better

Pilih N terbaik untuk generasi berikutnya.

### 4.5 Repair Operator (untuk constraint)

Jika offspring melanggar constraint hard (capacity), jalankan repair:
- Pindahkan shipment yang overload ke vehicle lain dengan kapasitas tersedia
- Jika tidak ada vehicle tersedia, tandai sebagai infeasible → penalty tinggi

Repair lebih efektif dari penalty saja di VRP dengan constraint ketat.

---

## 5. Benchmark & Dataset Sourcing

| Sumber | Peran | Link |
|---|---|---|
| Solomon VRPTW Benchmark (1987) | Standar de-facto untuk validasi VRPTW. 56 instance, best-known solution tersedia. Dipakai untuk **pembuktian korektnes algoritma** sebelum sentuh data Indonesia. | `neo.lcc.uma.es/vrp/vrp-instances` |
| CVRPLIB (Uchoa et al.) | Benchmark skala lebih besar (100–1000 customer) untuk stress-test performa GA di skala production. | `vrp.galgos.inf.puc-rio.br/index.php/en/` |
| Amazon Last-Mile Routing Research Challenge | Dataset rute nyata driver Amazon (5 kota AS, ribuan rute). Dipakai bukan untuk "benchmark optimal solution" tapi untuk **validasi realisme**: apakah rute hasil NSGA-II polanya masuk akal dibanding rute driver manusia berpengalaman. | `github.com/aws-samples/amazon-last-mile-routing-research-challenge` |
| OpenStreetMap (via OSRM/OSMnx) | Distance matrix riil untuk skenario Indonesia (Jabodetabek + intercity). | `project-osrm.org` |

### 5.1 Strategi Penggunaan Benchmark

```
Fase 1 — Validasi algoritma (minggu 3):
  Solomon R1_25 (25 customer, time window tight) → bandingkan dengan best-known
  Target: gap < 5% ke best-known, konvergensi dalam 100 generasi

Fase 2 — Stress test (minggu 4):
  Solomon R1_100 + CVRPLIB instance 100-customer → cek scalability
  Target: solusi feasible dalam 30 detik

Fase 3 — Validasi realisme (minggu 4-5):
  Amazon Last-Mile dataset → bandingkan pola rute (jumlah U-turn, backtracking)
  Target: rute NSGA-II tidak lebih buruk dari rute driver rata-rata

Fase 4 — Skenario Indonesia (minggu 5-6):
  Data sintetis Jabodetabek + intercity (origin/dest realistis, deadline 24-48 jam)
  Target: reduction 15-20% vs baseline distance-only
```

---

## 6. Tuning Workflow (GA Configuration, Bukan Gradient Training)

### 6.1 Tahapan

1. **Validasi di Solomon instance kecil (25-customer)** → cek convergence & compare ke best-known solution. Ini pembuktian korektnes algoritma, dilakukan sebelum sentuh data Indonesia.
2. **Tuning parameter GA**: population size, crossover rate, mutation rate, jumlah generasi. Pakai grid search kecil di 2-3 instance representatif.
3. **Terapkan ke skenario sintetis Indonesia** (OSM + BMKG + data sintetis shipment).

### 6.2 Default Parameter

```python
nsga2_config = {
    "population_size": 100,
    "n_generations": 200,
    "crossover_rate": 0.9,
    "mutation_rate": 0.1,
    "tournament_size": 2,
    "elite_preservation": True,
    "time_budget_seconds": 2.5,  # hard limit, lihat §8.1
}
```

### 6.3 Tuning Space (Grid Search)

| Parameter | Range | Default |
|---|---|---|
| population_size | {50, 100, 200} | 100 |
| n_generations | {100, 200, 500} | 200 |
| crossover_rate | {0.7, 0.8, 0.9} | 0.9 |
| mutation_rate | {0.05, 0.1, 0.2} | 0.1 |

3 × 3 × 3 × 3 = 81 kombinasi. Evaluasi di 3 Solomon instance, pilih parameter dengan trade-off terbaik (hypervolume + konvergensi time).

---

## 7. Validasi & Metrik

### 7.1 Hypervolume Indicator (Primary)

Metrik standar untuk kualitas Pareto front multi-objective. Sudah muncul di mockup dashboard kalian ("Hypervolume 0.84") — metrik yang tepat.

```
Hypervolume = volume of objective space dominated by Pareto front
            (relatif ke reference point)
```

| Metrik | Target |
|---|---|
| Hypervolume | ≥ 0.80 (skala 0–1, normalisasi ke reference point worst-case) |

Hipervolume di-monitor selama GA berjalan — konvergensi ditandai dengan stabilisasi nilai.

### 7.2 Gap ke Best-Known Solution (Solomon)

```
gap = (objective_NSGA2 - best_known) / best_known × 100%
```

| Metrik | Target |
|---|---|
| Gap ke best-known (Solomon single-objective relaxation) | < 5% |

### 7.3 Reduction vs Baseline (Wajib Multi-Skenario)

Klaim 15-20% reduction vs distance-only baseline **tidak boleh cherry-picked dari satu skenario**. Ukur di 3 skenario berbeda:

| Skenario | Karakteristik | Target Reduction |
|---|---|---|
| Urban dense (Jabodetabek, 50 stop, jarak pendek, traffic tinggi) | SLA risk dominan | ≥ 15% |
| Intercity (Surabaya-Malang, 20 stop, jarak jauh, kapasitas truck besar) | Cost dominan | ≥ 15% |
| Mixed (Jabodetabek + intercity, 80 stop, vehicle mix) | Trade-off kompleks | ≥ 18% |

Klaim "kami mengurangi X% rute" hanya credible jika ditampilkan dengan multi-skenario breakdown seperti tabel di atas.

### 7.4 Convergence Plot

Plot hypervolume vs generasi untuk setiap run. Konvergensi sehat:
- Kurva naik cepat di 50 generasi pertama
- Plateau di 100-150 generasi
- Tidak ada degradasi (overfit ke generasi terakhir)

---

## 8. Inference & Deployment (Best Practice Runtime)

### 8.1 Runtime Budget Hard Limit — Time-Boxed Execution

Target dashboard P95 < 3 detik. M4 mendominasi budget (~2.0-2.5 detik). Maka:

```python
# Pseudocode time-boxed NSGA-II
def run_nsga2(problem, time_budget=2.5):
    population = initialize()
    start_time = time.now()
    generation = 0
    while time.now() - start_time < time_budget:
        offspring = crossover_and_mutate(population)
        population = select_next_gen(population + offspring)
        generation += 1
    return pareto_front(population)
```

**Stop di N generasi ATAU T detik, mana yang lebih dulu tercapai.** Bukan fixed generation count — fixed count bisa kelewatan time budget di instance besar.

### 8.2 Warm-Start — Reuse Previous Solution

```
Request: shipment set S_request
Cari di cache: request serupa sebelumnya (similarity > 0.8 by origin/dest cluster)
  HIT: ambil Pareto front sebelumnya sebagai 20% initial population
  MISS: gunakan heuristic init (nearest neighbor, savings)
```

Signifikan mempercepat convergence (literatur: 30-50% lebih sedikit generasi ke plateau).

### 8.3 Caching

| Cache Key | TTL | Invalidate |
|---|---|---|
| `m4:route:{origin_hub_dest_hash}` | 1 jam | Perubahan traffic/weather signifikan |
| `m4:pareto_front:{request_signature}` | 5 menit | Perubahan shipment set |
| `m4:warm_start:{cluster_id}` | 24 jam | Perubahan vehicle fleet |

### 8.4 Parallelization

Evaluasi kromosom dalam satu generasi dapat di-parallel-kan (embarrassingly parallel):
- `multiprocessing.Pool` untuk CPU-bound
- Population size 100 → 4 worker → ~3-4× speedup
- Hindari `threading` (Python GIL tidak membantu untuk CPU-bound)

### 8.5 Library Choice

| Library | Pros | Cons | Status |
|---|---|---|---|
| **DEAP** (Python) | Mature, NSGA-II built-in, fleksibel | Lebih lambat dari C++ | ✅ Pilihan untuk MVP |
| pymoo | API modern, benchmark terupdate | Komunitas lebih kecil | Alternatif |
| OR-Tools (Google) | C++ backend, sangat cepat | Tidak fleksibel untuk multi-objective custom | Untuk single-objective comparison |
| Custom C++ | Performance tertinggi | Development time tinggi | Roadmap production |

---

## 9. Roadmap — NSGA-III untuk Many-Objective

### 9.1 Kapan Upgrade

Upgrade ke NSGA-III jika **salah satu** kondisi terpenuhi:

- [ ] Tim business ingin tambah objective ke-4 (e.g., driver fairness, customer satisfaction score)
- [ ] Hypervolume tidak improve meski populasi dinaikkan ke 500+
- [ ] Pareto front terlalu padat (terlalu banyak solusi non-dominated) → seleksi tidak efektif

### 9.2 Perbedaan NSGA-II vs NSGA-III

| Aspek | NSGA-II | NSGA-III |
|---|---|---|
| Seleksi | Crowding distance (Euclidean di objective space) | Reference point-based |
| Cocok untuk | 2-3 objective | 4+ objective (many-objective) |
| Kompleksitas | O(MN²) | O(MN²) tapi dengan reference points |
| Implementasi | DEAP support native | DEAP support, pymoo lebih baik |

### 9.3 Migration Plan

1. Replicate hasil NSGA-II di NSGA-III dengan 3 objective → harus konvergen ke solusi serupa (sanity check)
2. Tambah objective ke-4 (driver fairness) → bandingkan hypervolume
3. Decision: jika improvement > 5%, switch ke NSGA-III

---

## 10. Risiko & Mitigasi

| Risiko | Severity | Mitigasi |
|---|---|---|
| GA tidak konvergen di instance besar (>100 customer) | Tinggi | Time-boxed execution + warm-start; dokumentasikan batas skala |
| Solusi infeasible (constraint violation) lolos | Tinggi | Repair operator + penalty kuadratik + post-check di decoder |
| Pareto front terlalu kecil (kurang diversitas) | Sedang | Hybrid inisialisasi + mutation 2-opt + crowding distance preservation |
| Warm-start cache stale (request mirip tapi kondisi traffic beda) | Sedang | Cache invalidate pada traffic_index delta > 20% |
| Profiling menunjukkan bottleneck di decoder | Sedang | Vectorize dengan NumPy; precompute distance matrix; profile dengan cProfile |
| Demo gagal karena latency melebihi 3 detik | Tinggi | Hard time-budget 2.5s + fallback ke cached solution jika timeout |

---

## 11. Acceptance Criteria (untuk demo kompetisi)

- [ ] Validasi di Solomon R1_25 dengan gap < 5% ke best-known
- [ ] Hypervolume ≥ 0.80 di skenario sintetis Indonesia
- [ ] Reduction ≥ 15% vs baseline di ketiga skenario (urban/intercity/mixed) — bukan satu skenario cherry-picked
- [ ] Latency P95 end-to-end M4 < 2.5 detik (time-boxed)
- [ ] Warm-start aktif dan terukur improve konvergensi
- [ ] Convergence plot ditampilkan di laporan
- [ ] Tiga objective (bukan 4) — konsolidasi fuel+CO₂ jelas didokumentasikan
- [ ] Narasi "kapan upgrade ke NSGA-III" ada di roadmap §9
- [ ] Integrasi dengan M1 (ETA sebagai input objective f2) terverifikasi
- [ ] Integrasi dengan M3 (carbon sebagai input objective f3) terverifikasi

---

**Referensi internal:** M1 (ETA prediction untuk risk score objective), M3 (carbon calculation untuk environmental objective), M6 (Decision Agent memilih dari Pareto front), Dashboard (hypervolume + Pareto visualization).
