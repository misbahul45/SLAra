---
project: SLAra AI — Semifinal Dashboard
owner: Faisal (frontend, full)
deadline: 2026-07-17 (video submit)
scope: 2 views, mock-first, swap ke API nyata H-1
stack: React Router v8 · TypeScript · Tailwind · react-leaflet · recharts
---

# SLAra Frontend Plan — Semifinal (13–17 Jul)

> File ini sekaligus **brief untuk Claude Code**. Taruh di root `apps/app/` bersama `SLARA_API_CONTRACT.md` dan folder `mocks/`, lalu suruh Claude Code baca keduanya sebelum ngoding apapun.

---

## 0. Keputusan stack (final, jangan didebat ulang)

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Framework | **React Router v8 starter yang sudah ada** di `apps/app` | Sudah ter-setup, jangan buang waktu re-scaffold |
| Peta | **react-leaflet + OpenStreetMap tiles** (BUKAN Mapbox) | Zero token, zero billing, zero friction. Mapbox butuh token per developer + rawan limit pas render video. Leaflet polyline cukup untuk route comparison. Mapbox = upgrade untuk final, bukan sekarang |
| Chart | **recharts** | SHAP horizontal bar + confidence bar, dua-duanya bar chart sederhana |
| State | **React state + loader React Router** | TIDAK pakai Redux/Zustand/TanStack Query. 2 view tidak butuh itu |
| Styling | Tailwind (sudah di starter) | — |
| Data | **Mock adapter dengan flag `VITE_USE_MOCK=true`** | Swap ke API nyata = ganti 1 env var |

Dependency yang perlu di-add: `react-leaflet leaflet recharts` + `@types/leaflet`.

---

## 1. Scope: 2 view + 1 modal. TITIK.

```
┌─────────────────────────────────────────────────────┐
│ VIEW A — Risk Monitor (route: /)                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ KPI strip: active · tier counts · on-time% ·    │ │
│ │ auto-exec% · CO2 saved · avg latency            │ │
│ ├─────────────────────────────────────────────────┤ │
│ │ Tabel shipments: ID · dest · SLA · ETA BAND     │ │
│ │ (P50—P90 visual) · tier badge · dwell · CO2 ·   │ │
│ │ status · [Decide →]                             │ │
│ │ Filter tab: All / SAFE / WARNING / CRITICAL     │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ VIEW B — Decision View (route: /decide/:shipmentId)  │
│ ┌──────────────────┬──────────────────────────────┐ │
│ │ Peta Leaflet:    │ Confidence panel:            │ │
│ │ 3 rute Pareto    │ · Gauge/angka besar vs 0.70  │ │
│ │ warna per tier,  │ · 5 bar breakdown (formula)  │ │
│ │ selected tebal   │ · primary_uncertainty_driver │ │
│ ├──────────────────┤ · decision badge             │ │
│ │ Route compare:   ├──────────────────────────────┤ │
│ │ 3 kartu (ETA     │ SHAP top-5 horizontal bar    │ │
│ │ band·cost·CO2·   │ (merah naik, hijau turun)    │ │
│ │ tier) selected   │ null → "Model confident,     │ │
│ │ ter-highlight    │ explanation not required"    │ │
│ └──────────────────┴──────────────────────────────┘ │
│ ESCALATE → panel operator: pilih rute alternatif +   │
│ note + [Approve & Execute] [Reject] → modal konfirm  │
│ AUTO_EXECUTE → banner hijau "Executed automatically" │
└─────────────────────────────────────────────────────┘
```

**Elemen sinyal utama (yang bikin beda dari tim lain — jangan di-skip):**
1. **ETA band** — render P50→P90 sebagai bar rentang, bukan satu angka. Ini visualisasi uncertainty; tidak ada tim rule-based yang bisa menampilkan ini.
2. **Confidence breakdown 5 komponen** — formula M6 dirender per bar (`value × weight`), jumlahnya = angka gauge. Juri teknis bisa verifikasi live.
3. **Dua path keputusan** — AUTO_EXECUTE dan ESCALATE dua-duanya harus terlihat di video.

**Yang secara eksplisit TIDAK dibangun:** halaman login, settings, executive overview terpisah, carbon analytics terpisah, riwayat, responsive mobile (video 1080p landscape), dark/light toggle, i18n, test e2e.

---

## 2. Arahan desain (biar gak keliatan template AI)

Konsep: **ops control tower** — dashboard yang dipakai dispatcher jam 2 pagi, bukan landing page startup.

- **Tema gelap** (base `#0E1420` biru-arang, surface `#16202E`) — kontras tinggi di screen recording 1080p, badge tier menyala.
- **Warna semantik dari dunia logistik**: SAFE `#2FBF71`, WARNING `#F5A623`, CRITICAL `#E5484D`, accent data/rute `#4CC9F0`. Netral teks `#E6EDF3` / `#8B98A9`. Jangan pakai gradien ungu-biru generik.
- **Tipografi**: display/heading **IBM Plex Sans** (atau Inter kalau mau cepat), **angka & ID shipment pakai IBM Plex Mono / JetBrains Mono** — data operasional harus monospace, itu "vernacular"-nya control room. Angka besar (confidence, KPI) tabular-nums.
- **Signature element**: confidence gauge dengan garis threshold 0.70 yang tegas — satu elemen yang diingat juri. Sisanya disiplin dan tenang: border 1px, radius kecil (4–6px), tanpa shadow dramatis, tanpa animasi kecuali transisi halus saat hasil `/decide` masuk (stagger fade bar breakdown ~300ms, itu saja).
- Copy UI in English (video English): "Decide", "Approve & execute", "Escalated — operator review required".

