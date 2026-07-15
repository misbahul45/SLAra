# SPEC-001: Docker Dev Stack — Startup & Health Remediation

- Owner: Platform / Infra (tech lead)
- Service terkait: platform (infra Docker Compose + Dockerfile.dev)
- Status: In Review
- Referensi: `docs/runbooks/docker-infrastructure-audit.md` (audit 2026-07-14)

---

## 1. Problem Statement

Stack SLAra **tidak bisa di-boot end-to-end lewat Docker Compose di dev mode**. Saat ini hanya container infra yang tidak bergantung pada `app` (`mongodb`, `redis`, `kafka`) yang mencapai `healthy`; `qdrant` permanen `unhealthy`; dan `neo4j`, `data`, `ai`, `agent`, `app`, `gateway` tidak pernah jalan sebagai satu kesatuan yang koheren.

> **Update 2026-07-16:** Asumsi "full 10-container stack" di spec ini **sudah tidak berlaku** untuk demo
> path. `infra/docker-compose.yml` sekarang **meng-disable** (mengomentari) `mongodb`, `neo4j`, `redis`,
> dan `qdrant` beserta `depends_on`-nya — sejalan dengan ADR-003. File `docker-compose.dev.yml` juga
> **diganti** menjadi `docker-compose.override.yml` (konten identik, nama disesuaikan ke konvensi
> Compose default override). Dokumen ini tetap valid sebagai catatan root-cause historis; target boot
> yang realistis kini adalah **topologi demo** (gateway, agent, data, ai, app, kafka). Lihat §11.

Audit statik + dinamik (2026-07-14) menemukan **3 Blocking · 3 Silent · 2 Drift · 4 Hygiene**. Blocker-nya saling mengunci (cascade), sehingga gateway tidak pernah start — dan tanpa gateway, alur `app → gateway → {agent,data,ai}` tidak bisa diverifikasi sama sekali.

---

## 2. Root Cause Analysis (Rantai Kausal)

Berdsarkan pembacaan langsung `infra/docker-compose.yml`, `infra/docker-compose.override.yml` (pengganti `docker-compose.dev.yml`), `apps/app/Dockerfile.dev`, `services/gateway/nginx.conf`:

```
[B1] qdrant healthcheck pakai `wget` ── TIDAK ada di qdrant/qdrant:latest
        └─> qdrant permanen UNHEALTHY (FailingStreak=311, padahal /healthz 200 OK)
              └─> agent (depends_on qdrant: service_healthy) TIDAK start
                    └─> gateway (depends_on agent: service_healthy) TIDAK start

[B2] base compose: app healthcheck cek :3000
        └─> tapi apps/app/Dockerfile.dev jalan di Vite :5173
              └─> dev overlay TIDAK override healthcheck app
                    └─> app TIDAK pernah healthy
                          └─> gateway (depends_on app: service_healthy) TIDAK start  (blocker ke-2, independen dari B1)

[B3] nginx upstream `app_service → app:3000`
        └─> dev app di :5173 → proxy `/` ke app => 502
              └─> gateway healthcheck `wget localhost:80/` gagal => gateway UNHEALTHY  (mengunci B2)
```

**Kesimpulan:** ada dua jalur blocker independen (`qdrant→agent→gateway` dan `app→gateway`). Keduanya harus diperbaiki sekaligus agar `gateway` bisa start. Tanpa gateway sehat, tidak ada verifikasi topologi lintas service.

---

## 3. Goals

- Seluruh container demo path (`gateway`, `agent`, `data`, `ai`, `app`, `kafka`) mencapai status `healthy` di dev mode via:
  `docker compose -f docker-compose.yml -f docker-compose.override.yml watch`

  > **Catatan 2026-07-16:** `mongodb`, `neo4j`, `redis`, `qdrant` **tidak lagi** di-boot di demo path
  > (di-disable di base compose). Target "10/10 healthy" sudah tidak relevan; lihat §11.
- `gateway` dapat me-route `/` dan `/api/*` tanpa 502.
- Healthcheck tiap service memvalidasi port/protokol yang **sesuai dengan image & mode** (dev vs prod).
- Dokumentasi health-check konsisten dengan script aktual (`infra/check-health.sh`).

## 4. Non-Goals

