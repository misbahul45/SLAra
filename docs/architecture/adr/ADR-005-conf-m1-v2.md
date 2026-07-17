# ADR-005 — Kalibrasi `conf_m1` v2 (interval × deadline certainty)

- **Status:** Accepted
- **Tanggal:** 2026-07-16
- **Konteks plan:** Phase 3 (M6 di `agent`)
- **Terkait:** [ADR-002](ADR-002-m6-deterministic-core.md) · `services/agent/src/config.ts` · `services/agent/src/domain/confidence.ts` · `docs/specifications/agent/m6-orchestration.md`

## Konteks

Confidence M6 adalah jumlah tertimbang lima komponen (lihat
[m6-orchestration](../../specifications/agent/m6-orchestration.md)); `conf_m1`
memegang bobot terbesar (0.40). Formula desain awal `conf_m1` hanya mengukur
**lebar interval prediksi**:

```
conf_m1 = 1 − min(1, (P90 − P50) / (2 · ETA))          # desain lama
```

Masalah yang muncul saat perakitan M6: interval P90−P50 dari M1 v2 relatif rapat
untuk hampir semua shipment (model-nya memang kalibrated), sehingga `conf_m1`
**macet di sekitar 0.9** berapa pun tekanan deadline-nya. Karena bobotnya 0.40,
confidence agregat nyaris tak pernah turun di bawah threshold 0.70 → **eskalasi
tak pernah terpicu**. Ini melanggar guardrail desain M6 bahwa escalation rate
harus berada di band sehat **5–20%** (kalau 0%, human-in-the-loop cuma hiasan).

Akar soal: interval yang rapat berarti model **yakin pada angka ETA-nya**, bukan
berarti **shipment-nya aman**. Sebuah ETA P90 yang presisi tapi melewati deadline
seharusnya menurunkan confidence, bukan menaikkannya. Formula lama buta terhadap
deadline.

## Keputusan

**`conf_m1` v2 = interval_certainty × deadline_certainty.** Kedua sub-term
diekspos di `confidence_breakdown.conf_m1.detail` supaya transparan — bukan
black-box.

```
interval_certainty = 1 − min(1, (P90 − P50) / (2 · P50))     # term lama, dipertahankan
deadline_certainty = σ(slack_p90 / 30)                        # BARU; σ = sigmoid
conf_m1            = clamp(interval_certainty × deadline_certainty, 0, 1)
```

`slack_p90 = promised_deadline − eta_p90` (menit). Slack negatif (ETA P90 lewat
deadline) menekan `deadline_certainty` ke bawah 0.5 dengan cepat; slack besar
positif mendorongnya ke 1. Skala sigmoid **30 menit** (`slackSigmoidScaleMin`)
mengatur seberapa tajam responnya.

Analog untuk `conf_m2` (bobot 0.15), supaya kongesti hub juga menekan confidence:

```
situational_certainty = exp(−max(0, dwell_p90 − 45) / 40)     # toleransi operasional 45 mnt
conf_m2               = clamp(model_health × situational_certainty, 0, 1)
```

Semua konstanta terpusat di `services/agent/src/config.ts`
(`slackSigmoidScaleMin: 30`, `dwellToleranceMin: 45`, `dwellDecayMin: 40`).

## Konsekuensi

- **Eskalasi hidup kembali dan terkalibrasi.** Verifikasi E2E 12 shipment: 2
  eskalasi = **16.7%**, di dalam band 5–20%. Yang tereskalasi (SHP-2026-00403,
  -00408) adalah shipment dengan slack tipis @P90 di hub padat — persis yang
  seharusnya butuh mata manusia.
- **`primary_uncertainty_driver` jadi bisa dibedakan.** Saat `conf_m1` komponen
  terlemah, driver dilaporkan `deadline_pressure` (kalau deadline_certainty <
  interval_certainty) atau `wide_eta_interval` (sebaliknya). Ini yang membuat
  banner eskalasi SHP-00403 menuduh "deadline_pressure", bukan sekadar
  "low confidence".
- **Σ(value × weight) tetap == confidence PERSIS.** Sub-term hanya menjelaskan
  bagaimana `conf_m1.value` dihitung; agregasi tetap dari `value × weight`, jadi
  juri masih bisa memverifikasi angka dari layar. Teruji di
  `tests/confidence.test.ts` (6 pass).
- **Bukan tuning ke angka target.** Formula diturunkan dari akar masalah
  (deadline buta), lalu angka 0.864/0.686 muncul konsisten dengan rekaman sandbox
  di `services/agent/README.md` — bukan sebaliknya.

> **Addendum 17 Jul 2026:** setelah `distance_km` fixture disinkronkan ke jarak jalan
> nyata OSRM (drift s.d. +4.1 km), confidence bergeser: 00400 → **0.810**, 00403 →
> **0.646**, 00408 → **0.638**. **Escalation rate tetap 2/12 = 16.7%** dan yang
> tereskalasi tetap 00403 & 00408 — kalibrasi formula bertahan pada input yang lebih
> jujur, menguatkan klaim "bukan tuning ke angka target". Angka aktual: spec
> m6-orchestration §6.

## Alternatif yang ditolak

- **Naikkan threshold di atas 0.70** supaya eskalasi terpicu: menyembunyikan
  gejala, bukan sebabnya — confidence tetap tak sensitif terhadap deadline.
- **Turunkan bobot `conf_m1`:** memindahkan masalah ke komponen lain; deadline
  tetap tak masuk formula.
- **Threshold pada slack langsung (bukan lewat confidence):** memecah jalur
  keputusan jadi dua aturan paralel (confidence + aturan slack), padahal desain
  M6 menghendaki satu skor tunggal yang bisa diverifikasi. Sigmoid melipat slack
  ke dalam skor yang sama.
