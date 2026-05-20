#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

LOG_DIR="$ROOT_DIR/claude_code_conversations"
LATEST_FILE="$LOG_DIR/latest.md"
mkdir -p "$LOG_DIR"

if [[ ! -e "$LATEST_FILE" ]]; then
  WAIT_FILE="$LOG_DIR/waiting-for-claude-code.md"
  {
    echo "# Claude Code Monitor"
    echo
    echo "Claude Code notification logs will appear here after \`git codex-push\` or \`npm run notify:claude\`."
  } > "$WAIT_FILE"
  ln -sf "$(basename "$WAIT_FILE")" "$LATEST_FILE"
fi

echo "Monitoring Claude Code conversations:"
echo "  $LATEST_FILE"
echo
tail -n 120 -F "$LATEST_FILE"
