import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic();

const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID;
const RAKUTEN_AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;
const RAKUTEN_ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
const MOSHIMO_A_ID = process.env.MOSHIMO_A_ID;

function toMoshimoLink(rakutenUrl) {
  // Extract actual item URL from affiliate URL if needed
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
    console.warn(`検索失敗: ${keyword} - ${e.message}`);
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
    .map((b, i) => `${i + 1}. 「${b.itemName}」`)
    .join("\n");

  const msg = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: `以下の書籍リスト（楽天で実際に見つかった本）を使って、Note記事を書いてください。

【記事タイトル】
AI副業に関する本10冊を読んだ私が伝えたい10のこと

【書籍リスト（この順番・このタイトルで必ず書く）】
${bookListText}

【筆者プロフィール（これで一人称・体験談として書く）】
・救急救命士3年目
・プログラミング経験ゼロでAI副業始めて3ヶ月
・Claude Codeで記事自動生成・楽天アフィリリンク自動挿入を実現
・月5万達成

【記事ルール】
・文体: 友達に話すような口語。「この本マジで」「正直」「笑」など自然な口調
・AIっぽい表現・広告臭い表現禁止。書いた人の主観を出す
・Markdown記号（#[]()）禁止。NoteのUI用にプレーンテキスト
・**太文字** はOK（1段落1〜2箇所）
・見出しは「■ 1. 〜」形式
・各書籍の紹介後に必ず【LINK】マーカーを1つ入れる（合計10個）
・自己語りしすぎない。刺さる表現を優先
・「収益化」「月〇万稼ぐ」的な広告臭い言葉は避ける

【構成】
1. 冒頭フック（なぜ10冊読んだか・読む前後で変わったこと）150字程度

2. 本10冊の紹介（各200〜250字）
   各本ごとに:
   ・本のタイトル（見出し）
   ・この本で一番刺さったこと（具体的に）
   ・AI副業に活かせる具体ポイント（実体験を交えて）
   ・どんな人に向いてるか
   ・【LINK】← 必ずここに入れる

3. 10冊読んで気づいた共通点（稼げる人の思考パターン）200字

4. まとめ（note.com/ailab2026 の他の記事への誘導を自然に）100字

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
    if (result.found) {
      console.log(`  ✅ ${result.itemName.slice(0, 50)}`);
    } else {
      console.log(`  ⚠️ 見つからず: ${kw.slice(0, 40)}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("\n✍️  記事生成中...");
  let article = await generateArticle(books);

  // 【LINK】を実際のアフィリリンクに置換
  let linkIdx = 0;
  article = article.replace(/【LINK】/g, () => {
    const book = books[linkIdx++];
    if (book?.affiliateUrl) {
      return `楽天で見る → ${book.affiliateUrl}`;
    }
    return "(リンク取得失敗)";
  });

  fs.writeFileSync("./note_books_article.md", article, "utf-8");
  console.log("\n✅ note_books_article.md に保存完了");
  console.log(`文字数: ${article.length}`);
}

main().catch(console.error);