---

## 3. Arsitektur kode

```
apps/app/app/
├── routes/
│   ├── _index.tsx              # View A (loader: getKpi + getShipments)
│   └── decide.$shipmentId.tsx  # View B (loader: getShipment; action/effect: decide)
├── lib/
│   ├── types.ts                # SEMUA type dari SLARA_API_CONTRACT.md — single source
│   ├── api.ts                  # fetcher real: fetch(`${BASE}/...`)
│   ├── mock.ts                 # fetcher mock: import JSON dari /mocks + delay 800–2000ms
│   └── data.ts                 # export getKpi/getShipments/decide/resolve — pilih adapter via import.meta.env.VITE_USE_MOCK
├── components/
│   ├── KpiStrip.tsx
│   ├── ShipmentTable.tsx  + TierBadge.tsx + EtaBand.tsx
│   ├── RouteMap.tsx            # react-leaflet, polyline per rute
│   ├── RouteCards.tsx
│   ├── ConfidencePanel.tsx     # gauge + 5 breakdown bar
│   ├── ShapChart.tsx           # recharts horizontal bar
│   └── OperatorPanel.tsx       # approve/reject + modal
└── mocks/ (copy dari deliverable ini)
```

Aturan untuk Claude Code:
- `lib/types.ts` ditulis PERTAMA, diturunkan verbatim dari kontrak. Semua komponen konsumsi type ini. No `any`.
- Mock adapter WAJIB pakai `setTimeout` delay acak 800–2000 ms + loading state — supaya UX loading sudah teruji sebelum API nyata datang, dan spinner "deciding…" kelihatan realistis di video.
- `decide()` di mock: map `shipment_id` → file (`00400` → auto, `00403` → escalate); id lain → clone escalate dengan id diganti.
- Leaflet di React Router v8: render map hanya client-side (`clientLoader` / guard `typeof window`), CSS leaflet di-import di root.

---

## 4. Jadwal harian (frontend saja)

| Hari | Target selesai | Definisi "selesai" |
|---|---|---|
| **13 (hari ini)** | Setup + fondasi data | deps terpasang · `types.ts` + `mock.ts` + `data.ts` jalan · KPI strip + tabel shipment render dari mock (jelek gapapa) |
| **14** | View A final + View B mulai | ETA band + tier badge + filter jadi · desain View A rapi · route View B ada, peta Leaflet render 3 polyline |
| **15** | View B final | confidence panel + SHAP + route cards + operator panel + modal · dua skenario (00400/00403) demo mulus end-to-end pakai mock |
| **16** | Integrasi API nyata | `VITE_USE_MOCK=false` ke FastAPI Rizal · fix mismatch (harusnya minim karena kontrak frozen) · **rekam screen recording demo** sore/malam |
| **17** | Buffer | bantu editing video, jangan tambah fitur |

**Aturan tanggal 16:** kalau ada endpoint backend yang belum siap jam 15:00, view itu tetap direkam pakai mock. Kontrak identik = juri tidak bisa membedakan, dan itu bukan kebohongan — UI-nya nyata, formula-nya nyata.

---

## 5. Cara kerja dengan Claude Code (vertical slice)

Jangan minta "buatkan seluruh dashboard" dalam satu prompt — hasilnya generik dan susah di-review. Pecah per slice, tiap slice berakhir dengan sesuatu yang bisa dilihat di browser:

1. **Slice 0 — fondasi**: "Baca SLARA_API_CONTRACT.md dan SLARA_FRONTEND_PLAN.md. Buat lib/types.ts persis dari kontrak, lalu lib/mock.ts + lib/data.ts dengan flag VITE_USE_MOCK dan delay simulasi. Jangan buat UI dulu."
2. **Slice 1 — View A data**: tabel + KPI strip dari loader, tanpa styling final.
3. **Slice 2 — View A polish**: TierBadge, EtaBand (P50→P90 range bar), filter tab, styling sesuai §2.
4. **Slice 3 — View B kerangka**: route + loader + tombol Decide → panggil `decide()` → tampilkan JSON mentah dulu (verifikasi wiring).
5. **Slice 4 — peta + route cards**: react-leaflet 3 polyline warna tier, selected tebal, kartu perbandingan.
6. **Slice 5 — confidence + SHAP**: gauge + breakdown bar + ShapChart (handle `shap_top5: null`).
7. **Slice 6 — operator flow**: OperatorPanel, approve/reject, modal, banner auto-execute.
8. **Slice 7 — demo pass**: jalankan skenario 00400 lalu 00403, screenshot, perbaiki detail visual.

Tiap slice: review hasilnya sendiri di browser sebelum lanjut. Commit per slice.

---

## 6. Definition of Done frontend

- [ ] `pnpm dev` → View A render < 2 detik dari mock
- [ ] Klik shipment SAFE (00400) → Decide → banner AUTO_EXECUTE, confidence 0.88, SHAP section tampil pesan "not required"
- [ ] Klik shipment WARNING (00403) → Decide → ESCALATE, breakdown 5 bar totalnya 0.65, SHAP 5 bar, operator bisa pilih R-C → Approve → status APPROVED
- [ ] ETA band terlihat jelas beda lebar antara shipment SAFE vs WARNING
- [ ] Latency badge (`latency_ms`) tampil di View B — bukti klaim <3s
- [ ] `VITE_USE_MOCK=false` → semua tetap jalan ke FastAPI (atau keputusan sadar: rekam pakai mock)
- [ ] Screen recording 1080p dua skenario tersimpan, durasi mentah 4–6 menit
