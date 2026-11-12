#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: scripts/temp-db.sh <command> [args...]" >&2
  echo "example: scripts/temp-db.sh bun run seed" >&2
  exit 64
fi

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
temp_root=$(mktemp -d "${TMPDIR:-/tmp}/sleeve-temp-XXXXXX")

cleanup() {
  rm -rf "$temp_root"
}
trap cleanup EXIT INT TERM

export DATABASE_URL="file:$temp_root/app.db"
export DATA_DIR="$temp_root/data"
export BACKUP_DIR="$temp_root/data/backups"
export PORT="${PORT:-3099}"
export NODE_ENV="${NODE_ENV:-development}"

mkdir -p "$DATA_DIR" "$BACKUP_DIR"
cd "$repo_root"

echo "[temp-db] disposable database: $DATABASE_URL" >&2
bunx prisma migrate deploy >/dev/null

"$@"
