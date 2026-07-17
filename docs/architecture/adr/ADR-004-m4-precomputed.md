# ADR-004 — M4 di-serve precomputed untuk demo (NSGA-II tetap engine aslinya)

- **Status:** Accepted
- **Tanggal:** 2026-07-15
- **Konteks plan:** Phase 0 (keputusan) · Phase 2 (M4 dikerjakan)
- **Bukti:** [`docs/models/evidence/M4_RESULTS.md`](../../models/evidence/M4_RESULTS.md) · engine: `services/ai/experiments/m4_nsga2.py`
- **Terkait:** [`docs/specifications/ai/m4-route-optimization.md`](../../specifications/ai/m4-route-optimization.md) · `docs/contracts/rest/v1.md` §B-bis

## Konteks

M4 mengoptimasi rute multi-objective dengan NSGA-II. Angka **aktual** dari run 14 Jul 2026
(bukan estimasi):

- Engine **DEAP 1.4 NSGA-II** · populasi **120** · **150 generasi** · seed **42**
- **Runtime 13.2 detik** (CPU sandbox) untuk skenario `jabodetabek_urban_sameday`
  (Hub Cibitung `HUB-CGK-02`, 16 stop, VAN 600 kg, hujan ringan, tour ≤ 480 menit)
- Hasil: **17 solusi Pareto** · **HV 0.664** · **cs_m4 = 0.996**

Anggaran latency `/decide` (desain M6): **~2 detik**. Runtime M4 **13.2 detik** — yaitu **~6,6×
lebih besar dari seluruh anggaran** satu keputusan, bukan hanya bagiannya. Menjalankan NSGA-II
in-request akan melanggar anggaran latency secara telak dan membuat demo terlihat menggantung.

## Keputusan

**Untuk demo, M4 di-serve sebagai Pareto set precomputed** dari
`services/ai/data/pareto_routes_jabodetabek_urban.json`, di-load sekali saat startup dan
di-serve lewat **`GET /internal/m4/routes?scenario=jabodetabek_urban_sameday`**.

**NSGA-II tetap engine aslinya** — bukan diganti heuristik. Yang berubah hanya *kapan* ia dijalankan
(offline, bukan in-request). Kode engine ikut ter-commit di `services/ai/experiments/m4_nsga2.py`
sebagai **bukti**, dengan status eksplisit: *bukan runtime path*.

Konsekuensi kontrak: endpoint jadi **GET + query** (tidak ada body request), menyimpang dari §B asli
yang menulis `POST /internal/m4/routes`. Tercatat di `docs/contracts/rest/v1.md` §B-bis dan
`docs/contracts/CHANGELOG.md`.

## Alasan

1. **Anggaran latency.** 13.2 s vs ~2 s. Tidak ada tuning yang menutup jarak ini dalam sisa waktu.
2. **Hasilnya identik.** Pareto set yang di-serve adalah keluaran nyata NSGA-II dengan seed 42 —
   bukan aproksimasi, bukan mock. Yang dikorbankan hanya *kebaruan per-request*, bukan *kualitas*.
3. **Demo deterministik.** Seed tetap + hasil tersimpan = angka yang sama tiap kali. Sejalan dengan
   ADR-002 (M6 deterministik) dan membuat demo bisa diulang.
4. **Bukti > klaim.** Run log, convergence HV series, dan skrip engine ter-commit, jadi klaim
   "NSGA-II beneran" bisa diverifikasi reviewer tanpa harus percaya narasi.

## Angka yang di-serve (aktual, dari M4_RESULTS.md)

Baseline pembanding: **nearest-neighbor distance-only** (praktik umum dispatch).

Baseline pembanding: **nearest-neighbor distance-only** (praktik umum dispatch).
Jarak antar-stop = **jarak jalan nyata OSRM `/table`** (bukan haversine×1.3 — lihat catatan
revisi di bawah). Balanced = **knee Pareto** (min Chebyshev pada 3 objektif ter-normalisasi).

| Plan | t50 | Cost | SLA-risk | CO₂ | Tier | Late@P90 |
|---|---|---|---|---|---|---|
| Baseline NN | 405m | 806k | 0.245 | 25.14 kg | CRITICAL | 6/16 |
| R-A Fastest | 386m (−19m) | −5.8% | −29.9% | −4.6% | CRITICAL | 5 |
| **R-B Balanced (Recommended)** | 420m | **+8.6%** | **−48.2%** | **+11.8%** | **WARNING** | **3** |
| R-C Greenest | 389m | +0.1% | −32.8% | +0.6% | CRITICAL | 4 |

