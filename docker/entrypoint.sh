#!/bin/sh
set -eu
# Migrations run automatically from server/index.ts when AUTO_MIGRATE is not "false".
exec bun server/index.ts
