

# Rencana Remediasi Infrastruktur Docker — SLAra

- Tanggal: 2026-07-14
- Author: Claude Code (Opus 4.8)
- Basis: [docker-infrastructure-audit.md](docker-infrastructure-audit.md)
- Branch: dev
- Status dokumen: **rencana implementasi** — dipetakan 1:1 ke temuan audit, lalu diterapkan.

---

## 1. Tujuan

Audit `docker-infrastructure-audit.md` menemukan **3 Blocking · 3 Silent · 2 Drift · 4 Hygiene**.
Akibatnya stack tidak bisa full-boot: `qdrant` unhealthy memblokir `agent` dan `gateway`; di dev mode
`app` tidak pernah healthy karena mismatch port; nginx dev nunjuk upstream yang salah.

Dokumen ini memetakan tiap temuan ke perubahan konkret, urutan penerapan, dan cara verifikasi.
Prinsip: perubahan kecil, terlokalisasi, tidak mengubah kontrak port/arsitektur yang sudah di-freeze.

---

## 2. Baseline yang Sudah Ada (uncommitted, sebelum remediasi ini)

Sebagian temuan sudah ditangani parsial di working tree (belum di-commit):

- `services/agent/src/index.ts` — endpoint `GET /health` → `{status:"ok",service:"agent"}` sudah ada.
- `services/data/cmd/api/main.go` — endpoint `GET /health` + port dikoreksi ke `:8081`.
- `services/ai/main.py` — `GET /health` sudah lengkap (models_loaded/models_total).
- `docker-compose.yml` — blok `healthcheck` untuk gateway/agent/data/ai/app + `depends_on` diubah ke
  `condition: service_healthy` + port `6334` qdrant diekspos.

Sisa yang **belum** ditangani = fokus remediasi ini (B1, B2, B3, S1, S2, S3, H1, H3, D1).

---

## 3. Peta Temuan → Fix

| # | Temuan | Fix | File yang disentuh |
|---|--------|-----|--------------------|
| B1 | qdrant healthcheck `wget` tidak ada di image | Ganti probe ke bash `/dev/tcp` | `infra/docker-compose.yml` |
| B2 | dev `app` healthcheck cek port 3000, Vite di 5173 | Override healthcheck `app` ke port 5173 di dev | `infra/docker-compose.override.yml` |
| B3 | nginx dev upstream `app:3000`, dev app di 5173 | `nginx.dev.conf` (upstream 5173) + volume override gateway | `services/gateway/nginx.dev.conf`, `infra/docker-compose.override.yml` |
| S1 | `data/Dockerfile.dev` manifest-only, `.air.toml` tidak ada di image | Tambah `COPY . .` sesudah `go mod download` | `services/data/Dockerfile.dev` |
| S2 | `ai/Dockerfile.dev` manifest-only, `main.py` tidak ada di image | Tambah `COPY . .` sesudah `uv sync` | `services/ai/Dockerfile.dev` |
| S3 | `--host` flag Vite belum pasti diteruskan | Set `server.host` di `vite.config.ts`, sederhanakan CMD | `apps/app/vite.config.ts`, `apps/app/Dockerfile.dev` |
| H3 | prod agent `Dockerfile` tidak copy `pnpm-workspace.yaml` | Copy file di stage deps + runtime | `services/agent/Dockerfile` |
| D1 | runbook mendokumentasikan script check-health versi lama | Ganti section dengan referensi ke script aktual | `docs/runbooks/health-check-runbook.md` |
| H1 | `check-health.sh` tidak didokumentasikan | Tambah section di `infra/README.md` | `infra/README.md` |

**Ditunda / follow-up (butuh keputusan atau verifikasi runtime, tidak diterapkan sekarang):**

- **D2** — `git add infra/check-health.sh`. Butuh commit; dilakukan saat commit remediasi.
- **H2** — pin image tag (`:latest` → versi spesifik). Butuh verifikasi versi teruji per infra image; dijadwalkan terpisah.
- **H4/U2** — konfirmasi tag `python:3.14-slim` & `golang:1.25-alpine` tersedia di Docker Hub (`docker pull`).
- **U1/U4** — verifikasi runtime binding 5173 & race `initial_sync` setelah `up --watch`.

---

## 4. Detail Perubahan

### B1 — Qdrant healthcheck pakai bash `/dev/tcp`

