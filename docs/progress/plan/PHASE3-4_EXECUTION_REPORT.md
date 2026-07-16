# Laporan Eksekusi — Integrasi M6 (agent) + FE Phase 4

- **Tanggal:** 2026-07-16 · **Branch:** `dev` (tidak ada merge ke `main`)
- **Cakupan:** SLARA_IMPLEMENTATION_PLAN step 0–6
- **Terkait:** [ADR-005](../../architecture/adr/ADR-005-conf-m1-v2.md) · [m6-orchestration](../../specifications/agent/m6-orchestration.md) · [dashboard](../../specifications/app/dashboard.md) · [agent tracker](../agent/tracker.md) · [app tracker](../app/tracker.md)

---

## (a) Checklist GATE — ✅/❌ dengan angka aktual

| Step | Gate | Hasil |
|---|---|---|
| 0 | `services/ai` sudah terintegrasi → skip; pytest tetap hijau | ✅ **4 passed** (via `.venv`; `uv` tak ada di PATH shell ini) |
| 1 | `npm test` agent | ✅ **6 pass, 0 fail** |
| 2b | `/health` ai | ✅ m1.loaded · m2 **FULL** · m4.loaded · m5.additivity_ok |
| 2d | `GET /shipments` enrichment live | ✅ **12/12** eta_p50+eta_p90+risk_tier terisi |
| 2e | decide SHP-2026-00400 | ✅ **AUTO_EXECUTE · confidence 0.864 · shap_top5 null · ~40 ms** |
| 2f | decide SHP-2026-00403 | ✅ **ESCALATE · confidence 0.686 · driver deadline_pressure · 5 SHAP · ~400 ms** |
| 2g | Σ(value×weight) == confidence | ✅ **PERSIS** — 0.86445→0.864 · 0.68635→0.686 |
| 2h | latency + escalation rate | AUTO ~40 ms · ESCALATE ~400 ms (jalur SHAP) · escalation **2/12 = 16.7%** (band 5–20% ✓) |
| 3 | Browser: AUTO hijau · ESCALATE+SHAP · approve→APPROVED | ✅ 6 screenshot (lihat §e) |
| 4 | grep angka lama (`94.2\|12.4 kg\|0.84\|87/150\|78m\|72%`) | ✅ **PASS — 0 sisa** |
| — | `pnpm typecheck` | ✅ bersih (hanya deprecation warning) |

**Catatan angka:** confidence 2e/2f awalnya **0.857/0.685**, bukan 0.864/0.686. Penyebabnya bug M2
(bukan dari integrasi agent) — lihat §d. Setelah fix, angka cocok dengan rekaman sandbox di
`services/agent/README.md` (dwell P90 95.68 vs 95.7; 0.864/0.686), jadi ini **restorasi perilaku**,
bukan tuning ke gate.

## (b) File FE yang diubah (22)

**Data layer:** `lib/data.ts`, `lib/api.ts`, `lib/types.ts`, `lib/mock.ts`, `vite.config.ts`
**Baru:** `lib/kpi-cards.ts`, `lib/m4-adapter.ts`, `app/data/model_stats.json`, `components/DecideResult.tsx`
**Views:** `routes/recommendation.tsx`, `routes/approvals.tsx`, `routes/optimization.tsx`, `routes/dashboard.tsx`, `routes/impact.tsx`
**Components:** `components/ConfidenceBreakdown.tsx`, `components/ConfidencePanel.tsx`, `components/KpiStrip.tsx`, `components/GaConvergenceChart.tsx`
**Fixtures:** `mocks/dashboard.json`, `mocks/execution.json` (dibersihkan) · `mocks/recommendation.json`, `mocks/optimization.json` (dihapus — mati)
**Config:** `.env.example` (rekam config Phase 4; `.env.development` gitignored)

## (c) Daftar commit (8, di `dev`)

| Hash | Pesan |
|---|---|
| `270ead0` | feat(agent): integrasi M6 deterministic orchestration core |
| `e359f35` | fix(ai): M2 baca artifact per_hub/global, bukan default hardcoded |
| `c3ad885` | feat(app): AI Recommendation view live ke agent /decide (Phase 4) |
| `9dbe62d` | feat(app): Human Approval view live — queue dari ESCALATE, resolve nyata |
| `53d3d06` | fix(app): proxy /api/v1 ke agent — decide gagal CORS di browser |
| `e375d72` | feat(app): number-sync — satu sumber angka, hapus nilai Figma tanpa sumber |
| `35bbf0d` | docs: dokumentasi resmi M6 + FE Phase 4 (ADR-005, spec, Bruno, tracker) |
| `c73b43d` | docs(app): .env.example — config Phase 4 |

## (d) Yang gagal / di-skip + alasan

**Tidak ada gate yang gagal.** Deviasi dari plan literal:

- **Step 1 `pnpm i` → `npm i`:** payload ship `package-lock.json`, bukan `pnpm-lock.yaml`. Plan
  membolehkan menyesuaikan ("sesuaikan tanpa mengubah source").
- **`uv` tak ada di PATH shell ini** — pytest & uvicorn dijalankan lewat `services/ai/.venv` yang
  sudah ada. Tidak mengubah hasil.
- **Empat bug ditemukan saat verifikasi, semua nyata & diperbaiki (bukan di-skip):**
  1. **M2 config lookup** (step 2, dikonfirmasi ke user dulu sebelum menyentuh `services/ai`):
     `_cfg_lookup` tak mengenal bentuk yaml `per_hub` → confidence/coverage M2 selalu default
     hardcoded 0.95/0.896; artifact tak pernah terpakai. Fix commit `e359f35`.
  2. **CORS preflight** (step 3): `POST :3000` dari origin :5173 diblokir → tombol Decide mati di
     browser meski verifikasi SSR lolos. **Hanya menjalankan browser sungguhan yang menangkap ini.**
     Fix: proxy Vite (di produksi peran ini dipegang nginx). Commit `53d3d06`.
  3. **Convergence chart flatline** (step 4): Y-domain 0–100 hardcoded, hypervolume ~0.4–1.4.
     Fix: auto-fit domain.
  4. **`[object Object]`** di optimizer note: `scenario` adalah objek → pakai `scenario.id`.
- **Dockerfile agent tidak disentuh** (pnpm-based, sementara payload npm-based). Di luar daftar;
  drift didokumentasikan di [agent tracker](../agent/tracker.md); tidak di jalur gate mana pun
  (gate jalan di host).

**Untuk narasi video:**
- **M2 model_confidence sekarang serving 0.9974/0.9986 yang benar** — rekaman lama dengan 0.95 sudah usang.
- Angka M4 (−53.2% dll.) dari **satu skenario** (`jabodetabek_urban_sameday`); UI + optimizer note
  sudah menyatakan itu eksplisit sesuai aturan kejujuran demo (ADR-004, desain M4 §7.3).

## (e) Screenshot bukti (`docs/progress/screenshots/`)

| File | State |
|---|---|
| `01-auto-execute-SHP-2026-00400.png` | AUTO_EXECUTE hijau · 0.864 · SHAP "not required" |
| `02-escalate-SHP-2026-00403.png` | ESCALATE · 0.686 · deadline_pressure · SHAP top-5 · sub-term ADR-005 |
| `03-approval-review-SHP-2026-00403.png` | Human Approval — review bukti eskalasi |
| `04-approved-SHP-2026-00403.png` | status APPROVED |
| `05-route-optimization-live.png` | pareto_stats + convergence hypervolume (51 titik) live |
| `06-dashboard-live-kpi.png` | KPI jujur — OTD/CO₂ = "—" (not measured) |
