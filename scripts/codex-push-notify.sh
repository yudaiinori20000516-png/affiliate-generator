#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

UPSTREAM_BEFORE="$(git rev-parse --verify @{u} 2>/dev/null || true)"
HEAD_AFTER="$(git rev-parse HEAD)"

git push "$@"

"$ROOT_DIR/scripts/notify-claude-code.sh" \
  --event "post-push" \
  --before "$UPSTREAM_BEFORE" \
  --after "$HEAD_AFTER"
