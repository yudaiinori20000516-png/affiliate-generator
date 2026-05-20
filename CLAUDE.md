# affiliate-generator

## 基本情報
- アカウント: AIツール研究所 / note.com/ailab2026
- キャラ: 救急救命士3年・プログラミング経験ゼロ・AI副業で月5万達成
- 承認なしで進めてOK
- 環境変数は `.env` から `$(grep ^KEY= .env | cut -d'=' -f2)` で読む（dotenv未使用）

## 主要スクリプト
| ファイル | 役割 |
|---|---|
| `generate.js` | 記事生成→楽天リンク→サムネイル→X→Note→Threads 全自動 |
| `gen-premium-article.js` | 有料記事生成・投稿（500〜980円） |
| `repost-premium.js` | 既存記事の集客投稿を再生成・再投稿 |
| `gen-social-posts.js` | SNS投稿文バッチ生成→x_posts.txt保存 |
| `post-all-latest.js` | x_posts.txtからX+Threads一括投稿 |
| `gen-reply.js` | バズ投稿URLから返信文生成（手動投稿用） |

## 文体ルール（全媒体共通）
- 救急救命士・プログラミング経験ゼロの体験談として書く
- 話し言葉。「マジで」「笑」など自然な口語。「笑」は1記事2〜3回まで
- AIっぽい・広告っぽい表現禁止
- 自分語りしすぎない。短く刺さる表現を優先

## 投稿ルール
**X:** 1投稿完結・280文字以内 / 共感フック→解決策→Note誘導（URLなし）→ハッシュタグ3つ / NG: URL・「収益化」「月〇万稼ぐ」

**Threads:** 1/2本文（ハッシュタグなし）→ 2/2 NoteのURLのみ / 問いかけ・余韻で終わる

**Note:** 見出しは【ステップ1】形式・Markdown記号（#[]()）禁止 / 重要箇所は **太文字**（1段落1〜2箇所）

## アフィリエイト
- もしも: `a_id=5550851 / p_id=pc_id=pl_id=54,54,616`
- リンク: `https://af.moshimo.com/af/c/click?a_id=5550851&p_id=54&pc_id=54&pl_id=616&url=【楽天URLをencodeURIComponent】`
- 楽天API: IchibaItem `openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401`
- 必須ヘッダー: `Referer: https://note.com/` + `Origin: https://note.com`
