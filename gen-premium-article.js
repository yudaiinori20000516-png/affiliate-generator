/**
 * Claude Code完全自動化 プレミアム有料記事生成・投稿スクリプト
 * Note 500円有料記事 + X/Threads 集客投稿
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { TwitterApi } from "twitter-api-v2";
import { chromium } from "playwright";
import { generateThumbnail } from "./thumbnail.js";
import { toPublicNoteUrl, validatePaidPrice } from "./paid-note.js";

const client = new Anthropic();

const TITLE = "【完全保存版】Claude Codeで副業を全自動化した全手順｜ゼロから月5万円の仕組みを作るまでにやったこと全部";
const PRICE = validatePaidPrice(500);

// もしもアフィリエイト設定
const MOSHIMO_A_ID = process.env.MOSHIMO_A_ID;
function toMoshimoLink(itemUrl) {
  if (!MOSHIMO_A_ID || !itemUrl) return itemUrl;
  return `https://af.moshimo.com/af/c/click?a_id=${MOSHIMO_A_ID}&p_id=54&pc_id=54&pl_id=616&url=${encodeURIComponent(itemUrl)}`;
}

// 楽天で商品検索してもしもリンクを返す
async function searchRakuten(keyword) {
  try {
    const params = new URLSearchParams({
      applicationId: process.env.RAKUTEN_APP_ID,
      keyword,
      hits: 1,
      sort: "-reviewCount",
    });
    const res = await fetch(`https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401?${params}`, {
      headers: { Referer: "https://note.com/", Origin: "https://note.com" },
    });
    const data = await res.json();
    if (data.Items?.length > 0) {
      const item = data.Items[0].Item;
      return { name: item.itemName.slice(0, 40), url: toMoshimoLink(item.itemUrl) };
    }
  } catch {}
  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. 記事本文生成（3パートに分割して生成）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function generateArticle() {
  console.log("📝 記事生成中（3パート構成）...");

  const baseProfile = `あなたは救急救命士として総合病院で3年働きながら、AI副業で収益化に成功した人間です。
プログラミング経験ゼロから始めて、Claude Codeを使った完全自動化の仕組みを作りました。
話し言葉ベース、体験談スタイル、AIっぽい表現・広告っぽい表現は禁止。`;

  const part1Prompt = `${baseProfile}

「${TITLE}」の記事を書いています。
以下の【パート1】を執筆してください。文字数は約3000字。

【パート1: 導入〜全体像】
・冒頭：共感できる悩みから入る導入（救命士として副業を始めた背景）
・この記事で学べること（箇条書き）
・Claude Code副業自動化の全体像（フロー図テキスト版）
  → タイトル決め → 記事生成 → 楽天リンク挿入 → サムネイル生成 → Note投稿 → X/Threads投稿
・必要なツール・アカウント一覧（コピペしやすいリスト形式）
  → Anthropic API、楽天アフィリエイト、もしもアフィリエイト、Note、X、Threads、Node.js
・初期費用と月額コストの目安（実際の数字）

フォーマット規則：
- 見出しは【ステップ○】【準備】【全体像】などの形式
- 重要箇所は **太文字** で
- Markdown記号（#・[]・()）は使わない
- 箇条書きは「・」で統一
- コードや設定値は「\`\`」で囲む（例：\`node generate.js "タイトル"\`）
- アフィリリンク挿入箇所に <!-- キーワード -->【LINK】を入れる（2箇所）
  例：<!-- Claude Code 入門 本 -->【LINK】

本文のみ出力（タイトルは含めない）。`;

  const part2Prompt = `${baseProfile}

「${TITLE}」の記事【パート2】を執筆してください。文字数は約3000字。

【パート2: 環境構築〜スクリプト実行】
・Node.jsのセットアップ（コピペできるコマンド付き）
・.envファイルの作り方と各APIキーの取得方法（Anthropic/楽天/もしも）
  → 実際の.envの書き方をコードブロックで示す
・generate.jsの使い方（実際に動かすコマンドをそのまま貼れる形で）
・つまずきポイントTOP3と解決策（自分が実際にハマったこと）
・記事生成プロンプトのチューニング方法（コピペして使えるプロンプト例を2個）
  → AI副業系プロンプト
  → 別ジャンル展開用プロンプト
・楽天アフィリリンクが通らない時の対処法

フォーマット規則（パート1と同じ）：
- 見出しは【ステップ○】形式
- コマンドは \`\`で囲む
- アフィリリンク挿入箇所に <!-- キーワード -->【LINK】を2箇所入れる

本文のみ出力。`;

  const part3Prompt = `${baseProfile}

「${TITLE}」の記事【パート3】を執筆してください。文字数は約2500字。

【パート3: X/Threads自動投稿〜収益化戦略】
・X・Threadsへの自動投稿の仕組み（実際のpost-all-latest.jsの使い方）
・投稿フォーマットのコツ（バズりやすいX投稿の型をコピペ形式で3つ）
・もしもアフィリエイトの設定方法と楽天リンクとの違い
・月5万円までのロードマップ（週次・月次の行動計画）
  → 1週目：環境構築と最初の5記事
  → 2〜4週目：毎日1本生成・投稿
  → 2〜3ヶ月目：SNS集客の型を固める
  → 3ヶ月目〜：ジャンル横展開
・実際の収益スクリーンショット公開（数字だけ言及、具体的に）
・読者へのまとめ・背中を押す締め

フォーマット規則（パート1・2と同じ）：
- アフィリリンク挿入箇所に <!-- キーワード -->【LINK】を2箇所入れる

本文のみ出力。`;

  const [p1, p2, p3] = await Promise.all([
    client.messages.create({ model: "claude-opus-4-6", max_tokens: 4096, messages: [{ role: "user", content: part1Prompt }] }),
    client.messages.create({ model: "claude-opus-4-6", max_tokens: 4096, messages: [{ role: "user", content: part2Prompt }] }),
    client.messages.create({ model: "claude-opus-4-6", max_tokens: 4096, messages: [{ role: "user", content: part3Prompt }] }),
  ]);

  const body = [p1, p2, p3].map(m => m.content[0].text).join("\n\n");
  console.log(`  ✅ 記事生成完了（${body.length}字）`);
  return body;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. アフィリリンク挿入
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function insertLinks(body) {
  console.log("🔗 もしもアフィリリンク挿入中...");
  const regex = /<!--\s*(.+?)\s*-->【LINK】/g;
  let result = body;
  const matches = [...body.matchAll(regex)];
  for (const match of matches) {
    const keyword = match[1];
    const item = await searchRakuten(keyword);
    if (item) {
      result = result.replace(match[0], `[${item.name}](${item.url})`);
      console.log(`  ✅ ${keyword} → リンク挿入`);
    } else {
      result = result.replace(match[0], "");
      console.log(`  ⚠️  ${keyword} → 商品未発見`);
    }
  }
  return result;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. X集客投稿（5本）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function generateXPosts() {
  console.log("🐦 X集客投稿文を生成中...");
  const prompt = `あなたは救急救命士として総合病院で3年働きながらClaude Codeで副業を完全自動化した人間です。

Noteの有料記事（500円）への集客用X投稿を5本作成してください。

記事タイトル: ${TITLE}

各投稿は1投稿完結（280文字以内）。

投稿の構成（毎回この流れで）:
1. 読者が「これ自分のことだ」と思う悩み・共感から入る
2. 解決策・気づきのエッセンスを2〜3行で
3. さらっとNoteへ誘導（URLなし）
   例:「詳しくはプロフのNoteに」「気になった人はNoteも見てみて」
4. ハッシュタグ: #ClaudeCode #AI副業 #副業術

5本それぞれ別の入り方にすること：
1. 「もしかして〇〇で悩んでいませんか？」型
2. 「〇〇なのに結果が出ない理由、知っていますか？」型
3. 「実は〇〇している人ほど損をしています」型
4. 具体的なシーン描写で「わかる〜これ私だ」と思わせる型
5. 「〇〇なのにまだ〇〇してる人、ちょっと待って」型

ルール：
- 280文字以内厳守
- URLは入れない
- 話し言葉・体験談スタイル、AIっぽい表現禁止
- 1文ごとに改行して縦に読めるようにする

出力形式（厳守）：
[投稿1]
（本文）
===
[投稿2]
...`;

  const msg = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 3000,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content[0].text;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. Threads集客投稿（3本）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function generateThreadsPosts() {
  console.log("🧵 Threads集客投稿文を生成中...");
  const prompt = `あなたは救急救命士として総合病院で3年働きながらClaude Codeで副業を完全自動化した人間です。

Noteの有料記事（500円）への集客用Threads投稿を3本作成してください。

記事タイトル: ${TITLE}

各投稿のルール：
- 300字以内の単発投稿
- 話し言葉・体験談スタイル
- 悩み誘発→共感→解決策の流れで書く
  例：「〇〇で悩んでいませんか？」→「自分もそうだった」→「こうしたら変わった」
- 3本それぞれ別の角度から（失敗談編・環境構築編・収益化編）
- URLは入れない（Noteリンクも入れない）
- 最後にさらっと会話の続きのようにNoteへ誘導
  例：「詳しいやり方、Noteにまとめてあります」
- ハッシュタグ: #ClaudeCode #AI副業 #副業術（3つ全部）
- 1文ごとに改行して縦に読めるようにする
- AIっぽい表現・広告っぽい表現禁止

出力形式：
[Threads1]
（本文）
===
[Threads2]
...`;

  const msg = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content[0].text;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. X投稿
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function postToX(xPostsText) {
  const xClient = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });

  const posts = xPostsText.split("===").map(s => s.replace(/\[投稿\d+\]/, "").trim()).filter(s => s.length > 10);
  console.log(`\n🐦 X投稿開始（${posts.length}本）...`);

  for (let i = 0; i < posts.length; i++) {
    try {
      const tweet = await xClient.v2.tweet(posts[i]);
      console.log(`  ✅ 投稿${i + 1}: https://x.com/i/web/status/${tweet.data.id}`);
    } catch (e) {
      console.warn(`  ⚠️  投稿${i + 1} 失敗: ${e.message}`);
    }
    if (i < posts.length - 1) {
      console.log(`  ⏳ 次の投稿まで90秒待機...`);
      await new Promise(r => setTimeout(r, 90000));
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. Threads投稿（スレッド形式: 1/2テキスト → 2/2 NoteURL）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function postToThreads(threadsText, noteUrl) {
  const token = process.env.THREADS_ACCESS_TOKEN;
  const userId = process.env.THREADS_USER_ID;
  const posts = threadsText.split("===").map(s => {
    return s.replace(/\[Threads\d+\]/, "").trim();
  }).filter(s => s.length > 10);

  async function createAndPublish(text, replyToId) {
    const body = { media_type: "TEXT", text, access_token: token };
    if (replyToId) body.reply_to_id = replyToId;
    const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const createData = await createRes.json();
    if (createData.error) throw new Error(createData.error.message);
    await new Promise(r => setTimeout(r, 2000));
    const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: createData.id, access_token: token }),
    });
    const publishData = await publishRes.json();
    if (publishData.error) throw new Error(publishData.error.message);
    return publishData.id;
  }

  console.log(`\n🧵 Threads投稿開始（${posts.length}本・スレッド形式）...`);
  for (let i = 0; i < posts.length; i++) {
    try {
      // 1/2: 本文テキスト
      const firstId = await createAndPublish(posts[i]);
      console.log(`  ✅ Threads${i + 1} (1/2): https://www.threads.net/t/${firstId}`);
      // 2/2: NoteのURL（OGPカードとして表示）
      if (noteUrl) {
        await new Promise(r => setTimeout(r, 3000));
        const secondId = await createAndPublish(noteUrl, firstId);
        console.log(`  ✅ Threads${i + 1} (2/2): https://www.threads.net/t/${secondId}`);
      }
    } catch (e) {
      console.warn(`  ⚠️  Threads${i + 1} 失敗: ${e.message}`);
    }
    if (i < posts.length - 1) await new Promise(r => setTimeout(r, 5000));
  }
}

async function closeCropModalIfPresent(page) {
  const cropOverlay = page.locator(".CropModal__overlay").first();
  if (!await cropOverlay.isVisible({ timeout: 3000 }).catch(() => false)) return;

  console.warn("  ⚠️  画像トリミングモーダルが残っているため閉じます。");
  const preferredButton = cropOverlay.locator("button").filter({ hasText: /保存|決定|完了|追加/ }).last();
  if (await preferredButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await preferredButton.click({ force: true });
  } else {
    const buttons = cropOverlay.locator("button");
    const count = await buttons.count();
    if (count > 0) {
      await buttons.nth(count - 1).click({ force: true });
    } else {
      await page.keyboard.press("Enter");
    }
  }

  await page.waitForTimeout(3000);
  if (await cropOverlay.isVisible({ timeout: 3000 }).catch(() => false)) {
    await page.screenshot({ path: "note-crop-modal-stuck.png", fullPage: true });
    throw new Error("画像トリミングモーダルを閉じられませんでした。");
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 7. Note有料記事投稿（500円）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function postToNote(body, thumbnailPath) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    await page.goto("https://note.com/login");
    await page.waitForTimeout(4000);
    await page.fill('input[placeholder*="mail"]', process.env.NOTE_EMAIL);
    await page.fill('input[type="password"]', process.env.NOTE_PASSWORD);
    await page.click('button:has-text("ログイン")');
    await page.waitForTimeout(5000);

    await page.goto("https://note.com/notes/new");
    await page.waitForTimeout(4000);

    await page.waitForSelector('textarea[placeholder="記事タイトル"]', { timeout: 15000 });
    await page.fill('textarea[placeholder="記事タイトル"]', TITLE);
    await page.waitForTimeout(500);

    // サムネイル
    const bodyEl = '.ProseMirror, [contenteditable="true"]';
    await page.click(bodyEl);
    await page.locator('[aria-label="画像を追加"]').first().click();
    await page.waitForTimeout(1000);
    const [fc] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 8000 }),
      page.locator("text=画像をアップロード").click(),
    ]);
    await fc.setFiles(thumbnailPath);
    await page.waitForTimeout(5000);
    await closeCropModalIfPresent(page);
    console.log("  ✅ サムネイル挿入完了");

    // 本文入力
    console.log("  📄 本文入力中（長文のため時間がかかります）...");
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    const chunks = body.match(/.{1,500}/gs) || [body];
    for (const chunk of chunks) {
      await page.keyboard.type(chunk);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(1000);

    // 公開設定へ
    await closeCropModalIfPresent(page);
    const publishSettingsBtn = page.locator('button:has-text("公開に進む")').last();
    await publishSettingsBtn.waitFor({ timeout: 10000 });
    await publishSettingsBtn.click();
    await page.waitForSelector('text=記事タイプ', { timeout: 15000 });
    await page.waitForTimeout(1000);

    // ハッシュタグ
    const hashInput = page.locator('input[placeholder*="ハッシュタグ"]');
    if (await hashInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      for (const tag of ["AI副業", "ClaudeCode", "副業術", "副業", "ChatGPT活用"]) {
        await hashInput.fill(tag);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(400);
      }
    }

    // 有料記事設定
    console.log(`  💰 有料記事設定中（${PRICE}円）...`);
    const paidRadio = page.locator('text=有料').first();
    if (!await paidRadio.isVisible({ timeout: 3000 }).catch(() => false)) {
      throw new Error("有料設定の選択肢が見つかりません。有料記事として安全に投稿できないため停止します。");
    }
    await paidRadio.click();
    await page.waitForTimeout(1500);

    // 価格入力
    const priceInput = page.locator('input[type="number"], input[placeholder*="価格"], input[placeholder*="円"]').first();
    if (!await priceInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      throw new Error("価格入力欄が見つかりません。有料記事として安全に投稿できないため停止します。");
    }
    await priceInput.fill(String(PRICE));
    console.log(`  ✅ 価格${PRICE}円設定完了`);
    const paidAreaButton = page.locator('button:has-text("有料エリア設定")').last();
    if (await paidAreaButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await paidAreaButton.click();
      await page.waitForTimeout(4000);
      console.log("  ✅ 有料エリア設定へ反映");
    }
    await page.waitForTimeout(1000);

    // 投稿
    const publishButton = page.locator('button:has-text("投稿する"), button:has-text("更新する")').last();
    await publishButton.waitFor({ timeout: 30000 });
    await publishButton.click();
    await page.waitForTimeout(5000);
    const url = toPublicNoteUrl(page.url());
    console.log(`  ✅ Note公開完了: ${url}`);
    return url;
  } finally {
    await browser.close();
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// メイン実行
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("🚀 プレミアム記事生成・投稿開始\n");

// 並列で記事・投稿文を生成
const [rawBody, xPostsText, threadsText] = await Promise.all([
  generateArticle(),
  generateXPosts(),
  generateThreadsPosts(),
]);

// アフィリリンク挿入
const body = await insertLinks(rawBody);

// 保存
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const filepath = `./articles/ai-fukugyou/${timestamp}_premium_claudecode_automation.md`;
fs.writeFileSync(filepath, `${TITLE}\n生成日時: ${new Date().toLocaleString("ja-JP")}\n\n${body}`, "utf-8");
console.log(`\n💾 記事保存: ${filepath}（${body.length}字）`);

// サムネイル生成
console.log("\n🖼️  サムネイル生成中...");
const thumbTitle = "Claude Code副業\n完全自動化マニュアル";
const thumbnailPath = await generateThumbnail(thumbTitle).catch(async () => {
  // fallback: 既存サムネを使う
  const existing = fs.readdirSync("./thumbnails").filter(f => f.endsWith(".png"))[0];
  return existing ? `./thumbnails/${existing}` : null;
});
console.log(`  ✅ サムネイル: ${thumbnailPath}`);

// Note有料記事投稿（先に投稿してURLを取得）
console.log("\n📓 Note有料記事投稿中...");
const noteUrl = await postToNote(body, thumbnailPath);

// X投稿
await postToX(xPostsText);

// Threads投稿（NoteのURLをスレッドの2/2に使用）
await postToThreads(threadsText, noteUrl);

// 投稿文を保存
fs.writeFileSync("./premium_posts.txt", `=== X投稿 ===\n${xPostsText}\n\n=== Threads投稿 ===\n${threadsText}`, "utf-8");

console.log("\n🎉 全工程完了！");
console.log(`  Note: ${noteUrl}`);
console.log(`  記事: ${filepath}（${body.length}字）`);
console.log(`  投稿文: premium_posts.txt`);
