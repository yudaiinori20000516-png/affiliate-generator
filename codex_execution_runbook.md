# Codex 実行役ランブック

Claude Codeが `claude_code_director_strategy.md` に沿って戦略を作る。
Codexはその戦略を受けて、記事作成、リンク挿入、サムネイル生成、SNS投稿、Note投稿を実行する。

## 役割分担

Claude Code:
- 過去データから売れる記事構成を考える
- 10記事案の読者痛み、フック、構成、導線を決める
- ベストセラー実用書のように読みやすい順番へ整える
- テンプレ感や広告臭を削る

Codex:
- Claude Codeの戦略を `titles_claudecode_sidebusiness.txt` と記事生成プロンプトへ反映する
- `generate.js` で記事本文を生成する
- 楽天/もしもアフィリエイトリンクを挿入する
- サムネイルを生成する
- X、Note、Threadsへ投稿する
- 投稿結果をログとして残す

## Claude Codeがログイン済みの場合

```bash
claude -p "$(cat claude_code_director_strategy.md)" > claude_code_strategy_output.md
```

## Codex側の投稿実行

公開投稿まで進むため、実行前に以下の環境変数が必要。

```bash
export ANTHROPIC_API_KEY=...
export RAKUTEN_APP_ID=...
export RAKUTEN_AFFILIATE_ID=...
export RAKUTEN_ACCESS_KEY=...
export MOSHIMO_A_ID=...
export X_API_KEY=...
export X_API_SECRET=...
export X_ACCESS_TOKEN=...
export X_ACCESS_TOKEN_SECRET=...
export NOTE_EMAIL=...
export NOTE_PASSWORD=...
export THREADS_ACCESS_TOKEN=...
export THREADS_USER_ID=...
```

`generate.js` はデフォルトで `titles.txt` を読むため、10本を一括投稿する場合は、内容確認後に以下を行う。

```bash
cp titles.txt titles.backup.txt
cp titles_claudecode_sidebusiness.txt titles.txt
node generate.js --file
```

## 運用メモ

- 10本一括投稿は重いので、最初は1本だけ `node generate.js "タイトル"` で試す
- NoteはPlaywrightによる画面操作なので、ログイン画面やUI変更で止まる可能性がある
- X投稿はURLなし、ハッシュタグ3個固定の生成ルールを使う
- Threadsは1投稿目本文、2投稿目Note URLのスレッド形式
- 投稿前に下書き確認したい場合は `note-post.js` 側の下書き運用に切り替える
