#!/usr/bin/env bash
set -euo pipefail

rm -rf ./dist/ui
bun run build:ui

test -f dist/ui/index.html
test -d dist/ui/assets

shopt -s nullglob
assets=(dist/ui/assets/*)
if ((${#assets[@]} == 0)); then
  echo "No production UI assets were emitted." >&2
  exit 1
fi

if rg -q '/src/ui/main\.tsx' dist/ui/index.html; then
  echo "Production UI HTML still references the source entrypoint." >&2
  exit 1
fi

echo "Production UI artifact smoke passed: dist/ui/index.html and ${#assets[@]} asset(s) emitted."