- Mengubah topologi prod (`docker-compose.prod.yml`) kecuali H3 (prod agent Dockerfile) dan H2 (pin tag) yang bersifat lintas-mode.
- Mengganti framework/tooling service (Hono, Gin, FastAPI, Vite) — di luar scope.
- Menyelesaikan item UNVERIFIED yang butuh runtime eksekusi (U1–U5) — lihat §8; beberapa butuh konfirmasi tech lead, bukan keputusan dokumen ini.

---

## 5. Desain & Daftar Fix

Setiap fix mencantumkan **lokasi file** dan **keputusan**. Semua perubahan berada di luar folder `/docs` (implementasi) — dokumen ini hanya merencanakan; belum ada kode yang diubah.

### 5.1 Blocking (wajib duluan)

#### Fix B1 — Qdrant healthcheck tanpa `wget`
- Lokasi: `infra/docker-compose.yml:174-179`
- Keputusan: ganti `wget -q --spider http://localhost:6333/healthz` dengan probe TCP bawaan bash:
  ```yaml
  healthcheck:
    test: ["CMD-SHELL", "bash -c '< /dev/tcp/localhost/6333' || exit 1"]
    interval: 5s
    timeout: 5s
    retries: 10
    start_period: 10s
  ```
- Alasan: `bash` ada di `qdrant/qdrant:latest` (`/usr/bin/bash`); `< /dev/tcp/host/port` tidak butuh binary eksternal. Telah diverifikasi runtime di audit (port terbuka, `/healthz` 200 OK).
- Dampak: membuka jalur `qdrant → agent → gateway`.

#### Fix B2 — Override healthcheck `app` di dev overlay
- Lokasi: tambah block `app:` di `infra/docker-compose.override.yml` (pengganti `docker-compose.dev.yml`; saat ini cuma punya `build`+`ports`+`develop`, tanpa `healthcheck`).
- Keputusan: dev healthcheck cek `:5173` (base image `apps/app/Dockerfile.dev:1` = `node:24-alpine` punya `wget`):
  ```yaml
  app:
    build:
      context: ../apps/app
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    healthcheck:
      test: ["CMD-SHELL", "wget -q --spider http://localhost:5173/ || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s
    develop:
      watch:
        # ... tetap
  ```
- Dampak: `app` bisa `healthy` → membuka jalur `app → gateway`.

#### Fix B3 — Strategi nginx dev (BUTUH KEPUTUSAN TECH LEAD)
- Lokasi: `services/gateway/nginx.conf:16-20` (`upstream app_service { server app:3000; }`).
- Masalah: dev `app` di `:5173` → proxy `/` 502. Dua opsi (lihat `docs/architecture/adr/0003-gateway-dev-mode-strategy.md`):
  - **Opsi A (direkomendasikan):** buat `services/gateway/nginx.dev.conf` dengan `upstream app_service { server app:5173; }` dan override volume mount di `docker-compose.override.yml`.
  - **Opsi B:** karena dev dashboard diakses langsung di `:5173` (HMR), lepas `app` dari `depends_on` gateway di dev overlay + nginx stub `location / { return 200; }` agar gateway healthcheck tidak bergantung proxy ke app.
- Keputusan saat ini: **Opsi A** (menjaga gateway tetap berfungsi penuh di dev untuk smoke-test routing). Final ditetapkan via ADR-0003.

### 5.2 Silent (risiko laten)

#### Fix S1 / S2 — `Dockerfile.dev` data & ai hanya copy manifest
- Lokasi: `services/data/Dockerfile.dev:1-13`, `services/ai/Dockerfile.dev:1-11`.
- Keputusan: pertahankan pola `manifest-only + develop.watch initial_sync: true` (sesuai konvensi AGENTS.md), **tapi** tambahkan verifikasi runtime U4 (lihat §8) bahwa tidak ada race "file not found" saat startup. Jika race terbukti terjadi, tambahkan `COPY . .` minimal ke build stage. Tidak ubah sekarang tanpa bukti.

