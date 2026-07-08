# M3 — Carbon Emission Estimator

> **Model ID:** M3
> **Jenis:** Rule-based deterministic (BUKAN ML)
> **Prioritas:** P0 (dependency M4)
> **Owner:** SLAra AI — Data Engineer (validasi audit) + BA (kalibrasi emission factor)
> **Status desain:** Final — desain rule-based dipertahankan dengan alasan prinsip

---

## 1. Ringkasan Eksekutif

M3 menghitung emisi CO₂ per shipment dengan **formula matematis deterministic**, bukan model machine learning. Keputusan ini disengaja dan prinsipial: untuk ESG reporting yang harus diaudit (ISO 14083, GLEC Framework), model black-box ML justru **mengurangi trust**, bukan menambah. Expertise seorang "AI Infrastructure Architect" di komponen ini justru adalah tahu **kapan tidak perlu ML**.

M3 adalah **dependency upstream** bagi M4 (Route Optimization) — `environmental_cost` di objective function M4 memanggil M3 per kromosom yang dievaluasi. Karena M4 mengevaluasi ribuan kromosom per generasi, M3 harus sangat cepat (<5ms per call) — sesuatu yang hanya mungkin dengan formula deterministic, bukan ML inference.

---

## 2. Formulasi Matematis

### 2.1 Formula Utama (dari proposal, dipertahankan)

```
CO2_shipment (kg) = distance_km × emission_factor(kg_CO2/km) × load_factor_adjustment
```

Dimana:
- `distance_km` — dari OSRM route, bukan haversine (koreksi: haversine undercount 10–20% di area urban)
- `emission_factor` — lookup tabel per `vehicle_type` dari sumber resmi (§3)
- `load_factor_adjustment` — koreksi berdasarkan rasio muatan aktual vs kapasitas (§2.3)

### 2.2扩展 — Per Transport Chain Element (GLEC Framework)

GLEC v3 membagi pengiriman menjadi beberapa **Transport Chain Element** (TCE). M3 menghitung per TCE lalu menjumlahkan:

```
total_CO2 = Σ TCE_i
TCE_i = distance_i × EF(vehicle_type_i) × load_adjustment_i
```

Contoh: pengiriman intercity Jabodetabek → Surabaya mungkin punya TCE:
1. First-mile (pickup → hub) — van, 5 km
2. Hub sortir — emissions 0 (tidak ada pergerakan kendaraan, atau listrik dari grid → GLEC Scope 2)
3. Line-haul (hub → hub) — medium truck, 780 km
4. Last-mile (hub → customer) — van, 8 km

### 2.3 Load Factor Adjustment

Beban kendaraan mempengaruhi konsumsi bahan bakar. Berdasarkan GLEC v3:

```
load_adjustment = 1 + 0.5 × (load_factor - 0.5)
```

Dimana `load_factor = load_weight / vehicle_capacity ∈ [0, 1]`.

- `load_factor = 0` (kosong) → adjustment = 0.75 (75% dari baseline EF, karena kendaraan tetap konsumsi bahan bakar untuk pergerakan)
- `load_factor = 0.5` (half load) → adjustment = 1.0 (baseline)
- `load_factor = 1.0` (full load) → adjustment = 1.25 (25% lebih banyak emisic dari baseline)

Formula ini **over-simplification** — real-world curve non-linear — tapi konsisten dengan asumsi GLEC default dan dapat dijelaskan ke auditor.

### 2.4 Scope Emissions (Klasifikasi GHG Protocol)

| Scope | Komponen M3 | Status MVP |
|---|---|---|
| Scope 1 (direct) | Bahan bakar kendaraan sendiri / kontrak | Dihitung |
| Scope 2 (indirect energy) | Listrik di hub untuk sortir | Tidak dihitung MVP (data tidak tersedia) — flag sebagai limitasi |
| Scope 3 (value chain) | Kendaraan vendor pihak ketiga | Dihitung dengan EF default vendor (jika diketahui), else pakai fleet average |

---

## 3. Sumber Emission Factor (Wajib Resmi, Bukan Angka Karangan)

Setiap `emission_factor` di lookup tabel M3 harus dapat ditelusuri ke salah satu sumber berikut:

### 3.1 IPCC 2019 Refinement to 2006 Guidelines

Tabel default emission factor per jenis kendaraan (diesel, bensin, listrik). Sudah kalian sebut di mockup "0.213 kg/km for van" — angka ini berasal dari IPCC default untuk light-duty diesel vehicle.

Referensi: `IPCC 2019 Refinement, Volume 2: Energy, Chapter 3 — Mobile Combustion`.

### 3.2 GLEC Framework v3 (Smart Freight Centre)

Standar industri untuk perhitungan emisi logistics. GLEC menyediakan:
- Default EF per mode transport (road/rail/air/sea/inland waterway)
- Metodologi per TCE (Transport Chain Element)
- Aturan agregasi & reporting

Website: `smartfreightcentre.org/en/our-programs/glec-framework/`

### 3.3 ISO 14083:2023

