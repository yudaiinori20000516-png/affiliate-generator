import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic();
const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID;
const RAKUTEN_AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;
const RAKUTEN_ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
const MOSHIMO_A_ID = process.env.MOSHIMO_A_ID;

function toMoshimoLink(rakutenUrl) {
  let itemUrl = rakutenUrl;
  try {
    const match = rakutenUrl.match(/[?&]pc=([^&]+)/);
    if (match) itemUrl = decodeURIComponent(match[1]);
  } catch {}
  return `https://af.moshimo.com/af/c/click?a_id=${MOSHIMO_A_ID}&p_id=54&pc_id=54&pl_id=616&url=${encodeURIComponent(itemUrl)}`;
}

async function searchBook(keyword) {
  const params = new URLSearchParams({
    applicationId: RAKUTEN_APP_ID,
    affiliateId: RAKUTEN_AFFILIATE_ID,
    accessKey: RAKUTEN_ACCESS_KEY,
    keyword,
    hits: 1,
    sort: "-reviewCount",
  });
  const url = `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401?${params}`;
  try {
    const res = await fetch(url, {
      headers: { Referer: "https://note.com/", Origin: "https://note.com" },
    });
    const data = await res.json();
    if (data.Items && data.Items.length > 0) {
      const item = data.Items[0].Item;
      return {
        itemName: item.itemName.replace(/\s*\[.*?\]\s*/g, "").trim(),
        affiliateUrl: toMoshimoLink(item.itemUrl || item.affiliateUrl),
        found: true,
      };
    }
  } catch (e) {
    console.warn(`検索失敗: ${keyword.slice(0, 30)} - ${e.message}`);
  }
  return { itemName: keyword, found: false };
}

const BOOK_KEYWORDS = [
  "毎月10万円をAIに稼いでもらう ChatGPT 副業の教科書",
  "ChatGPT 仕事術",
  "ChatGPT プロンプト 仕事",
  "コンテンツマーケティング 入門",
  "SNS 集客 マーケティング",
  "ひとりビジネス 副業",
  "ブログ 副業 アフィリエイト 稼ぐ",
  "Webライティング 副業",
  "ChatGPT 活用 入門",
  "副業 収入 アフィリエイト",
];

async function generateArticle(books) {
  const bookListText = books
    .map((b, i) => `${i + 1}. 「${b.itemName.slice(0, 50)}」`)
    .join("\n");

  const msg = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: `以下の書籍リストを使ってNote記事を書いてください。

【記事タイトル】
AI副業本10冊読んだ私が伝えたい10のこと

【書籍リスト（この順・このタイトルで書く）】
${bookListText}

【筆者設定（体験談として書く）】
・救急救命士3年目
・プログラミング経験ゼロでAI副業始めて3ヶ月
・Claude Codeで記事自動生成・楽天アフィリ自動挿入を実現
・月5万達成

【ルール】
・Markdown記号（#[]()）禁止。Noteのプレーンテキスト形式
・**太文字** はOK（1段落1〜2箇所）
・友達に話す口語。「マジで」「笑」など自然な口調。AIっぽさゼロ
・「収益化」「月〇万」的な広告臭い表現は避ける
・見出しは「■ 数字. タイトル」形式
・自己語りしすぎない。短く刺さる

【構成（この構成で書く）】

1. 冒頭フック（なぜ10冊読んだか・読んでどう変わったか）200字程度

2. 本10冊の紹介（各250〜300字）
   各本ごとに：
   ・見出し「■ 数字. 本のタイトル」
   ・この本で一番刺さったこと（具体的に）
   ・AI副業に活かせる具体ポイント（実体験を交えて）
   ・どんな人に向いてるか

   ※本3冊目の後に以下の1行を入れる（正確に）：
   【IMAGE_1: 稼げる人の思考パターン図】

   ※本7冊目の後に以下の1行を入れる（正確に）：
   【IMAGE_2: AI副業の収益化フロー図】

3. 10冊読んで気づいた共通点（300字程度）
   ・冒頭に以下の1行を入れる（正確に）：
   【IMAGE_3: 10冊に共通するポイント図】

4. まとめ・CTA（note.com/ailab2026 の他の記事を自然に案内）150字

5. 最後に以下のセクションを追加（正確に）：
   ━━━━━━━━━━━━━━━━
   📚 この記事で紹介した本（楽天リンク）
   ━━━━━━━━━━━━━━━━
   （ここに本のリストが入ります）

全文を出力してください。`,
      },
    ],
  });

  return msg.content[0].text;
}

async function main() {
  console.log("📚 書籍検索中...");
  const books = [];
  for (const kw of BOOK_KEYWORDS) {
    const result = await searchBook(kw);
    books.push(result);
    console.log(result.found ? `  ✅ ${result.itemName.slice(0, 50)}` : `  ⚠️ 見つからず: ${kw.slice(0, 40)}`);
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("\n✍️  記事生成中...");
  let article = await generateArticle(books);

  // 末尾リンクセクションに実際のリンクを挿入
  const linkSection = books
    .map((b, i) => {
      const link = b.affiliateUrl ? `楽天で見る → ${b.affiliateUrl}` : "(リンク取得失敗)";
      return `${i + 1}. ${b.itemName.slice(0, 50)}\n${link}`;
    })
    .join("\n\n");

  article = article.replace("（ここに本のリストが入ります）", linkSection);

  fs.writeFileSync("./note_books_article.md", article, "utf-8");
  console.log("\n✅ note_books_article.md に保存完了");
  console.log(`文字数: ${article.length}`);
}

main().catch(console.error);
