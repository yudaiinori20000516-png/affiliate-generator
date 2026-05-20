#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

EVENT="manual"
BEFORE=""
AFTER="$(git rev-parse HEAD)"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --event)
      EVENT="${2:-manual}"
      shift 2
      ;;
    --before)
      BEFORE="${2:-}"
      shift 2
      ;;
    --after)
      AFTER="${2:-$AFTER}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

LOG_DIR="$ROOT_DIR/claude_code_conversations"
mkdir -p "$LOG_DIR"

TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
BRANCH="$(git branch --show-current 2>/dev/null || true)"
LOG_FILE="$LOG_DIR/${TIMESTAMP}-${EVENT}.md"
LATEST_FILE="$LOG_DIR/latest.md"
PROMPT_FILE="$(mktemp)"

if [[ -n "$BEFORE" ]] && git cat-file -e "${BEFORE}^{commit}" 2>/dev/null; then
  RANGE="${BEFORE}..${AFTER}"
elif git cat-file -e "${AFTER}^" 2>/dev/null; then
  RANGE="${AFTER}^..${AFTER}"
else
  RANGE="$AFTER"
fi

COMMITS="$(git log --oneline "$RANGE" 2>/dev/null || git log -1 --oneline "$AFTER")"
STAT="$(git diff --stat "$RANGE" 2>/dev/null || true)"
FILES="$(git diff --name-only "$RANGE" 2>/dev/null || true)"
LAST_COMMIT="$(git show --no-patch --format='%h %s%nAuthor: %an%nDate: %ad' "$AFTER")"

ln -sf "$(basename "$LOG_FILE")" "$LATEST_FILE"

cat > "$PROMPT_FILE" <<EOF
あなたはClaude Codeです。Codexが変更をpushしたので、指示役として変更内容を確認してください。

目的:
- Codexが実行した変更を把握する
- 次に改善すべき点、リスク、確認観点を短く返す
- 直接ファイル編集はしない
- 返答は日本語

イベント: ${EVENT}
ブランチ: ${BRANCH}
対象コミット範囲: ${RANGE}

最新コミット:
${LAST_COMMIT}

pushされたコミット:
${COMMITS}

変更ファイル:
${FILES}

差分サマリ:
${STAT}

確認してほしいこと:
1. この変更の意図が自然か
2. affiliate-generatorの運用上のリスクがないか
3. Note/X/Threads投稿フローに影響する点がないか
4. 次にCodexへ依頼すべき具体的な改善があれば挙げる
EOF

append_log() {
  tee -a "$LOG_FILE"
}

{
  echo "# Claude Code Conversation"
  echo
  echo "- Time: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "- Event: ${EVENT}"
  echo "- Branch: ${BRANCH}"
  echo "- Range: ${RANGE}"
  echo
  echo "## Prompt Sent To Claude Code"
  echo
  sed 's/^/> /' "$PROMPT_FILE"
  echo
  echo "## Claude Code Response"
  echo
} | append_log

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code CLI が見つかりません。" | append_log
else
  set +e
  claude -p "$(cat "$PROMPT_FILE")" 2>&1 | append_log
  claude_status=${PIPESTATUS[0]}
  set -e
  if [[ $claude_status -ne 0 ]]; then
    {
      echo
      echo "Claude Code notification failed with exit code ${claude_status}."
    } | append_log
  fi
fi

rm -f "$PROMPT_FILE"

echo
echo "Claude Code conversation saved: $LOG_FILE"
