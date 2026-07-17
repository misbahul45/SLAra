# M4 — NSGA-II Route Optimization: Hasil & Bukti (14 Jul 2026)

## Konfigurasi
- Engine: DEAP 1.4 NSGA-II · pop 120 · 150 generasi · seed 42 · runtime 9.5s (CPU)
- Skenario: `jabodetabek_urban_sameday` — Hub Cibitung (HUB-CGK-02), 16 stop, VAN 600kg,
  hujan ringan, deadline berstruktur (di-rescale ×1.257 ke basis-waktu jarak-jalan), tour ≤ 480m
- **Jarak antar-stop = OSRM `/table` (jarak jalan NYATA)** — bukan haversine×1.3 (revisi 16 Jul 2026,
  lihat ADR-004). Generator: `services/ai/experiments/m4_nsga2_osrm.py`.
- Objectives (min): cost_idr · sla_risk (lateness ternormalisasi @arrival P90) · co2_kg (M3 rule EF 0.18 kg/km × load factor)
- Constraints: kapasitas kendaraan, durasi tour (penalty), handling 3.5 m/stop
- Balanced = **knee Pareto** (min Chebyshev pada 3 objektif ter-normalisasi).
- Leg model (HYBRID — penting utk QnA): jadwal P50 dari physics core yang konsisten dengan
  generator M1 (jarak-jalan OSRM/kecepatan-adjusted traffic & cuaca); band ketidakpastian P90 per-leg dari
  RASIO P90/P50 M1 v2 (batch 272 pasangan, conformal δ termasuk). Klaim "SLA-risk via M1" = true:
  M1 menyumbang interval terkalibrasi yang mengubah jadwal jadi risiko.

## Hasil vs baseline (nearest-neighbor distance-only, praktik umum dispatch)
| Plan | t50 | Cost | SLA-risk | CO2 | Tier | Late@P90 |
|---|---|---|---|---|---|---|
| Baseline NN | 405m | 806k | 0.245 | 25.14kg | CRITICAL | 6/16 |
| R-A Fastest | 386m (−19m) | −5.8% | −29.9% | −4.6% | CRITICAL | 5 |
| **R-B Balanced (Recommended)** | 420m | **+8.6%** | **−48.2%** | **+11.8%** | **WARNING** | **3** |
| R-C Greenest | 389m | +0.1% | −32.8% | +0.6% | CRITICAL | 4 |

## Acceptance (plan Phase 2)
- ✅ Reduction ≥15% di ≥1 objective tanpa memburuk >15% di lainnya → Balanced: risk −48.2%, cost +8.6% (<15%), CO2 +11.8% (<15%)
- ✅ Runtime tercatat · ✅ 3 kandidat + geometry + road_geometry + arrival per-stop · ✅ convergence HV series utk chart FE
- Pareto: 12 solusi · HV 0.527 · cs_m4 = 0.856 (0.5·stabilitas-konvergensi + 0.5·feasibility-rate — formula utk M6)

## Catatan jujur (WAJIB masuk narasi/spec)
1. PRECOMPUTED untuk demo (ADR-004). Runtime 9.5s di CPU; production path: warm-start + paralel + time-box 2.5s. Jarak jalan OSRM dipanggil build-time, bukan runtime.
2. Tier level-tour: SAFE <5% stop telat@P90 · WARNING 5–20% · CRITICAL >20% (beda dgn tier per-shipment M1 — jangan dicampur di UI copy).
3. Seleksi kandidat = post-Pareto (Pareto dulu, label Fastest/Balanced/Greenest dipilih dengan guardrail vs baseline & eksklusi tour baseline). Konsisten dgn label "post-Pareto selection weights" di UI.
4. `stop_arrivals` per kandidat tersedia → agent bisa ekstrak ETA per-shipment individual utk /decide.