Standar resmi perhitungan emisi transport chain. Mengacu pada GLEC dan menambahkan:
- Definisi metodologi verification
- Requirement audit trail
- Format reporting standar

### 3.4 Lookup Table M3 (Default untuk MVP)

| vehicle_type | emission_factor (kg_CO2/km) | Sumber | Catatan |
|---|---|---|---|
| `van` (diesel, <3.5 ton) | 0.213 | IPCC 2019 default | Sudah di mockup |
| `light_truck` (3.5–7.5 ton) | 0.348 | GLEC v3 road freight default | Diesel Euro IV |
| `medium_truck` (7.5–16 ton) | 0.562 | GLEC v3 | Diesel Euro IV |
| `heavy_truck` (>16 ton) | 0.815 | GLEC v3 | Diesel Euro V |
| `electric_van` | 0.062 | GLEC v3 + Indonesia grid factor | Scope 2 konversi |

**Catatan penting:** untuk Indonesia, grid emission factor (~0.7 kg CO₂/kWh, sesukan data ESDM 2022) perlu dikalikan ke EF electric vehicle. Lookup table M3 harus menyertakan kolom `region_grid_factor` jika ingin support EV di masa depan.

---

## 4. Validasi via Backtesting Numerik (Bukan Train/Test Split)

### 4.1 Konsep "Validation" untuk Komponen Rule-Based

Karena M3 bukan ML, konsep "validation" berbeda:
- **Bukan** train/test split
- **Bukan** k-fold cross-validation
- **Yang valid:** backtesting numerik — bandingkan output M3 dengan kalkulator emisi resmi di skenario rute nyata.

### 4.2 Audit Trail Procedure

Untuk setiap skenario test (minimum 10 skenario, mix van/medium_truck/intercity):

1. **Definisikan skenario** — origin, destination, vehicle_type, load_weight
2. **Hitung dengan M3** — catat hasil `co2_kg_M3`
3. **Hitung dengan kalkulator referensi**:
   - EPA Greenhouse Gas Equivalencies Calculator — `epa.gov/energy/greenhouse-gas-equivalencies-calculator`
   - DEFRA Company Reporting Guidelines — `gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024`
   - DKT — Danish Council for Sustainable Business (gratis, public)
4. **Bandingkan** — hitung % deviation
5. **Dokumentasikan** di audit trail file `m3_validation_report.md`

### 4.3 Acceptance Deviation

| Deviation dari referensi | Status |
|---|---|
| < 5% | Excellent — M3 akurat |
| 5–10% | Acceptable — dokumentasikan asumsi |
| > 10% | Reject — cek formula atau EF sumber |

Penyebab deviation umum:
- M3 pakai EF IPCC default, referensi pakai EF region-specific (e.g., DEFRA untuk UK)
- Load factor adjustment berbeda metodologi
- Distance source berbeda (OSRM vs Google Maps)

### 4.4 Output Audit Trail Format

```markdown
## Audit Trail Skenario #01

- Origin: Jakarta Pusat (-6.1944, 106.8229)
- Destination: Bandung (-6.9175, 107.6191)
- Distance (OSRM): 152.3 km
- Vehicle: medium_truck
- Load weight: 8.500 kg (load_factor=0.53)
- EF used: 0.562 kg/km (GLEC v3 default)
- Load adjustment: 1 + 0.5×(0.53−0.5) = 1.015

**M3 Output:** 152.3 × 0.562 × 1.015 = 86.95 kg CO₂

**Referensi:**
- EPA calculator (input same): 91.20 kg CO₂
- DEFRA (medium truck diesel UK 2024): 84.10 kg CO₂

**Deviation:**
- vs EPA: -4.7% ✅
- vs DEFRA: +3.4% ✅

**Status:** ACCEPTABLE
```

Skenario seperti ini diulang 10× untuk mix kondisi. Hasil audit trail dilampirkan di laporan teknis — ini yang akan meyakinkan juri soal klaim "auditability".

---

## 5. Integrasi dengan M4 (Route Optimization)

### 5.1 Peran di Objective Function M4

M4 punya 3 objective (lihat dokumen M4). Salah satunya adalah **environmental_cost**, yang merupakan kombinasi fuel_cost + CO₂_cost:

```
environmental_cost = fuel_cost(distance, vehicle_type, fuel_price)
                   + carbon_cost(CO2_kg, carbon_price_per_kg)
```

Dimana `CO2_kg` dihitung dengan M3 per TCE.

### 5.2 Mengapa M3 Bukan Objective Terpisah di M4

Sesuai keputusan Bagian 7.2 — fuel dan CO₂ digabung jadi satu objective karena keduanya bergerak searah (CO₂ = fungsi linear dari fuel). Memisahkan jadi 2 objective di NSGA-II tidak menambah diversitas Pareto front, tapi membuang budget GA. M3 tetap **dilaporkan terpisah di dashboard** sebagai derived metric, bukan objective GA yang berdiri sendiri.

### 5.3 Performance Budget

M4 mengevaluasi ribuan kromosom per generasi × puluhan generasi. Setiap evaluasi memanggil M3. Maka:

