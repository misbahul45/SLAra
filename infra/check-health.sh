#!/bin/bash
# SLAra — API health test script
# Usage: bash infra/check-health.sh [--gateway-only | --direct-only | --docker-only]

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

PASS=0
FAIL=0

hit() {
  local label="$1"
  local url="$2"
  local expect_body="$3"   # optional substring to assert in response body

  local start_ms end_ms elapsed_ms
  start_ms=$(date +%s%3N)
  local response
  response=$(curl -s --max-time 5 -w "\n__STATUS__%{http_code}" "$url" 2>/dev/null)
  end_ms=$(date +%s%3N)
  elapsed_ms=$((end_ms - start_ms))

  local body status
  body=$(echo "$response" | sed '$d')
  status=$(echo "$response" | tail -1 | sed 's/__STATUS__//')

  if [ -z "$status" ]; then
    printf "  ${RED}✗${RESET} %-30s ${RED}UNREACHABLE${RESET} — %s\n" "$label" "$url"
    FAIL=$((FAIL + 1))
    return
  fi

  local ok=true
  if [ "$status" != "200" ]; then ok=false; fi
  if [ -n "$expect_body" ] && ! echo "$body" | grep -q "$expect_body"; then ok=false; fi

  if $ok; then
    printf "  ${GREEN}✓${RESET} %-30s ${GREEN}HTTP %s${RESET} — %dms\n" "$label" "$status" "$elapsed_ms"
    # Print truncated body if JSON
    if echo "$body" | grep -q "^{"; then
      printf "      ${CYAN}%s${RESET}\n" "$(echo "$body" | tr -d '\n' | cut -c1-100)"
    fi
    PASS=$((PASS + 1))
  else
    printf "  ${RED}✗${RESET} %-30s ${RED}HTTP %s${RESET} — %dms\n" "$label" "$status" "$elapsed_ms"
    if [ -n "$body" ]; then
      printf "      ${RED}body: %s${RESET}\n" "$(echo "$body" | tr -d '\n' | cut -c1-100)"
    fi
    FAIL=$((FAIL + 1))
  fi
}

MODE="${1:-all}"

# ── Direct endpoints ──────────────────────────────────────────────────────────
if [ "$MODE" != "--gateway-only" ] && [ "$MODE" != "--docker-only" ]; then
  echo ""
  printf "${BOLD}▶ Direct Endpoints${RESET}\n"
  echo "──────────────────────────────────────────────"

  hit "agent /health"        "http://localhost:3000/health"  '"status":"ok"'
  hit "data  /health"        "http://localhost:8081/health"  '"status":"ok"'
  hit "ai    /health"        "http://localhost:8000/health"  '"status":"ok"'
  # M2 degraded-tolerant: service tetap "ok" walau artifacts M2 hilang. Cek mode-nya eksplisit,
  # kalau tidak, DEGRADED lolos tanpa kelihatan.
  hit "ai    /health (m2 FULL)" "http://localhost:8000/health" '"mode":"FULL"'
  hit "ai    /health (m5 additivity)" "http://localhost:8000/health" '"additivity_ok":true'
  hit "app   /"              "http://localhost:5173/"
fi

# ── Via Gateway ───────────────────────────────────────────────────────────────
if [ "$MODE" != "--direct-only" ] && [ "$MODE" != "--docker-only" ]; then
  echo ""
  printf "${BOLD}▶ Via Gateway (localhost:80)${RESET}\n"
  echo "──────────────────────────────────────────────"

  hit "gateway /"                  "http://localhost:80/"
  hit "gateway /api/agent/health"  "http://localhost:80/api/agent/health"  '"status":"ok"'
  hit "gateway /api/data/health"   "http://localhost:80/api/data/health"   '"status":"ok"'
  hit "gateway /api/ai/health"     "http://localhost:80/api/ai/health"     '"status":"ok"'
fi

# ── Docker container health ───────────────────────────────────────────────────
if [ "$MODE" != "--direct-only" ] && [ "$MODE" != "--gateway-only" ]; then
  echo ""
  printf "${BOLD}▶ Docker Container Health${RESET}\n"
  echo "──────────────────────────────────────────────"

  if ! command -v docker &>/dev/null; then
    printf "  ${YELLOW}docker not found — skipping${RESET}\n"
  else
    while IFS= read -r line; do
      name=$(echo "$line" | awk '{print $1}')
      status=$(echo "$line" | cut -d' ' -f2-)
      if echo "$status" | grep -q "(healthy)"; then
        printf "  ${GREEN}✓${RESET} %-30s %s\n" "$name" "$status"
      elif echo "$status" | grep -q "(unhealthy)"; then
        printf "  ${RED}✗${RESET} %-30s %s\n" "$name" "$status"
      elif echo "$status" | grep -q "(health: starting)"; then
        printf "  ${YELLOW}…${RESET} %-30s %s\n" "$name" "$status"
      else
        printf "  ${YELLOW}?${RESET} %-30s %s\n" "$name" "$status"
      fi
    done < <(docker ps --format "{{.Names}} {{.Status}}" | grep slara | sort)
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
if [ "$MODE" != "--docker-only" ]; then
  echo ""
  echo "──────────────────────────────────────────────"
  TOTAL=$((PASS + FAIL))
  if [ "$FAIL" -eq 0 ]; then
    printf "${GREEN}${BOLD}  ALL $TOTAL CHECKS PASSED${RESET}\n"
  else
    printf "${RED}${BOLD}  $FAIL/$TOTAL FAILED${RESET} — cek logs: docker logs slara_<service> --tail 30\n"
  fi
  echo ""
fi