#### Fix S3 — Binding host `app`
- Lokasi: `apps/app/Dockerfile.dev:13`, `apps/app/vite.config.ts`.
- Keputusan (direkomendasikan): pindahkan binding ke config file untuk reliabilitas:
  - `vite.config.ts`: tambah `server: { host: "0.0.0.0" }`.
  - `Dockerfile.dev`: ubah `CMD ["pnpm","run","dev","--","--host","0.0.0.0"]` → `CMD ["pnpm","run","dev"]`.
- Alasan: tidak bergantung pada apakah `react-router dev` meneruskan flag `--host` ke Vite. Perlu konfirmasi runtime U1.

### 5.3 Drift (dokumentasi / git)

#### Fix D1 — Runbook tidak mencerminkan `check-health.sh` aktual
- Lokasi: `docs/runbooks/health-check-runbook.md:49-73` vs `infra/check-health.sh:1-121`.
- Keputusan: perbarui section "Script Health Check Cepat" di runbook agar mencerminkan script 121-baris (3 mode: `--gateway-only`, `--direct-only`, `--docker-only`). **Ini perubahan dokumentasi, diizinkan di fase ini.**

#### Fix D2 — `check-health.sh` tidak ter-commit
- Lokasi: `infra/check-health.sh` (`??` di git status).
- Keputusan: commit script (`git add infra/check-health.sh && git commit -m "chore: track check-health.sh"`). **Perlu eksekusi git — lakukan saat implementasi, bukan sekarang.**

### 5.4 Hygiene

| # | Lokasi | Keputusan |
|---|--------|-----------|
| H1 | `AGENTS.md`, `infra/README.md` | Tambah section "Health Check Script" yang men-link `infra/check-health.sh` (3 mode). |
| H2 | `infra/docker-compose.yml:117,133,152,168,183` | Pin tag infra image (mis. `qdrant/qdrant:v1.14.0`, `mongo:7`, `neo4j:5`, `redis:7-alpine`, `apache/kafka:3.8`). Butuh konfirmasi versi yang sudah diuji. |
| H3 | `services/agent/Dockerfile:4` | Tambah `COPY pnpm-workspace.yaml ./` (di dev sudah ada di `Dockerfile.dev:7`); perlu agar esbuild native `allowBuilds` jalan di prod `pnpm install`. |
| H4 | `services/data/Dockerfile(.dev):1`, `services/ai/Dockerfile(.dev):1` | Verifikasi `golang:1.25-alpine` & `python:3.14-slim` tersedia di Docker Hub (U2). Jika tidak, turunkan ke versi yang ada. |

---

## 6. Urutan Implementasi (Dependency Order)

1. **B1** (qdrant) — buka jalur agent.
2. **B2** (app healthcheck dev) — buka jalur gateway via app.
3. **B3** (nginx dev) — pastikan gateway sendiri sehat & proxy benar (tunggu ADR-0003).
4. **S3** (vite host bind) — reliabilitas app reachable.
5. **H3** (agent prod Dockerfile) — hindari break prod.
6. **D1** (runbook) — sinkronkan dokumentasi.
7. **D2 + H1** (commit script + dokumentasikan) — hygiene & recoverability.
8. **S1/S2** — hanya jika U4 membuktikan race.
9. **H2 / H4** — pinning & verifikasi versi (bisa paralel, butuh akses Docker Hub).

---

## 7. Verification Plan

Setelah implementasi B1–B3 + S3:

```bash
cd infra
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
# tunggu startup order selesai
docker ps --format "table {{.Names}}\t{{.Status}}" | grep slara
# semua 10 baris harus (healthy)

# verifikasi health endpoint
curl -s http://localhost:3000/health   # agent
curl -s http://localhost:8081/health   # data
curl -s http://localhost:8000/health   # ai
curl -s http://localhost:5173/         # app (Vite)
curl -s http://localhost/              # gateway (harus 200, bukan 502)

# script terpusat
bash infra/check-health.sh --docker-only
bash infra/check-health.sh --gateway-only
```

Cek khusus U4 (S1/S2 race):
```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml up --watch
docker logs slara_data --tail 30   # cari "file not found" / "module not found"
docker logs slara_ai   --tail 30
```

## 8. Success Metrics

- 🟢 Container demo path (`gateway`, `agent`, `data`, `ai`, `app`, `kafka`) `healthy` di dev mode.
  > **Update 2026-07-16:** target "10/10" sudah tidak relevan — `mongodb`/`neo4j`/`redis`/`qdrant`
  > di-disable di base compose (ADR-003). Lihat §11.
