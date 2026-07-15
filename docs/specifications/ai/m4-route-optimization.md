# Spec — M4 Route Optimization (NSGA-II, precomputed serving)

- **Status:** Implemented (precomputed) · run 14 Jul 2026 · di-serve sejak 15 Jul 2026
- **Bukti:** [`../../models/evidence/M4_RESULTS.md`](../../models/evidence/M4_RESULTS.md) · engine: `services/ai/experiments/m4_nsga2.py`
- **Desain lengkap:** [`../../models/M4_Route_Optimization.md`](../../models/M4_Route_Optimization.md)
- **Keputusan serving:** [ADR-004](../../architecture/adr/ADR-004-m4-precomputed.md)

## 1. Masalah

**VRPTW multi-objective** (Vehicle Routing Problem with Time Windows): cari assignment shipment ke
vehicle + urutan stop yang meminimalkan tiga objective sekaligus, sambil memenuhi constraint.

Output M4 **bukan satu rute terbaik** — melainkan **Pareto front**: himpunan rute dengan trade-off
berbeda antara biaya, risiko SLA, dan dampak lingkungan. Pemilihan akhir ada di M6 berdasarkan
konteks bisnis. Ini penting secara konseptual: M4 tidak berpura-pura tahu bobot bisnis; ia menyajikan
pilihan yang semuanya rasional.

## 2. Formulasi

### 2.1 Tiga objective (semua diminimalkan)

```
minimize F(x) = (f1(x), f2(x), f3(x))

f1(x) = total_operational_cost(x)
      = Σ_vehicle [distance(v) × cost_per_km(v) + driver_cost(v)]

f2(x) = total_sla_risk_score(x)
      = Σ_shipment [risk_penalty(s, ETA_predicted(s, x), deadline(s))]

f3(x) = total_environmental_cost(x)
      = Σ_vehicle [fuel_cost(v) + carbon_cost(M3(v))]
```

- `risk_penalty` — fungsi deterministik dari **M1** (CRITICAL = 3.0, WARNING = 1.0, SAFE = 0.0).
- `fuel_cost + carbon_cost` — dihitung dengan **M3** (EF distance-based: MC .029 / VAN .18 /
  CDE .32 / CDD .45 kg CO₂e/km).

Di run aktual (`jabodetabek_urban_sameday`), ketiganya diinstansiasi sebagai:
`cost_idr` · `sla_risk` (lateness ternormalisasi @arrival P90) · `co2_kg` (EF 0.18 × load factor).

### 2.2 Constraint — penalty, bukan objective

| Constraint | Penalty |
|---|---|
| Vehicle capacity | `+1000 × overload_kg` per vehicle (**linear** — batas keras) |
| Delivery time window | `+100 × late_minutes²` per shipment (**kuadratik**) |
| Driver hour limit | `+500 × overtime_minutes` per driver |

Time window memakai penalty **kuadratik** karena telat 2 menit dan telat 60 menit bukan pelanggaran
sejenis — yang kecil bisa ditoleransi, yang besar tidak. Kapasitas **linear** karena ia batas fisik:
tidak ada gradasi "sedikit kelebihan muatan".

Constraint sengaja **tidak** dijadikan objective tambahan — lihat §2.3.

### 2.3 Kenapa 3 objective (bukan 4, 5, atau 6)

Ini keputusan desain, bukan penyederhanaan karena kehabisan waktu.

NSGA-II kehilangan **selektivitas Pareto-dominance** di atas 3 objective — dikenal sebagai
**many-objective problem**. Di 4+ objective, hampir semua solusi menjadi non-dominated satu sama
lain → tekanan seleksi GA runtuh → konvergensi melambat, dan Pareto front berubah jadi "semua
solusi dianggap sama bagus" (yaitu: tidak informatif).

Konsolidasi yang diambil:

| | Objective | Verdict |
|---|---|---|
| Original | cost, travel time, fuel, CO₂, SLA risk (5) | many-objective → NSGA-II tidak cocok |
| **Final** | **cost, SLA risk, environmental (3)** | **sweet spot NSGA-II** |

Dua penggabungan kuncinya:
- **fuel + CO₂ → `environmental_cost`.** Keduanya bergerak **searah** (CO₂ = fungsi linear dari
  fuel). Memisahkannya **tidak menambah** diversitas Pareto front sama sekali — hanya membakar
  budget komputasi GA yang seharusnya dipakai mengeksplorasi trade-off yang **benar-benar konflik**
  (cost vs time vs SLA risk).
- **travel time → diserap ke SLA risk.** Waktu tempuh hanya penting sejauh ia melanggar deadline;
  itu persis yang diukur `sla_risk` lewat M1.

Kalau nanti perlu objective tambahan (driver fatigue, fairness antar driver), **upgrade ke NSGA-III**
wajib dipertimbangkan — bukan menambal NSGA-II.

### 2.4 Leg model (HYBRID) — dari mana "SLA-risk via M1" berasal

Penting untuk QnA, karena ini titik yang paling mudah disalahpahami:

- **Jadwal P50** — dari physics core yang konsisten dengan generator M1 (jarak/kecepatan-adjusted
  traffic & cuaca).
