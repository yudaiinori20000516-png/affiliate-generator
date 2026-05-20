import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import readline from "readline";
import { TwitterApi } from "twitter-api-v2";
import { chromium } from "playwright";
import { generateThumbnail } from "./thumbnail.js";

const client = new Anthropic();

const ARTICLES_DIR = "./articles/ai-fukugyou";

// 楽天API設定
const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID;
const RAKUTEN_AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;
const RAKUTEN_ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;

// もしもアフィリエイト設定
const MOSHIMO_A_ID = process.env.MOSHIMO_A_ID;
const MOSHIMO_P_ID = "54";
const MOSHIMO_PC_ID = "54";
const MOSHIMO_PL_ID = "616";

// 楽天の商品URLをもしも経由のアフィリリンクに変換
function toMoshimoLink(rakutenItemUrl) {
  if (!MOSHIMO_A_ID || !rakutenItemUrl) return rakutenItemUrl;
  const encoded = encodeURIComponent(rakutenItemUrl);
  return `https://af.moshimo.com/af/c/click?a_id=${MOSHIMO_A_ID}&p_id=${MOSHIMO_P_ID}&pc_id=${MOSHIMO_PC_ID}&pl_id=${MOSHIMO_PL_ID}&url=${encoded}`;
}

function ensureArticlesDir() {
  if (!fs.existsSync(ARTICLES_DIR)) {
    fs.mkdirSync(ARTICLES_DIR, { recursive: true });
  }
}

function sanitizeFilename(title) {
  return title
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .slice(0, 50);
}

function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

// コメントからキーワードを抽出する
// 例: <!-- ChatGPT本 -->【LINK】 → "ChatGPT本"
function extractKeywordFromComment(comment) {
  const match = comment.match(/<!--\s*(.+?)\s*-->/);
  return match ? match[1] : null;
}

// 楽天市場APIで商品検索してアフィリリンクを返す
async function searchRakutenItem(keyword) {
  try {
    const params = new URLSearchParams({
      applicationId: RAKUTEN_APP_ID,
      affiliateId: RAKUTEN_AFFILIATE_ID,
      accessKey: RAKUTEN_ACCESS_KEY,
      keyword: keyword,
      hits: 1,
      sort: "-reviewCount", // レビュー数順（人気順）
    });

    const url = `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401?${params}`;
    const res = await fetch(url, { headers: { Referer: "https://note.com/", Origin: "https://note.com" } });
    const data = await res.json();

    if (data.Items && data.Items.length > 0) {
      const item = data.Items[0].Item;
      const itemName = item.itemName;
      const affiliateUrl = toMoshimoLink(item.itemUrl || item.affiliateUrl);
      return { itemName, affiliateUrl };
    }
  } catch (e) {
    console.warn(`楽天API検索失敗 (${keyword}):`, e.message);
  }
  return null;
}

