# Bruno Collection — SLAra

Testing manual/exploratory & sanity check sebelum merge. **Bukan pengganti** unit/integration/contract
test (AGENTS.md §Testing Strategy).

## Struktur

```
docs/api/bruno/
├── bruno.json              # config collection
├── environments/local.bru  # base URL saja — TIDAK BOLEH ada secret
└── ai/                     # 7 request menutup semua endpoint kontrak §B
    ├── health.bru               (seq 1)  GET  /health
    ├── m1-eta.bru               (seq 2)  POST /internal/m1/eta
    ├── m2-dwell-normal.bru      (seq 3)  POST /internal/m2/dwell
    ├── m2-dwell-congested.bru   (seq 4)  POST /internal/m2/dwell
    ├── m3-carbon.bru            (seq 5)  POST /internal/m3/carbon
    ├── m4-routes.bru            (seq 6)  GET  /internal/m4/routes
    └── m5-explain.bru           (seq 7)  POST /internal/m5/explain
```

## Pakai

1. Jalankan service:
   ```bash
   cd services/ai && uv run uvicorn app.main:app --port 8000
   ```
   Tunggu log `Startup selesai` (~25–37 detik — init SHAP, bukan hang).
2. Buka collection di Bruno, pilih environment **local**.
3. Jalankan `Health` dulu. Kalau `m2.mode` bukan `FULL`, berhenti — artifacts M2 tidak terbaca.
4. Urutan seq 1→7 aman dijalankan berurutan; tidak ada state antar-request.

CLI:
```bash
cd docs/api/bruno && bru run ai --env local
```

## Aturan

- **Secret**: `environments/*.bru` hanya boleh berisi base URL & nama variable — **JANGAN PERNAH**
  commit token/API key asli (AGENTS.md §Common Gotchas #9). Endpoint internal M1–M5 saat ini tidak
  butuh auth.
- **Endpoint baru/berubah** di `docs/contracts/rest/` **wajib** disertai request Bruno yang sesuai
  di PR yang sama (AGENTS.md §Testing Strategy).
- Tiap request punya blok `assert` dengan nilai yang **sudah terverifikasi 15 Jul 2026**, jadi
  collection ini juga berfungsi sebagai regression check ringan — kalau assert gagal, model atau
  artifacts berubah, bukan sekadar request salah.

## Catatan yang sering bikin bingung

| Hal | Penjelasan |
|---|---|
| `m4-routes` pakai **GET**, bukan POST | Kontrak §B asli menulis POST; implementasi GET + query karena M4 precomputed ([ADR-004](../../architecture/adr/ADR-004-m4-precomputed.md)). Ikuti §B-bis. |
| M2 normal vs congested **harus beda** | Kalau sama → M2 degraded (jatuh ke historical median, `condition` diabaikan). |
| `m5-explain` `prediction_min` ≠ `eta_p90_min` | M5 menjelaskan P90 **mentah** (tanpa conformal δ +0.83). Offset konstan tidak mengubah atribusi. |
| Request pertama lambat | Startup ~25–37 s (TreeExplainer), first call M5 ~230 ms. |
| Base URL | `aiBaseUrl` = direct-port (fallback ADR-001) · `gatewayBaseUrl` = jalur utama lewat nginx. |
