#!/bin/sh
set -eu
# The entrypoint starts as root only to fix bind-mount ownership, then drops to bun.
export DATA_DIR="${DATA_DIR:-/data}"
export DATABASE_URL="${DATABASE_URL:-file:${DATA_DIR}/sleeve.db}"
umask 077

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  chown -R 1000:1000 "$DATA_DIR"
  export HOME=/home/bun
  exec setpriv --reuid=1000 --regid=1000 --init-groups bun server/index.ts
fi

exec bun server/index.ts
