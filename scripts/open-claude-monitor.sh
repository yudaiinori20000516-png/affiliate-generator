#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"

osascript \
  -e 'tell application "Terminal"' \
  -e 'activate' \
  -e "do script \"cd '$ROOT_DIR' && scripts/monitor-claude-code.sh\"" \
  -e 'end tell'