// 楽天ブックスAPIで書籍検索してアフィリリンクを返す
async function searchRakutenBook(keyword) {
  try {
    const params = new URLSearchParams({
      applicationId: RAKUTEN_APP_ID,
      affiliateId: RAKUTEN_AFFILIATE_ID,
      accessKey: RAKUTEN_ACCESS_KEY,
      title: keyword,
      hits: 1,
      sort: "-reviewCount",
    });

    const url = `https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404?${params}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.Items && data.Items.length > 0) {
      const item = data.Items[0].Item;
      const itemName = item.title;
      const affiliateUrl = toMoshimoLink(item.itemUrl || item.affiliateUrl);
      return { itemName, affiliateUrl };
    }
  } catch (e) {
    console.warn(`楽天ブックスAPI検索失敗 (${keyword}):`, e.message);
  }
  return null;
}

// コメント付き【LINK】を実際のリンクに置換する
async function replaceLinks(content) {
  // <!-- キーワード -->【LINK】 のパターンを全て抽出
  const pattern = /(<!--\s*.+?\s*-->)【LINK】/g;
  const matches = [...content.matchAll(pattern)];

  if (matches.length === 0) return content;

  let result = content;

  for (const match of matches) {
    const fullMatch = match[0]; // <!-- キーワード -->【LINK】
    const comment = match[1];   // <!-- キーワード -->
    const keyword = extractKeywordFromComment(comment);

    if (!keyword) continue;

    console.log(`  🔍 楽天検索中: "${keyword}"`);

    // まず楽天ブックスで検索、なければ楽天市場で検索
    let item = await searchRakutenBook(keyword);
    if (!item) {
      item = await searchRakutenItem(keyword);
    }

    if (item) {
      // Noteはhref形式のHTMLが使えないのでURLのみ記載
      const linkText = `${item.itemName}\n${item.affiliateUrl}`;
      result = result.replace(fullMatch, linkText);
      console.log(`  ✅ リンク挿入: ${item.itemName.slice(0, 30)}...`);
    } else {
      // 見つからなかった場合はマーカーごと削除（余計なテキストを残さない）
      result = result.replace(fullMatch, "");
      console.log(`  ⚠️  商品未発見のためスキップ: ${keyword}`);
    }

    // API制限対策で少し待つ
    await new Promise(r => setTimeout(r, 500));
  }

  return result;
}

async function generateArticle(title) {
  const prompt = `あなたは以下のプロフィールの人物として、Noteに記事を書いています。

【プロフィール（固定）】
- 職種：救急救命士
- 職場：総合病院
- 勤続年数：3年
- AI副業を始めて収益化に取り組んでいる

以下のタイトルで記事を書いてください。

タイトル: ${title}

文体・トーンの要件:
- 話し言葉ベース。「〜ですよね」「〜なんですよ」「〜だったりするんで」など自然な口語
- 「笑」など感情表現を要所で使う（多すぎず、1記事に2〜3回）
- 体験談ベースで書く。「自分がやってみたら〜だった」「最初は全然うまくいかなくて」など
- 救急救命士として総合病院で3年働いている背景を自然に滲ませる（毎回強調しすぎない）
- AIっぽい・マーケティングっぽい言い回しは禁止（「〜をぜひ」「〜してみませんか」「画期的な」など）
- 難しい言葉は使わない。友達に話すくらいの温度感で
- 変な空白行は作らない。改行は適度に使って読みやすくする

構成の要件:
- 文字数は約2000字
- 読者の悩みに共感する導入から始める
- 商品・サービスを自然な流れで紹介する
- アフィリエイトリンクを挿入すべき箇所に【LINK】マーカーを入れる（2〜4箇所）
- 【LINK】の前に楽天検索用のコメントを入れる（例: <!-- ChatGPT 仕事術 本 -->【LINK】）
- 読み終わった人が「やってみよう」と思えるまとめで締める
- #、##、###、[]、()などのMarkdown記号は使わない
- 見出しは【ステップ1】【壁1】【まとめ】などの形式で
- 見出し行はその行だけで完結させる
- 重要なポイントは **テキスト** で太文字にする（1段落に1〜2箇所）
- 箇条書き記号なし、プレーンテキストのみ（太文字**のみ使用可）
- リンクマーカーは【LINK】のみ使用可

記事本文のみを出力してください（タイトルは含めないでください）。`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].text;
}

function cleanMarkdown(text) {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^[-+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^>\s+/gm, "")
    .replace(/---+/g, "")
    .replace(/===+/g, "");
}

function generateToc(content) {
  const headings = [];
  const lines = content.split("\n");
  for (const line of lines) {
    const match = line.match(/^【(.+?)】(.*)$/);
    if (!match) continue;
    const prefix = match[1];
    const rest = match[2].trim();
    if (rest) {
      headings.push(rest);
    } else {
      headings.push(prefix);
    }
  }
  if (headings.length === 0) return "";
  const tocLines = headings.map((h, i) => `${i + 1}. ${h}`);
  return "【目次】\n" + tocLines.join("\n") + "\n";
}

function saveArticle(title, content) {
  ensureArticlesDir();
  const timestamp = getTimestamp();
  const safeTitle = sanitizeFilename(title);
  const filename = `${timestamp}_${safeTitle}.md`;
  const filepath = path.join(ARTICLES_DIR, filename);

  const toc = generateToc(content);
  const fullContent = `${title}\n生成日時: ${new Date().toLocaleString("ja-JP")}\n\n${toc}\n${content}`;
  fs.writeFileSync(filepath, fullContent, "utf-8");

  return filepath;
}

async function promptTitle() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("記事タイトルを入力してください: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function loadTitles(filepath) {
  const text = fs.readFileSync(filepath, "utf-8");
  return text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}

async function generateXThread(title) {
  const prompt = `あなたは救急救命士として総合病院で3年働きながら、AI副業をやっている人間です。Xで発信しています。

以下の記事タイトルをもとに、X投稿文を1本作ってください。

記事タイトル: ${title}

文体・トーンの要件:
- 話し言葉ベース。「〜ですよね」「マジで」「笑」など現代人っぽい表現を自然に使う
- 体験談として書く
- AIっぽい・広告っぽい言い回しは絶対禁止
- 1文ごとに改行して縦に読めるようにする
- 意味のない空白行は入れない

投稿の構成（1投稿に全部収める）:
1. 読者が「これ自分のことだ」と思う悩み・共感から入る
   例: 「もしかして〇〇で悩んでいませんか？」「〇〇なのに結果が出ない、なんで？」
2. 解決策・気づきのエッセンスを2〜3行で
3. さらっとNoteへ誘導（URLなし）
   例:「詳しくはプロフのNoteに」「気になった人はNoteも見てみて」
4. ハッシュタグ: #ClaudeCode #AI副業 #副業術

ルール:
- 280文字以内厳守
- URLは入れない
- 広告・誘導っぽい表現禁止

投稿文のみ出力。説明文不要。`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].text.trim();
  return [raw];
}

async function generateThreadsPost(title) {
  const prompt = `あなたは救急救命士として総合病院で3年働きながら、AI副業をやっている人間です。Threadsで発信しています。

以下の記事タイトルをもとに、Threads投稿文を1つだけ作ってください。

記事タイトル: ${title}

文体・トーンの要件:
- 話し言葉ベース。現代人っぽい表現を自然に使う（「マジで」「笑」など）
- 体験談として書く
- AIっぽい・広告っぽい言い回しは禁止
- 1文ごとに改行して読みやすく
- 意味のない空白行は入れない

投稿の要件:
- 悩み誘発から入る。「〇〇で悩んでいませんか？」「実は〇〇してる人ほど損してます」など
- 具体的な体験・気づき・解決策のエッセンスを書く
- 最後に「詳しくはNoteにまとめてあります」などさらっと誘導（URLは入れない）
- ハッシュタグ: #ClaudeCode #AI副業 #副業術
- 300字以内

投稿文のみ出力。説明文不要。`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].text.trim();
  return [text, "[NOTE_URL]"];
}

async function postToThreads(title, noteUrl) {
  const token = process.env.THREADS_ACCESS_TOKEN;
  const userId = process.env.THREADS_USER_ID;
  if (!token || !userId) {
    console.warn("  ⚠️  THREADS_ACCESS_TOKEN または THREADS_USER_ID が未設定。スキップします。");
    return;
  }

  const posts = await generateThreadsPost(title);

  try {
    let replyToId = null;
    for (let i = 0; i < posts.length; i++) {
      const text = posts[i].replace("[NOTE_URL]", noteUrl || "");

      // メディアコンテナ作成
      const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "TEXT",
          text,
          access_token: token,
          ...(replyToId ? { reply_to_id: replyToId } : {}),
        }),
      });
      const createData = await createRes.json();

      if (createData.error) {
        console.warn(`  ⚠️  Threads投稿${i + 1}作成失敗:`, createData.error.message);
        continue;
      }

      // 少し待ってから公開
      await new Promise(r => setTimeout(r, 2000));

      const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: createData.id,
          access_token: token,
        }),
      });
      const publishData = await publishRes.json();

      if (publishData.error) {
        console.warn(`  ⚠️  Threads投稿${i + 1}公開失敗:`, publishData.error.message);
        continue;
      }

      replyToId = publishData.id;
      console.log(`  ✅ Threads投稿${i + 1}完了: https://www.threads.net/t/${publishData.id}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (e) {
    console.warn(`  ⚠️  Threads投稿失敗: ${e.message}`);
  }
}

