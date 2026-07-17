# Progress Tracker — `apps/app` (Dashboard, Phase 4)

Status wiring FE. Wajib di-update setiap status berubah (AGENTS.md §Konvensi Umum).

**Terakhir di-update:** 2026-07-16 · **Branch:** `dev`

---

## Status per view

| View | Route | Status | Sumber data | Tanggal |
|---|---|---|---|---|
| AI Recommendation | `/recommendation` | ✅ **LIVE** | `GET /shipments`, `POST /decide` | 2026-07-16 |
| Human Approval | `/approvals` | ✅ **LIVE** | `GET /shipments` (filter status), `POST /resolve` | 2026-07-16 |
| Route Optimization | `/optimization` | ✅ **LIVE** | `GET /internal/m4/routes` (via adapter) | 2026-07-16 |
| Dashboard | `/` | ◑ **KPI LIVE** | `GET /kpi/summary` + `model_stats.json`; sisanya fixture | 2026-07-16 |
| Execution & KPI | `/impact` | ◑ **KPI LIVE** | `GET /kpi/summary`; before/after dari M4 vs_baseline | 2026-07-16 |
| Live Fleet Map | `/fleet` | ○ mock | fixture `fleet.json` | — |

## Item selesai

| Item | Status | Tanggal | Catatan |
|---|---|---|---|
| Data layer switch per-view | ✅ DONE | 2026-07-16 | `lib/data.ts` grup live vs mock |
| Isomorphic API base (SSR/browser) | ✅ DONE | 2026-07-16 | `lib/api.ts` + proxy Vite (fix CORS) |
| DecideResult component | ✅ DONE | 2026-07-16 | banner, gauge+threshold, breakdown+sub-term, eta, hub, routes, SHAP, latency |
| conf_m1 sub-term bars (ADR-005) | ✅ DONE | 2026-07-16 | `ConfidenceBreakdown` interval × deadline |
| Approval queue + resolve | ✅ DONE | 2026-07-16 | queue dari ESCALATE, approve/reject live |
| Number-sync + `model_stats.json` | ✅ DONE | 2026-07-16 | sumber tunggal; grep angka lama bersih |
| M4 live adapter | ✅ DONE | 2026-07-16 | `lib/m4-adapter.ts` pareto_stats + convergence_hv |
| typecheck | ✅ bersih | 2026-07-16 | `pnpm typecheck` 0 error |

## Screenshot bukti (`docs/progress/screenshots/`)

> ⚠️ **Semua screenshot = state 16 Jul 2026 (historis).** Per 17 Jul angka bergeser
> (sinkron `distance_km` → jarak jalan OSRM: 00400 0.810 · 00403 0.646; M4 angka
> road-based; peta MapLibre + rute ikut jalan). **Rekam ulang sebelum dipakai di video.**

| File | State |
|---|---|
| `01-auto-execute-SHP-2026-00400.png` | AUTO_EXECUTE hijau, 0.864, SHAP "not required" |
| `02-escalate-SHP-2026-00403.png` | ESCALATE, 0.686, deadline_pressure, SHAP top-5, sub-term |
| `03-approval-review-SHP-2026-00403.png` | Human Approval review |
| `04-approved-SHP-2026-00403.png` | status APPROVED |
| `05-route-optimization-live.png` | pareto_stats + convergence hypervolume live |
| `06-dashboard-live-kpi.png` | KPI jujur; OTD/CO₂ = "—" (not measured) |

## Bug ditemukan saat verifikasi browser

- **CORS**: `POST :3000` dari origin :5173 diblokir preflight (agent tanpa header
  CORS) → tombol Decide mati di browser meski SSR lolos. Fix: proxy Vite `/api/v1`
  + `/internal` (di produksi peran ini dipegang nginx). FE-side, agent tak disentuh.
- **SHAP bar kosong di screenshot**: `fullPage` me-resize viewport → recharts
  animasi mulai ulang. Fix capture pakai viewport tinggi + tunggu 1500 ms.
- **Convergence flatline**: Y-domain chart 0–100 hardcoded, hypervolume ~0.4–1.4.
  Fix: auto-fit domain.
- **`[object Object]`** di optimizer note: `scenario` adalah objek → pakai
  `scenario.id`.
