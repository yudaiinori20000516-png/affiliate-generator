#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

mkdir -p "$ROOT_DIR/claude_code_conversations"

git config alias.codex-push '!scripts/codex-push-notify.sh'

echo "Installed git alias:"
echo "  git codex-push"
echo
echo "Use it instead of git push when Codex pushes changes:"
echo "  git codex-push origin HEAD"
echo
echo "Claude Code conversation logs will be saved in:"
echo "  claude_code_conversations/"