async function postToX(title) {
  const xClient = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });

  const tweets = await generateXThread(title);

  try {
    const tweet = await xClient.v2.tweet(tweets[0]);
    console.log(`  ✅ X投稿完了: https://x.com/i/web/status/${tweet.data.id}`);
  } catch (e) {
    console.warn(`  ⚠️  X投稿失敗: ${e.message}`);
  }
}

async function postToNote(title, body, thumbnailPath) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // ログイン
    console.log("  📝 Noteにログイン中...");
    await page.goto("https://note.com/login");
    await page.waitForTimeout(3000);

    const emailSelectors = [
      'input[name="email"]',
      'input[type="email"]',
      'input[placeholder*="メール"]',
      'input[placeholder*="mail"]',
    ];
    let emailFilled = false;
    for (const sel of emailSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        await page.fill(sel, process.env.NOTE_EMAIL);
        emailFilled = true;
        break;
      } catch {}
    }
    if (!emailFilled) throw new Error("メール入力欄が見つかりません");

    for (const sel of ['input[name="password"]', 'input[type="password"]']) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        await page.fill(sel, process.env.NOTE_PASSWORD);
        break;
      } catch {}
    }

    await page.click('button:has-text("ログイン")');
    await page.waitForTimeout(4000);

    // 新規記事ページへ
    console.log("  ✏️  新規記事ページへ移動...");
    await page.goto("https://note.com/notes/new");
    await page.waitForTimeout(3000);

    // タイトル入力
    const titleSelector = 'textarea[placeholder="記事タイトル"]';
    await page.waitForSelector(titleSelector, { timeout: 10000 });
    await page.click(titleSelector);
    await page.fill(titleSelector, title);
    await page.waitForTimeout(500);

    // サムネイル画像をアップロード（本文入力前に最初の要素として挿入）
    if (thumbnailPath) {
      console.log("  🖼️  サムネイル画像をアップロード中...");
      const bodySelector2 = '.ProseMirror, [contenteditable="true"]';
      await page.waitForSelector(bodySelector2, { timeout: 10000 });
      await page.click(bodySelector2);
      await page.waitForTimeout(500);
      await page.locator('[aria-label="画像を追加"]').first().click();
      await page.waitForTimeout(1000);
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 8000 }),
        page.locator("text=画像をアップロード").click(),
      ]);
      await fileChooser.setFiles(thumbnailPath);
      await page.waitForTimeout(3000);
      // トリミングダイアログの「保存」ボタン（「下書き保存」ではなく正確に「保存」のみ）
      const cropSaveBtn = page.locator('button').filter({ hasText: /^保存$/ });
      await cropSaveBtn.waitFor({ timeout: 10000 });
      await cropSaveBtn.click();
      await page.waitForTimeout(3000);
      console.log("  ✅ サムネイル挿入完了");
    }

    // 本文入力
    console.log("  📄 本文を入力中...");
    const bodySelector = '.ProseMirror, [contenteditable="true"]';
    await page.waitForSelector(bodySelector, { timeout: 10000 });
    // 画像の後ろにカーソルを移動
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    const chunks = body.match(/.{1,500}/gs) || [body];
    for (const chunk of chunks) {
      await page.keyboard.type(chunk);
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(1000);

    // 公開に進む
    console.log("  ⚙️  公開設定へ...");
    await page.click('button:has-text("公開に進む")');
    await page.waitForTimeout(3000);

    // ハッシュタグを入力
    console.log("  🏷️  ハッシュタグを設定中...");
    const hashtags = ["AI副業", "ClaudeCode", "副業術", "救急救命士", "ChatGPT活用"];
    const hashtagInput = page.locator('input[placeholder*="ハッシュタグ"]');
    if (await hashtagInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      for (const tag of hashtags) {
        await hashtagInput.click();
        await hashtagInput.fill(tag);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(500);
      }
      console.log("  ✅ ハッシュタグ設定完了");
    }

    // 投稿する
    console.log("  🚀 投稿中...");
    const publishBtn = page.locator('button:has-text("投稿する")').last();
    await publishBtn.click();
    await page.waitForTimeout(4000);

    // 公開完了確認
    const url = page.url();
    console.log(`  ✅ Note公開完了！ ${url}`);
    await page.waitForTimeout(2000);

    return url;
  } finally {
    await browser.close();
  }
}

