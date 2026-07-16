# Spesifikasi — Dashboard (`apps/app`)

- **Status:** Phase 4 sebagian live (flow decide + view yang bergantung padanya)
- **Tanggal:** 2026-07-16
- **Rumah:** `apps/app/` (React Router v8 framework mode, React 19, Tailwind v4, Vite)
- **Terkait:** `services/agent/README.md` (pemetaan /decide → UI) · `docs/specifications/agent/m6-orchestration.md` · `docs/contracts/rest/v1.md` §A

## 1. Data layer — switch mock ↔ live per-view

`app/lib/data.ts` adalah **satu-satunya** facade yang diimpor UI/loader. Cutover
Phase 4 bersifat **parsial**, jadi switch-nya per-view, bukan global:

| Grup | View | Sumber | Switch |
|---|---|---|---|
| **LIVE** | shipments, kpi, decide, resolve | `agent :3000` (`app/lib/api.ts`) | `VITE_USE_MOCK=false` |
| **LIVE (ai)** | Route Optimization | `ai :8000` `/internal/m4/routes` (`getM4Routes`) | selalu live |
| **MOCK** | dashboard*, fleet, approvals**, execution* | fixture `app/mocks/*.json` | selalu mock |

\* KPI card dashboard & execution **dibangun live** dari `GET /kpi/summary` +
`model_stats.json` (`app/lib/kpi-cards.ts`), meski bagian lain view-nya masih
fixture.
\** Approval queue **live** (difilter dari `GET /shipments` by `decision_status`);
hanya layout sekitarnya yang statis.

`VITE_USE_MOCK=false` hanya memindah grup LIVE ke backend; grup MOCK tetap fixture
karena agent belum serve endpoint tsb. `VITE_USE_MOCK=true` memaksa semua ke
fixture (fallback demo offline).

### Isomorfik (SSR vs browser)

`app/lib/api.ts` memilih base URL per sisi:
- **SSR** (loader jalan di Node): URL absolut (`VITE_API_BASE`, default `:3000/api/v1`;
  M4 `VITE_AI_BASE`, default `:8000`).
- **Browser**: path relatif (`/api/v1`, `/internal`) lewat **proxy Vite**
  (`vite.config.ts`) supaya same-origin — menghindari CORS preflight ke agent.
  Di produksi peran proxy dipegang nginx gateway.

Spinner minimum 400 ms (`SPINNER_FLOOR_MS` di `data.ts`) menahan state pending
saja; **tidak** mengubah `latency_ms` yang dilaporkan (itu angka ukur agent).

## 2. Peta view ↔ endpoint ↔ sumber angka

| View | Route | Endpoint / sumber | Angka |
|---|---|---|---|
| Dashboard | `/` | `GET /kpi/summary` + `model_stats.json` | KPI live; OTD/CO₂ = "—" (not measured) |
| Live Fleet | `/fleet` | fixture `fleet.json` | statis (belum di-wire) |
| AI Recommendation | `/recommendation` | `GET /shipments`, `POST /decide` | **semua live** |
| Route Optimization | `/optimization` | `GET /internal/m4/routes` | **semua live** (pareto_stats, convergence_hv 51 titik, plan) |
| Human Approval | `/approvals` | `GET /shipments` + `POST /resolve` | queue live dari `decision_status` |
| Execution & KPI | `/impact` | `GET /kpi/summary` + `execution.json` | KPI live; before/after = M4 `vs_baseline` |

## 3. Sumber angka: `model_stats.json` vs live

**`app/data/model_stats.json`** = sumber tunggal angka **statis** (metrik model
hasil training). Tiap angka wajib punya `_source`. Angka yang **live** (confidence,
eta, dwell, routes, convergence_hv, pareto_stats, escalation rate aktual) **tidak**
ditaruh di sana — diambil dari API supaya tak pernah basi.

Aturan keras: **JANGAN menampilkan angka tanpa sumber sebagai fakta.** KPI yang
tak diukur (`on_time_rate_pct`, `co2_saved_today_kg`) dikembalikan `null` oleh
`/kpi/summary` dan dirender **"—"** dengan label "not measured" — bukan angka
palsu. Semua angka Figma lama tanpa sumber sudah dihapus (lihat
`model_stats.json` → `unmeasured._readme`).

## 4. Aturan adaptasi

Nama field response agent **tidak boleh diubah** — adaptasi selalu di sisi FE:
- Tipe di `app/lib/types.ts` mengikuti bentuk response apa adanya (mis. `eta`,
  `hub`, `degraded`, `confidence_breakdown.detail`).
- Transformasi bentuk (mis. M4 → shape view lama) di adapter `app/lib/*-adapter.ts`,
  bukan dengan menuntut backend berubah.

## 5. Catatan render

- **Recharts + screenshot:** jangan pakai `fullPage` screenshot — resize viewport
  memicu `ResponsiveContainer` re-render dan animasi bar mulai ulang dari nol
  (bar SHAP kosong). Pakai viewport tinggi + tunggu animasi ~1500 ms.
- **Konvergensi M4:** hypervolume ~0.4–1.4, jadi Y-domain chart auto-fit (bukan
  0–100) supaya kurva tidak flatline.