- 🟢 `GET http://localhost/` (gateway) mengembalikan 200, bukan 502.
- 🟢 `infra/check-health.sh --gateway-only` = all pass.
- 🟢 `qdrant` tidak lagi `unhealthy` (FailingStreak reset).
- 🟢 `app` `healthy` dengan healthcheck yang mengecek port 5173.

## 9. Open Questions / UNVERIFIED (perlu runtime/konfirmasi)

| # | Item | Cara konfirmasi | Pemilik |
|---|------|-----------------|---------|
| U1 | Apakah `react-router dev` meneruskan `--host` ke Vite? | `docker exec slara_app ss -tlnp` setelah running | Platform |
| U2 | `python:3.14-slim` & `golang:1.25-alpine` ada di Docker Hub? | `docker pull` keduanya | Platform |
| U3 | Apakah `agent` memanggil `ai` via HTTP di app code? | grep `services/agent/src` untuk `AI_PORT`/`http://ai:8000` | Agent |
| U4 | Apakah `initial_sync` selesai sebelum CMD start (S1/S2)? | lihat §7 log check | Platform |
| U5 | Opsi B3: Opsi A vs B? | **ADR-0003** | Tech lead |

## 10. Kontrak yang Terdampak

- Tidak ada perubahan kontrak REST/Kafka. Health endpoint di `docs/runbooks/health-check-runbook.md:3-11` tetap menjadi kontrak health tiap service (tidak berubah).
- Catatan: healthcheck `app` berubah dari `:3000` → `:5173` **hanya di dev overlay**, prod tetap `:3000` (`apps/app/Dockerfile:22` + `react-router-serve`). Tidak ada breaking change ke kontrak eksternal.

---

## 11. Perubahan Compose 2026-07-16 (post-spec, diluar scope asli)

Implementasi nyata menyimpang dari beberapa asumsi spec ini. Dicatat di sini supaya tidak dibaca sebagai
kelalaian:

1. **`docker-compose.dev.yml` → `docker-compose.override.yml`.** File overlay dev di-rename ke nama
   default Compose (`override` otomatis di-merge tanpa flag `-f`). Konten identik. Seluruh perintah di
   §7 kini pakai `-f docker-compose.override.yml` (atau tanpa flag sama sekali).
2. **`mongodb` / `neo4j` / `redis` / `qdrant` di-disable (dikomentari)** di `docker-compose.yml` base
   **dan** `docker-compose.prod.yml`. `depends_on` ke keempat service itu juga di-disable. Ini mengadopsi
   ADR-003 secara struktural: demo path hanya butuh `gateway`, `agent`, `data`, `ai`, `app`, `kafka`.
3. **Dampak ke target success:** "10/10 healthy" (§8) sudah tidak relevan. Target realistis = 6 container
   demo path `healthy`. B1 (qdrant) kini **tidak lagi memblokir** karena qdrant sendiri di-disable — jalur
   cascading `qdrant → agent → gateway` hilang dari demo path.
4. **B2/B3 tetap relevan** (masalah port `app` 5173 dan nginx upstream dev) dan diselesaikan lewat
   `docker-compose.override.yml` + `nginx.dev.conf` seperti direncanakan.

| Item spec | Status pasca 2026-07-16 |
|---|---|
| B1 (qdrant healthcheck) | Termitigasi oleh disable qdrant (bukan oleh fix probe) |
| B2 (app healthcheck 5173) | ✅ selesai di `docker-compose.override.yml` |
| B3 (nginx dev upstream) | ✅ selesai via `nginx.dev.conf` + override volume |
| Target 10/10 healthy | ⚠️ diganti 6/6 demo path |

---

## Catatan Graphify / Freshness

`graphify-out/2026-07-14/` dibangun dari commit `da78a66c`; HEAD saat penulisan = `b271e977c` (sedikit drift, tidak memengaruhi file infra yang dibahas — audit & pembacaan `docker-compose*.yml` langsung sudah mencerminkan state terkini). Jika nanti `docker-compose*.yml` atau `Dockerfile*` berubah banyak, regenerate graph (`graphify update .`) sebelum audit berikutnya.
