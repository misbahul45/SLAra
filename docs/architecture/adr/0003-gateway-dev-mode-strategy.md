# ADR-0003: Strategi Gateway di Dev Mode

- Status: Proposed
- Tanggal: 2026-07-14
- Pengambil keputusan: Tech lead (draft: Platform)
- Topik: Bagaimana `gateway` (nginx) mem-proxy `app` (dashboard) di dev mode, mengingat Vite jalan di `:5173` sementara prod jalan di `:3000`.

## Konteks

Di base `infra/docker-compose.yml`, `gateway` punya `depends_on: app: service_healthy` dan nginx upstream `app_service → app:3000` (`services/gateway/nginx.conf:16-20`). Di dev, `apps/app/Dockerfile.dev` menjalankan Vite di `:5173`. Dua masalah muncul:

1. Healthcheck `app` base compose mengecek `:3000` → di dev `app` tidak pernah `healthy` (B2).
2. nginx proxy `/` → `app:3000` → connection refused (app di `:5173`) → 502 → gateway sendiri `unhealthy` (B3).

Komentar di `nginx.conf:18` sendiri mengakui: *"Dev: dashboard diakses langsung di http://localhost:5173 (Vite HMR), bukan lewat gateway."* Namun mekanisme tetap breaking karena gateway masih `depends_on app: service_healthy` dan healthcheck-nya bergantung proxy ke app.

Keputusan ini menentukan **cara memperbaiki B3** (lihat `docs/specifications/platform/SPEC-001-docker-dev-startup-health.md`).

## Keputusan

**Pilih Opsi A:** sediakan `services/gateway/nginx.dev.conf` yang hanya mengubah upstream `app_service` ke `app:5173`, lalu override mount-nya di `infra/docker-compose.dev.yml`:

```yaml
# docker-compose.dev.yml
gateway:
  volumes:
    - ../services/gateway/nginx.dev.conf:/etc/nginx/nginx.conf:ro
```

```nginx
# services/gateway/nginx.dev.conf
upstream app_service {
    server app:5173;   # dev: Vite port
}
# sisanya sama dengan nginx.conf base
```

Sebab pemilihan Opsi A di atas Opsi B:
- Menjaga `gateway` **berfungsi penuh di dev** sehingga routing `/api/*` → `agent`/`data`/`ai` dan `/` → `app` bisa di-smoke-test end-to-end tanpa keluar dari compose.
- Developer tetap bisa buka `:5173` langsung untuk HMR (port tetap di-expose di dev overlay).
- Menjaga kesimetrisan topologi dev ≈ prod, mengurangi "works in dev, breaks in prod" surprise.

**Opsi B** (lepas `app` dari `depends_on` gateway + nginx stub `location / { return 200; }`) ditolak karena membuat gateway buta terhadap `app` di dev — kehilangan kemampuan verifikasi proxy dashboard lewat gateway, padahal itu tepat salah satu hal yang gagal hari ini.

## Alternatif yang dipertimbangkan

- **Opsi B (bypass app di dev):** lebih sederhana (tidak perlu file nginx kedua), tapi mengurangi cakupan verifikasi dev. Ditolak.
- **Ubah base nginx upstream ke `:5173` dan biarkan prod ikut 5173:** merusak prod (`apps/app/Dockerfile` EXPOSE 3000 + `react-router-serve`). Ditolak — base harus tetap prod-correct.
- **Lepas `depends_on app` dari gateway di dev saja tanpa stub:** gateway healthcheck `wget localhost:80/` akan OK, tapi proxy `/` ke app tetap 502 saat diakses. Trade-off sama dengan Opsi B. Ditolak.

## Konsekuensi

- Positif: dev topology bisa di-boot utuh (10/10 healthy) dan gateway bisa diuji.
- Negatif: ada file config nginx kedua (`nginx.dev.conf`) yang harus dijaga sinkron dengan `nginx.conf` base (drift risk → butuh catatan di `services/gateway/` README).
- Technical debt yang sengaja diambil: duplikasi sebagian nginx config antara `nginx.conf` dan `nginx.dev.conf`. Mitigasi: jaga delta minimal (hanya block `upstream app_service`).
- Menutup U5 dari audit.