**Acceptance Phase 2 terpenuhi:** reduksi ≥15% di ≥1 objective tanpa memburuk >15% di objective lain
→ Balanced: SLA-risk **−48.2%** (≥15% ✅), cost **+8.6%** (<15% ✅), CO₂ **+11.8%** (<15% ✅).

**Untuk M6:** `cs_m4 = 0.856` (0.5·stabilitas-konvergensi + 0.5·feasibility-rate) masuk formula
confidence dengan bobot **0.25**.

### Revisi 16 Jul 2026 — jarak jalan nyata (OSRM) + `road_geometry`

Versi awal M4 memakai jarak **haversine × 1.3** (faktor detour konstan) sebagai matriks
jarak antar-stop. Untuk area urban Jabodetabek aproksimasi ini meleset besar (satu leg
uji: jalan nyata 18 km vs estimasi 9 km, 1.9×) — urutan "optimal" pun bisa keliru, dan
garis di peta memotong gedung. Sekarang:

- **Matriks jarak = OSRM `/table` (jarak jalan nyata).** Optimizer NSGA-II bekerja pada
  jarak sebenarnya → cost/CO₂/ETA berbasis jalan. Generator: `experiments/m4_nsga2_osrm.py`.
- **`road_geometry`** (polyline snap OSRM `route`) ditambahkan per kandidat untuk render peta
  yang mengikuti jalan; `geometry` lama (titik stop) tetap untuk marker. Skrip:
  `scripts/snap_routes_to_roads.py`.
- **Deadline di-rescale ×1.257** ke basis-waktu jarak-jalan (tour ~25% lebih lama di jalan
  nyata) supaya feasibility realistis — tanpa ini semua stop telat → semua CRITICAL.
- **Masih precomputed** (keputusan ADR ini tak berubah): OSRM dipanggil **build-time**, hasil
  disimpan ke JSON; **tidak ada** panggilan OSRM saat runtime.

> Angka lama (haversine): Baseline 322m/599k/0.183; Balanced +7.0%/−53.2%/+14.0%. Diarsipkan
> di riwayat git; tabel di atas adalah yang **normatif** sekarang.

## Batas precomputed (jujur — WAJIB dipahami sebelum dipakai/dinarasikan)

1. **Satu skenario saja.** Hanya `jabodetabek_urban_sameday` yang ada. `GET /internal/m4/routes`
   dengan scenario lain → **404**. Demo path terikat pada satu skenario ini.
2. **Tidak reaktif terhadap input.** Pareto set **tidak berubah** walau traffic/cuaca/dwell berubah.
   M2 dwell yang naik **tidak** mengoptimasi ulang rute — ia hanya memengaruhi M1 ETA. Ini batas
   paling penting: jangan pernah dinarasikan seolah rute "beradaptasi real-time".
3. **Fixed fleet & stop.** 16 stop, VAN 600 kg, hub tetap. Tambah/kurang stop = harus re-run offline.
4. **Tier level-tour ≠ tier per-shipment M1.** M4: SAFE <5% stop telat@P90 · WARNING 5–20% ·
   CRITICAL >20%. Jangan dicampur di UI copy.

## Jalur ke real-time (final)

Target time-box **2.5 detik** in-request, lewat: **warm-start** dari Pareto set tersimpan (bukan
populasi acak) + **evaluasi paralel** + **time-box eksplisit** dengan fallback ke solusi tersimpan
kalau anggaran habis. Urutan ini menjaga properti "selalu ada jawaban" — degradasi anggun, sejalan
dengan failure cascade design.

## Alternatif yang ditolak

| Alternatif | Alasan ditolak |
|---|---|
| Jalankan NSGA-II in-request apa adanya | ~9.5 s vs anggaran ~2 s. Demo menggantung. |
| Turunkan pop/generasi sampai muat ~2 s | Menurunkan kualitas Pareto → merusak klaim utama (−48.2% SLA-risk). Mengorbankan hasil demi teater real-time. |
| Ganti ke heuristik cepat (greedy/NN) | Membuang justru kontribusi paling kuat; baseline NN adalah **pembanding** yang kita kalahkan. |
| Precompute banyak skenario | Waktu tidak cukup; demo hanya butuh satu. Batas #1 diterima sadar. |
