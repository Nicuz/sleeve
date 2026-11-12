#!/bin/sh
set -eu
# Migrations run automatically from server/index.ts when AUTO_MIGRATE is not "false".
export DATA_DIR="${DATA_DIR:-/data}"
export DATABASE_URL="${DATABASE_URL:-file:${DATA_DIR}/sleeve.db}"
umask 077
exec bun server/index.ts
