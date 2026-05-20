#!/bin/bash

# Node.jsのパスを取得
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
  echo "ERROR: Node.js が見つかりません"
  exit 1
fi

DIR="$(cd "$(dirname "$0")" && pwd)"
CRON_CMD="0 9 * * * ANTHROPIC_API_KEY=\"${ANTHROPIC_API_KEY}\" $NODE_PATH $DIR/scheduler.js >> $DIR/scheduler.log 2>&1"

# 既存のcronから同じエントリを除いて追加
(crontab -l 2>/dev/null | grep -v "scheduler.js"; echo "$CRON_CMD") | crontab -

echo "✅ cronに登録しました（毎朝9時に自動実行）"
echo ""
echo "登録内容:"
crontab -l | grep scheduler.js
echo ""
echo "確認コマンド: crontab -l"
echo "削除コマンド: crontab -l | grep -v scheduler.js | crontab -"
