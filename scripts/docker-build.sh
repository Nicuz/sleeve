#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_root"

version="$(bun -e 'console.log(require("./package.json").version)')"
commit="$(git rev-parse --short HEAD)"
build_date="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
dirty=false
if [ -n "$(git status --porcelain)" ]; then
  dirty=true
fi

image="sleeve:${version}"

echo "Building ${image} and sleeve:latest…"
docker build --target release \
  --build-arg SLEEVE_VERSION="$version" \
  --build-arg SLEEVE_COMMIT="$commit" \
  --build-arg SLEEVE_DIRTY="$dirty" \
  --build-arg SLEEVE_BUILD_DATE="$build_date" \
  -t "$image" \
  -t sleeve:latest \
  .