function parseArticleBody(filepath) {
  const raw = fs.readFileSync(filepath, "utf-8");
  const lines = raw.split("\n");
  const bodyStart = lines.findIndex((l, i) => i > 2 && l.trim() && !l.startsWith("生成日時") && !l.startsWith("【目次】") && !/^\d+\./.test(l));
  return lines.slice(bodyStart).join("\n").trim();
}

async function processTitle(title) {
  console.log(`\n「${title}」の記事を生成中...\n`);
  const rawContent = await generateArticle(title);
  const cleaned = cleanMarkdown(rawContent);

  console.log("\n📦 楽天アフィリリンクを挿入中...");
  const content = await replaceLinks(cleaned);

  const filepath = saveArticle(title, content);
  const charCount = content.length;
  const linkCount = (content.match(/【LINK】/g) || []).length;
  const replacedCount = (rawContent.match(/【LINK】/g) || []).length - linkCount;

  console.log("=".repeat(50));
  console.log("生成完了!");
  console.log(`保存先: ${filepath}`);
  console.log(`文字数: 約${charCount}字`);
  console.log(`リンク挿入済み: ${replacedCount}箇所`);
  if (linkCount > 0) console.log(`未置換【LINK】: ${linkCount}箇所`);
  console.log("=".repeat(50));

  console.log("\n🖼️  サムネイル生成中...");
  const thumbnailPath = await generateThumbnail(title);
  console.log(`  サムネイル: ${thumbnailPath}`);

  console.log("\n🐦 Xに投稿中...");
  await postToX(title);

  console.log("\n📓 Noteに投稿中（サムネイル付き）...");
  const body = parseArticleBody(filepath);
  const noteUrl = await postToNote(title, body, thumbnailPath);

  console.log("\n🧵 Threadsに投稿中...");
  await postToThreads(title, noteUrl);
}

async function main() {
  const arg = process.argv[2];
  const titlesFile = path.resolve("./titles.txt");

  if (!arg || arg === "--file") {
    if (!fs.existsSync(titlesFile)) {
      console.error("titles.txt が見つかりません。");
      process.exit(1);
    }
    const titles = loadTitles(titlesFile);
    if (titles.length === 0) {
      console.error("titles.txt にタイトルが見つかりません。");
      process.exit(1);
    }
    console.log(`titles.txt から ${titles.length} 件のタイトルを読み込みました。`);
    for (const title of titles) {
      await processTitle(title);
    }
    return;
  }

  await processTitle(arg);
}

main().catch((err) => {
  console.error("エラーが発生しました:", err.message);
  process.exit(1);
});