- **Band ketidakpastian P90 per-leg** — dari **rasio P90/P50 M1 v2** (batch 420 pasangan, sudah
  termasuk conformal δ).

Jadi klaim **"SLA-risk via M1" = true**: M1 menyumbang **interval terkalibrasi** yang mengubah
*jadwal* menjadi *risiko*. Yang **tidak** benar diklaim: bahwa M1 dipanggil per-leg saat GA berjalan.

## 3. Konfigurasi run (aktual)

| Parameter | Nilai |
|---|---|
| Engine | DEAP 1.4 NSGA-II |
| Populasi | 120 |
| Generasi | 150 |
| Seed | 42 |
| **Runtime** | **13.2 s** (CPU sandbox) |
| Skenario | `jabodetabek_urban_sameday` — Hub Cibitung (`HUB-CGK-02`), 16 stop, VAN 600 kg, hujan ringan, tour ≤ 480 m |
| Deadline | berstruktur: 30% ketat (150–240 m) / 70% longgar (260–470 m) |
| Handling | 3.5 m/stop |

## 4. Hasil vs baseline

Baseline: **nearest-neighbor distance-only** — praktik umum dispatch, bukan strawman.

| Plan | t50 | Cost | SLA-risk | CO₂ | Tier | Late@P90 |
|---|---|---|---|---|---|---|
| Baseline NN | 322m | 599k | 0.183 | 15.91 kg | CRITICAL | 4/16 |
| R-A Fastest | 306m (−16m) | +0.9% | −5.3% | +0.9% | CRITICAL | 4 |
| **R-B Balanced (Recommended)** | 327m | **+7.0%** | **−53.2%** | **+14.0%** | **WARNING** | **2** |
| R-C Greenest | 312m | −5.4% | +17.6% | −4.8% | CRITICAL | 5 |

**Kualitas front:** 17 solusi Pareto · **HV 0.664** · **`cs_m4` = 0.996**
(0.5·stabilitas-konvergensi + 0.5·feasibility-rate → masuk formula confidence M6, bobot 0.25).

**Acceptance Phase 2 ✅** — reduksi ≥15% di ≥1 objective tanpa memburuk >15% di objective lain:
SLA-risk **−53.2%**, cost **+7.0%** (<15%), CO₂ **+14.0%** (<15%).

Cara membaca R-B: menukar **+7% biaya** dengan **separuh risiko SLA** (late@P90 dari 4/16 → 2/16,
tier CRITICAL → WARNING). Itu trade-off yang akan diambil dispatcher mana pun — dan justru itu poinnya:
baseline tidak pernah menawarkan pilihan ini karena ia hanya melihat jarak.

**Seleksi kandidat = post-Pareto.** Pareto dijalankan dulu; label Fastest/Balanced/Greenest dipilih
**setelahnya** dengan guardrail vs baseline + eksklusi tour baseline. Konsisten dengan copy UI
"post-Pareto selection weights". Jangan dinarasikan seolah GA dijalankan tiga kali dengan bobot berbeda.

## 5. Serving

`GET /internal/m4/routes?scenario=jabodetabek_urban_sameday` → Pareto set precomputed dari
`services/ai/data/pareto_routes_jabodetabek_urban.json`, di-load sekali saat startup (**fail-fast**
kalau file hilang). Scenario tak dikenal → **404**.

Response memuat `candidates[]` (+ geometry), `cs_m4`, convergence HV series (untuk chart FE), dan
**`stop_arrivals`** per kandidat → agent bisa mengekstrak ETA per-shipment individual untuk `/decide`.

## 6. Batas precomputed (jujur)

1. **Satu skenario saja** — hanya `jabodetabek_urban_sameday`. Demo terikat padanya.
2. **Tidak reaktif** — Pareto set **tidak berubah** walau traffic/cuaca/dwell berubah. M2 dwell naik
   **tidak** mengoptimasi ulang rute; ia hanya memengaruhi M1 ETA. **Jangan pernah** dinarasikan
   sebagai "rute beradaptasi real-time".
3. **Fixed fleet & stop** — 16 stop, VAN 600 kg, hub tetap. Berubah = re-run offline.
4. **Tier level-tour ≠ tier per-shipment M1** — M4: SAFE <5% stop telat@P90 · WARNING 5–20% ·
   CRITICAL >20%. Jangan dicampur di UI copy.
5. **Klaim reduction baru dari SATU skenario.** Desain M4 §7.3 mensyaratkan pengukuran di **3
   skenario** supaya klaim tidak *cherry-picked*. Per 15 Jul 2026 baru ada satu (urban). Jadi angka
   −53.2% valid **untuk skenario ini**, dan belum boleh digeneralisasi jadi "M4 mengurangi SLA-risk
   53% secara umum". Dua skenario sisanya (mis. sub-urban, mixed-fleet) = backlog final.

## 7. Jalur ke real-time

Target **2.5 s** in-request: **warm-start** dari Pareto set tersimpan (bukan populasi acak) +
evaluasi **paralel** + **time-box** eksplisit dengan fallback ke solusi tersimpan kalau anggaran
habis. Properti "selalu ada jawaban" dipertahankan → degradasi anggun, sejalan failure cascade.