- M3 harus < 5ms per call (formula matematis sederhana → seharusnya <1ms di Python)
- Lookup tabel EF di-load sekali di memory, bukan dari disk per call
- Implementasi vectorized (NumPy) jika M4 batch-evaluate kromosom

---

## 6. Reporting & Auditability

### 6.1 Output Schema per Shipment

```json
{
  "shipment_id": "SHP-2026-000123",
  "total_co2_kg": 86.95,
  "tce_breakdown": [
    {
      "tce_id": "TCE-01",
      "segment": "pickup_to_hub",
      "distance_km": 5.2,
      "vehicle_type": "van",
      "load_factor": 0.40,
      "emission_factor_source": "IPCC 2019 default",
      "co2_kg": 1.10
    },
    {
      "tce_id": "TCE-02",
      "segment": "line_haul",
      "distance_km": 138.9,
      "vehicle_type": "medium_truck",
      "load_factor": 0.53,
      "emission_factor_source": "GLEC v3 default",
      "co2_kg": 79.20
    },
    {
      "tce_id": "TCE-03",
      "segment": "hub_to_customer",
      "distance_km": 8.2,
      "vehicle_type": "van",
      "load_factor": 0.30,
      "emission_factor_source": "IPCC 2019 default",
      "co2_kg": 6.65
    }
  ],
  "methodology": "GLEC v3 + ISO 14083:2023",
  "model_version": "m3_v1",
  "audit_trail_id": "AT-2026-001"
}
```

### 6.2 Audit Trail ID

Setiap perhitungan M3 mendapat `audit_trail_id` yang dapat ditelusuri ke:
- Snapshot input (distance, vehicle, load)
- Snapshot emission factor table (version)
- Timestamp perhitungan
- Referensi validation report

Ini memenuhi requirement ISO 14083 untuk transport chain emission reporting — **bukan tambahan opsional, tapi requirement compliance**.

### 6.3 Dashboard Reporting

Di dashboard SLAra, M3 ditampilkan:
- Per-shipment CO₂ (dengan breakdown TCE jika drill-down)
- Aggregate CO₂ per hari/minggu
- Perbandingan baseline (current route) vs optimized route (M4) — gap inisiatif penghematan emisi
- Equivalency: jumlah pohon yang setara menyerap CO₂ tsb (EPA equivalency) — komunikasi ke stakeholder non-teknis

---

## 7. Risiko & Mitigasi

| Risiko | Severity | Mitigasi |
|---|---|---|
| EF lookup outdated (IPCC update tiap 5 tahun) | Sedang | Versi tabel EF di-tag (e.g., `ipcc_2019_v1`); re-check tiap rilis baru |
| Region-specific EF Indonesia tidak tersedia | Tinggi | Pakai IPCC default + dokumentasikan sebagai limitasi; roadmap: kolaborasi dengan Kementerian Perhubungan untuk EF nasional |
| Distance source (OSRM) under-count vs actual | Sedang | Bandingkan dengan Google Maps distance di sample, kalibrasi faktor koreksi |
| EV grid factor Indonesia tinggi (~0.7 kg/kWh) → EF EV sebenarnya tidak serendah klaim hijau | Tinggi | Hitung dengan grid factor Indonesia, jangan pakai grid factor Eropa; transparansi > greenwashing |
| Auditor external menolak metodologi | Sedang | Lampirkan ISO 14083:2023 compliance checklist; rujuk GLEC v3 sebagai best practice industri |

---

## 8. Roadmap (post-MVP)

| Fase | Upgrade |
|---|---|
| Production 3 bulan | Integrasi EF region-specific Indonesia (kolaborasi Kemhub / Litbang) |
| Production 6 bulan | Scope 2 emissions dari hub electricity consumption |
| Production 12 bulan | Real-time fuel consumption telematics dari IoT kendaraan → EF lebih akurat daripada tabel default |
| Production 18 bulan | Verification oleh pihak ketiga (SGS / TÜV) untuk compliance ISO 14083 |

---

## 9. Acceptance Criteria (untuk demo kompetisi)

- [ ] Lookup tabel EF menulis sumber IPCC/GLEC/ISO untuk setiap entri
- [ ] Audit trail 10 skenario test dilampirkan di laporan teknis
- [ ] Deviation M3 vs EPA/DEFRA < 10% di semua skenario audit
- [ ] Performance M3 < 5ms per call (benchmark di profile)
- [ ] Output schema §6.1 mengandung TCE breakdown + audit_trail_id
- [ ] Narasi "kapan tidak perlu ML" jelas di laporan (prinsip desain rule-based)
- [ ] Klaim "ISO 14083 / GLEC / IPCC compliance" dapat di-backup dengan referensi
- [ ] M3 terintegrasi dengan M4 objective function (lihat M4 §5)

---

**Referensi internal:** M4 (consumer untuk objective `environmental_cost`), M6 (audit_trail_id dilaporkan ke Decision Agent untuk compliance), Dashboard (TCE breakdown + equivalency view).