`qdrant/qdrant:latest` punya `bash` (`/usr/bin/bash`) tapi tidak punya `wget`/`curl`.
Redirect `< /dev/tcp/host/port` adalah TCP probe bawaan bash, tanpa binary eksternal.

```yaml
# infra/docker-compose.yml — qdrant.healthcheck
test: ["CMD-SHELL", "bash -c '< /dev/tcp/localhost/6333' || exit 1"]
```

### B2 — Override healthcheck `app` di dev

Base compose cek port 3000 (benar untuk prod: `react-router-serve`). Dev Vite di 5173.
`node:24-alpine` (`apps/app/Dockerfile.dev`) punya `wget`.

```yaml
# infra/docker-compose.override.yml — app
healthcheck:
  test: ["CMD-SHELL", "wget -q --spider http://localhost:5173/ || exit 1"]
  interval: 10s
  timeout: 5s
  retries: 10
  start_period: 30s
```

### B3 — nginx dev config terpisah (Opsi A dipilih)

Keputusan: **gateway tetap dipakai di dev** supaya path `/api/*` konsisten dengan prod.
Buat `nginx.dev.conf` yang identik dengan `nginx.conf` kecuali upstream `app_service → app:5173`,
lalu mount override di dev compose.

```nginx
# services/gateway/nginx.dev.conf — hanya upstream app yang beda
upstream app_service { server app:5173; }
```

```yaml
# infra/docker-compose.override.yml — gateway
gateway:
  volumes:
    - ../services/gateway/nginx.dev.conf:/etc/nginx/nginx.conf:ro
```

> Opsi B (bypass gateway di dev) ditolak: bikin path dev ≠ prod, menyulitkan test integrasi routing.

### S1 & S2 — Dockerfile.dev bake source

`initial_sync: true` sudah memitigasi, tapi ada race kecil kalau CMD (`air`/`uvicorn`) start sebelum sync selesai.
Tambah `COPY . .` supaya image punya source dari awal; watch tetap sync perubahan berikutnya.

```dockerfile
# data — sesudah `RUN go mod download`
COPY . .
# ai — sesudah `RUN uv sync`
COPY . .
```

Urutan tetap: copy manifest → download deps → `COPY . .`, supaya layer cache deps tidak invalid tiap ubah source.

### S3 — Vite host binding via config

Lebih andal dari CLI flag: set di `vite.config.ts`, hapus `-- --host 0.0.0.0` dari CMD.

```ts
server: { host: "0.0.0.0" }
```
```dockerfile
CMD ["pnpm", "run", "dev"]
```

### H3 — prod agent copy `pnpm-workspace.yaml`

`pnpm-workspace.yaml` berisi `allowBuilds: { esbuild: true }`. Tanpa ini, native build esbuild bisa ditolak
di `pnpm install` prod. Tambah ke stage `deps` dan `runtime`.

```dockerfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
```

### D1 & H1 — Dokumentasi

- Runbook: ganti blok script inline (baris 48–74) jadi referensi singkat ke `infra/check-health.sh` + daftar mode.
- `infra/README.md`: tambah section "Health Check Script" dengan contoh pemakaian 4 mode.

---

## 5. Urutan Penerapan

1. B1 qdrant → unblock agent + gateway (paling berdampak).
2. B2 + B3 → dev app + gateway healthy.
3. S1/S2/S3/H3 → build robustness.
4. D1/H1 → dokumentasi sinkron.
5. `docker compose ... config` untuk validasi schema.
6. (Runtime, opsional) `up --build --watch` + `bash infra/check-health.sh`.

## 6. Verifikasi

```bash
cd infra
# validasi schema resolved dev + prod
docker compose -f docker-compose.yml -f docker-compose.override.yml config >/dev/null
docker compose -f docker-compose.yml -f docker-compose.prod.yml config >/dev/null

# runtime (opsional, butuh Docker daemon)
docker compose -f docker-compose.yml -f docker-compose.override.yml up --build --watch
bash check-health.sh
```

Target akhir: semua container demo path (`gateway`, `agent`, `data`, `ai`, `app`, `kafka`) `healthy`,
`check-health.sh` semua pass. (`mongodb`/`neo4j`/`redis`/`qdrant` sengaja di-disable — lihat ADR-003.)

## 7. Item Terbuka

Diteruskan dari audit section 6: U1 (binding 5173), U2 (tag image), U3 (dependency agent→ai),
U4 (race initial_sync), U5 sudah diputus (Opsi A). H2/H4 dijadwalkan sebagai hardening terpisah.
