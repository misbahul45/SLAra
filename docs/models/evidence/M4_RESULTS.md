# M4 — NSGA-II Route Optimization: Hasil & Bukti (14 Jul 2026)

## Konfigurasi
- Engine: DEAP 1.4 NSGA-II · pop 120 · 150 generasi · seed 42 · runtime 13.2s (CPU sandbox)
- Skenario: `jabodetabek_urban_sameday` — Hub Cibitung (HUB-CGK-02), 16 stop, VAN 600kg,
  hujan ringan, deadline berstruktur (30% ketat 150–240m / 70% longgar 260–470m), tour ≤ 480m
- Objectives (min): cost_idr · sla_risk (lateness ternormalisasi @arrival P90) · co2_kg (M3 rule EF 0.18 kg/km × load factor)
- Constraints: kapasitas kendaraan, durasi tour (penalty), handling 3.5 m/stop
- Leg model (HYBRID — penting utk QnA): jadwal P50 dari physics core yang konsisten dengan
  generator M1 (jarak/kecepatan-adjusted traffic & cuaca); band ketidakpastian P90 per-leg dari
  RASIO P90/P50 M1 v2 (batch 420 pasangan, conformal δ termasuk). Klaim "SLA-risk via M1" = true:
  M1 menyumbang interval terkalibrasi yang mengubah jadwal jadi risiko.

## Hasil vs baseline (nearest-neighbor distance-only, praktik umum dispatch)
| Plan | t50 | Cost | SLA-risk | CO2 | Tier | Late@P90 |
|---|---|---|---|---|---|---|
| Baseline NN | 322m | 599k | 0.183 | 15.91kg | CRITICAL | 4/16 |
| R-A Fastest | 306m (−16m) | +0.9% | −5.3% | +0.9% | CRITICAL | 4 |
| **R-B Balanced (Recommended)** | 327m | **+7.0%** | **−53.2%** | **+14.0%** | **WARNING** | **2** |
| R-C Greenest | 312m | −5.4% | +17.6% | −4.8% | CRITICAL | 5 |

## Acceptance (plan Phase 2)
- ✅ Reduction ≥15% di ≥1 objective tanpa memburuk >15% di lainnya → Balanced: risk −53.2%, cost +7.0% (<15%), CO2 +14.0% (<15%)
- ✅ Runtime tercatat · ✅ 3 kandidat + geometry + arrival per-stop · ✅ convergence HV series utk chart FE
- Pareto: 17 solusi · HV 0.664 · cs_m4 = 0.996 (0.5·stabilitas-konvergensi + 0.5·feasibility-rate — formula utk M6)

## Catatan jujur (WAJIB masuk narasi/spec)
1. PRECOMPUTED untuk demo (ADR-004). Runtime 13.2s di CPU; production path: warm-start + paralel + time-box 2.5s.
2. Tier level-tour: SAFE <5% stop telat@P90 · WARNING 5–20% · CRITICAL >20% (beda dgn tier per-shipment M1 — jangan dicampur di UI copy).
3. Seleksi kandidat = post-Pareto (Pareto dulu, label Fastest/Balanced/Greenest dipilih dengan guardrail vs baseline & eksklusi tour baseline). Konsisten dgn label "post-Pareto selection weights" di UI.
4. `stop_arrivals` per kandidat tersedia → agent bisa ekstrak ETA per-shipment individual utk /decide.
