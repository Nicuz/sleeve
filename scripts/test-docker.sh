#!/usr/bin/env bash
set -euo pipefail

suffix="$(date +%s)"
container="sleeve-smoke-${suffix}"
volume="sleeve-smoke-${suffix}"
image="sleeve:smoke-${suffix}"
port="${SLEEVE_SMOKE_PORT:-3299}"
base="http://127.0.0.1:${port}"

cleanup() {
  docker rm -f "${container}" >/dev/null 2>&1 || true
  docker volume rm "${volume}" >/dev/null 2>&1 || true
  docker image rm "${image}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

wait_for_health() {
  for _ in $(seq 1 30); do
    if curl -fsS "${base}/api/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Container did not become healthy." >&2
  docker logs "${container}" >&2 || true
  return 1
}

echo "Building Docker image…"
docker build -t "${image}" . >/dev/null

echo "Starting isolated container…"
docker run -d \
  --name "${container}" \
  -p "127.0.0.1:${port}:3001" \
  -v "${volume}:/data" \
  -e DATABASE_URL=file:/data/sleeve.db \
  -e DATA_DIR=/data \
  -e MUSICBRAINZ_USER_AGENT="Sleeve smoke test (test@example.com)" \
  "${image}" >/dev/null

wait_for_health

echo "Checking JSON export…"
export_json="$(curl -fsS "${base}/api/export")"
printf '%s' "${export_json}" | grep -q '"app": "sleeve"'
printf '%s' "${export_json}" | grep -q '"releases"'

echo "Checking removed backup API…"
status="$(curl -s -o /dev/null -w '%{http_code}' "${base}/api/backups")"
test "${status}" = "404"

echo "Checking import and pre-import snapshot…"
curl -fsS -X POST "${base}/api/import?mode=merge" \
  -H 'content-type: application/json' \
  -d '{"settings":{"defaultCurrency":"USD"}}' >/dev/null

snapshot="$(
  docker run --rm --entrypoint sh -v "${volume}:/data" "${image}" \
    -c 'basename "$(ls -1 /data/backups/pre-import-*.db | head -1)"'
)"
test -n "${snapshot}"

echo "Checking exact snapshot restore…"
docker stop "${container}" >/dev/null
docker run --rm \
  --entrypoint bun \
  -v "${volume}:/data" \
  -e DATABASE_URL=file:/data/sleeve.db \
  -e DATA_DIR=/data \
  "${image}" run restore -- "${snapshot}" >/dev/null
docker start "${container}" >/dev/null
wait_for_health

echo "Docker smoke test passed."
