# SLAra — Health Check Runbook

## Health Endpoints per Service

| Service | Endpoint | Expected Response |
|---------|----------|------------------|
| agent   | `GET /health` | `{"status":"ok","service":"agent"}` |
| data    | `GET /health` | `{"status":"ok"}` |
| ai      | `GET /health` | `{"status":"ok","service":"ai","models_loaded":[...],"models_total":N}` |
| gateway | `GET /` (nginx stub) | HTTP 200 |
| app     | `GET /` | HTTP 200 |

Infra services pakai Docker healthcheck internal — tidak expose HTTP health endpoint ke publik.

## Run Docker Compose (Dev)

```bash
# Dari root repo
cd infra

# Jalankan semua service dengan hot-reload
docker compose -f docker-compose.yml -f docker-compose.override.yml watch

# Atau tanpa watch (background)
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d
```

> **Update 2026-07-16:** `docker-compose.dev.yml` di-rename menjadi `docker-compose.override.yml`
> (auto-merge tanpa flag `-f`). `mongodb`/`neo4j`/`redis`/`qdrant` **di-disable** di base compose
> (lihat ADR-003) — perintah di atas hanya menaikkan topologi demo (6 container: gateway, agent, data,
> ai, app, kafka). Untuk menaikkan full stack, buka komentar blok layanan tersebut di
> `infra/docker-compose.yml`.

## Deteksi Health Status Semua Service

```bash
# Lihat status health seluruh container
docker compose -f docker-compose.yml -f docker-compose.override.yml ps

# Ringkasan: hanya tampilkan status health
docker ps --format "table {{.Names}}\t{{.Status}}" | grep slara

# Manual check tiap endpoint (jalankan setelah compose up)
curl -s http://localhost:3000/health   # agent (langsung, dev)
curl -s http://localhost:8081/health   # data  (langsung, dev)
curl -s http://localhost:8000/health   # ai    (langsung, dev)
curl -s http://localhost/api/agent/health  # agent via gateway
curl -s http://localhost/api/data/health   # data  via gateway
curl -s http://localhost/api/ai/health     # ai    via gateway
```

## Script Health Check Cepat

Pakai script `infra/check-health.sh` (bukan snippet inline). Script ini cek endpoint langsung + via
gateway + status container Docker, dengan color output, timing per-request, dan summary pass/fail.

```bash
bash infra/check-health.sh                 # semua checks (direct + gateway + docker)
bash infra/check-health.sh --direct-only   # HTTP endpoint langsung (tanpa gateway)
bash infra/check-health.sh --gateway-only  # HTTP endpoint via gateway (:80/api/*)
bash infra/check-health.sh --docker-only   # status health container Docker saja
```

Exit code non-zero kalau ada check yang fail — aman dipakai di CI / pre-merge gate.

## Docker Healthcheck Config (docker-compose.yml)

Healthcheck sudah dikonfigurasi di `infra/docker-compose.yml`:

| Service | Test Command | Interval | Retries | Start Period |
|---------|-------------|----------|---------|--------------|
| gateway | `wget -q --spider http://localhost:80/` | 10s | 5 | 10s |
| agent   | `wget -q --spider http://localhost:3000/health` | 10s | 10 | 20s |
| data    | `wget -q --spider http://localhost:8081/health` | 10s | 10 | 20s |
| ai      | `wget -q --spider http://localhost:8000/health` | 10s | 10 | 30s |
| app     | `wget -q --spider http://localhost:3000/` | 10s | 10 | 30s |
| kafka   | `kafka-topics.sh --bootstrap-server localhost:9092 --list` | 10s | 15 | 30s |
| mongodb 🔴 | `mongosh --eval "db.runCommand({ ping: 1 }).ok"` | 5s | 10 | 10s | *(disabled — dikomentari di compose)* |
| neo4j 🔴 | `wget -q --spider http://localhost:7474` | 10s | 15 | 30s | *(disabled — dikomentari di compose)* |
| redis 🔴 | `redis-cli ping` | 5s | 10 | — | *(disabled — dikomentari di compose)* |
| qdrant 🔴 | `wget -q --spider http://localhost:6333/healthz` | 5s | 10 | 10s | *(disabled — dikomentari di compose)* |

> 🔴 = service di-disable di `infra/docker-compose.yml` + `infra/docker-compose.prod.yml` per 2026-07-16
> (ADR-003). Baris healthcheck-nya tetap ada di file tapi dalam komentar; buka komentar untuk
> mengaktifkan kembali full stack.

## Startup Order (berdasarkan depends_on)

```
Layer 1 (infra, no deps):
  kafka   ← (mongodb, neo4j, redis, qdrant DI-NONAKTIFKAN per ADR-003)

Layer 2 (app services, tunggu infra healthy):
  agent   ← kafka            (qdrant, redis disabled)
  data    ← kafka            (mongodb, neo4j, redis disabled)
  ai      ← kafka            (redis disabled)
  app     ← (standalone)

Layer 3 (gateway, tunggu semua app healthy):
  gateway ← agent, data, ai, app
```

## Troubleshooting

**Container unhealthy / restart loop:**
```bash
docker logs slara_<service> --tail 50
docker inspect slara_<service> | jq '.[0].State.Health'
```

**Data service tidak terjangkau (HTTP 502 dari gateway):**
- Pastikan data container listen di `:8081` bukan `:8080`
- Cek: `docker compose exec data netstat -tlnp | grep 8081`

**Kafka connection refused:**
- Pakai `kafka:9092` (container hostname), bukan `localhost:9092`
- Cek env var `KAFKA_BROKERS` di `.env`

**Neo4j lambat startup:**
- Neo4j butuh ~30s untuk ready, start_period sudah 30s di healthcheck
- Kalau masih fail: `docker logs slara_neo4j --tail 30`
