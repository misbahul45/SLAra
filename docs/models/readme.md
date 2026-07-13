Urutan pengembangan model sudah saya tulis di **§5 dokumen asli**, tapi saya akan breakdown lebih konkret dengan dependency graph supaya tim bisa mulai paralel tanpa bikin blocker:

## Urutan Berdasarkan Dependency (bukan timeline kalender)

```
MINGGU 1-2
├─ M3 (Carbon) ──── paling cepat selesai (rule-based, no training)
│   └─ dependency: none
│   └─ deliverable: lookup table EF + audit trail 10 skenario
│
└─ Data Pipeline (paralel)
    ├─ OSM setup (OSRM docker)
    ├─ BMKG cache worker
    └─ Synthetic generator (M/M/c simulator untuk M2 + shipment generator untuk M1)

MINGGU 2-3
├─ M1 (ETA) ──── ⭐ inti sistem, mulai dari sini
│   └─ dependency: data pipeline (BMKG, OSM), M2 output (dwell time sebagai feature)
│   └─ ⚠️ chicken-egg dengan M2: pakai dwell_lag_24h sebagai placeholder M2 di minggu 2,
│       swap ke M2 output asli di minggu 3
│   └─ deliverable: model v1 di Food Delivery Dataset (proxy) → validasi arsitektur
│
└─ M4 (Route Opt) ──── mulai paralel, TIDAK tunggu M1
    └─ dependency: M3 (carbon untuk objective), distance matrix OSRM
    └─ mulai dengan Solomon benchmark dulu (validasi algoritma, tidak butuh M1)
    └─ deliverable: gap <5% ke best-known di Solomon R1_25

MINGGU 3-4
├─ M2 (Hub Congestion) ──── baru mulai setelah synthetic generator M/M/c ready
│   └─ dependency: M/M/c simulator (dari data pipeline minggu 1)
│   └─ deliverable: LightGBM quantile P50+P90, coverage P90 di 88-92%
│
└─ M1 lanjutan ──── swap placeholder M2 → M2 output asli, retrain
    └─ deliverable: model v2 di data sintetis Indonesia

MINGGU 4-5
└─ M4 lanjutan ──── swap M1 dummy → M1 asli untuk SLA risk objective
    └─ deliverable: 3-skenario Indonesia (urban/intercity/mixed), reduction ≥15%

MINGGU 5-6
├─ M6 (Orchestration) ──── integrasi semua, baru mulai setelah M1+M2+M3+M4 stabil
│   └─ dependency: SEMUA model lain harus bisa dipanggil
│   └─ deliverable: confidence aggregation formula, escalation gate aktif
│
└─ M5 (SHAP) ──── paling akhir, di atas M1 final
    └─ dependency: M1 v final
    └─ deliverable: TreeExplainer on-demand untuk WARNING/CRITICAL

MINGGU 6 (akhir)
└─ End-to-end latency test + dashboard wiring + shadow mode
```

## Yang Bisa Dikerjakan Paralel Hari 1

| Anggota Tim | Ambil | Alasan bisa mulai hari 1 |
|---|---|---|
| Data Engineer | M3 + data pipeline | M3 rule-based tidak butuh model lain; OSM/BMKG setup independen |
| Agent Engineer #1 | M4 (NSGA-II di Solomon) | Validasi algoritma di benchmark publik, tidak butuh M1/M2/M3 |
| Agent Engineer #2 | M1 feature engineering scaffold | Bangun pipeline feature store, latih di Food Delivery Dataset (proxy) |
| BA (Orwin) | M6 confidence formula + M3 emission factor calibration | Tidak butuh kode, kerjaan dominan riset + dokumentasi |

## Aturan Penting — Jangan Tunggu Mock!

- **M1 jangan tunggu M2 ready** → pakai `dwell_lag_24h` sebagai placeholder, retrain nanti
- **M4 jangan tunggu M1 ready** → pakai dummy ETA function (e.g., `distance / avg_speed`), swap nanti
- **M6 jangan tunggu semua final** → mock output M1-M5 dengan stub, test orchestration flow lebih dulu

Filosofi: **integrasi dengan stub > integrasi dengan model final tapi terlambat**. Lebih mudah swap stub → model asli daripada debug orchestration saat semua model belum stabil.

## Kritikal Path (yang TIDAK boleh delay)

Hanya **2 hal** yang jika delay akan block semua:

1. **Data Pipeline (OSM + BMKG + synthetic generator)** — tanpa ini, M1/M2/M4 tidak bisa training
2. **M1 final model** — tanpa ini, M6 tidak bisa integrasi end-to-end, dashboard tidak bisa demo

Yang lain punya fallback: M2 → pakai lag feature, M4 → pakai dummy ETA, M3 → pakai EF default IPCC.

---

**Rekomendasi konkrit mulai Senin ini:** Data Engineer + Agent Engineer #1 langsung start. Agent Engineer #2 mulai hari Selasa setelah Data Engineer punya OSM basic ready (butuh distance matrix). BA (Orwin) mulai hari Senin juga untuk M6 confidence formula — kalibrasi bobot butuh waktu diskusi, jangan ditunda.

Mau saya buatkan **starter code** untuk salah satu: simulator M/M/c (data pipeline), training script XGBoost M1, atau setup DEAP NSGA-II M4? Sebutkan mana yang mau dikerjakan duluan.