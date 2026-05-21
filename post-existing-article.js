import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { chromium } from "playwright";
import { TwitterApi } from "twitter-api-v2";
import { generateThumbnail } from "./thumbnail.js";
import { preparePaidArticleBody, toPublicNoteUrl } from "./paid-note.js";

const client = new Anthropic();

const RAKUTEN_APP_ID = process.env.RAKUTEN_APP_ID;
const RAKUTEN_AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;
const RAKUTEN_ACCESS_KEY = process.env.RAKUTEN_ACCESS_KEY;
const MOSHIMO_A_ID = process.env.MOSHIMO_A_ID;

function toMoshimoLink(itemUrl) {
  if (!MOSHIMO_A_ID || !itemUrl) return itemUrl;
  return `https://af.moshimo.com/af/c/click?a_id=${MOSHIMO_A_ID}&p_id=54&pc_id=54&pl_id=616&url=${encodeURIComponent(itemUrl)}`;
}

function getLatestArticle() {
  const dir = "./articles/ai-fukugyou";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort().reverse();
  if (files.length === 0) throw new Error("記事が見つかりません");
  return path.join(dir, files[0]);
}

function parseArticle(filepath) {
  const raw = fs.readFileSync(filepath, "utf-8");
  const lines = raw.split("\n");
  const title = lines[0].trim();
  const bodyStart = lines.findIndex((line, i) =>
    i > 2 &&
    line.trim() &&
    !line.startsWith("生成日時") &&
    !line.startsWith("【目次】") &&
    !/^\d+\./.test(line)
  );
  if (bodyStart < 0) throw new Error("本文の開始位置を特定できません");
  return { title, body: lines.slice(bodyStart).join("\n").trim(), raw };
}

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
    const res = await fetch(`https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404?${params}`);
    const data = await res.json();
    const item = data.Items?.[0]?.Item;
    if (!item) return null;
    return { itemName: item.title, affiliateUrl: toMoshimoLink(item.itemUrl || item.affiliateUrl) };
  } catch (e) {
    console.warn(`  ⚠️  楽天ブックス検索失敗 (${keyword}): ${e.message}`);
    return null;
  }
}

async function searchRakutenItem(keyword) {
  try {
    const params = new URLSearchParams({
      applicationId: RAKUTEN_APP_ID,
      affiliateId: RAKUTEN_AFFILIATE_ID,
      accessKey: RAKUTEN_ACCESS_KEY,
      keyword,
      hits: 1,
      sort: "-reviewCount",
    });
    const res = await fetch(`https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401?${params}`, {
      headers: { Referer: "https://note.com/", Origin: "https://note.com" },
    });
    const data = await res.json();
    const item = data.Items?.[0]?.Item;
    if (!item) return null;
    return { itemName: item.itemName, affiliateUrl: toMoshimoLink(item.itemUrl || item.affiliateUrl) };
  } catch (e) {
    console.warn(`  ⚠️  楽天市場検索失敗 (${keyword}): ${e.message}`);
    return null;
  }
}

async function replaceLinks(body) {
  const pattern = /(<!--\s*(.+?)\s*-->)【LINK】/g;
  const matches = [...body.matchAll(pattern)];
  let result = body;

  for (const match of matches) {
    const full = match[0];
    const keyword = match[2].trim();
    console.log(`  🔍 楽天検索中: "${keyword}"`);
    const item = await searchRakutenBook(keyword) || await searchRakutenItem(keyword);
    if (item) {
      result = result.replace(full, `${item.itemName}\n${item.affiliateUrl}`);
      console.log(`  ✅ リンク挿入: ${item.itemName.slice(0, 30)}...`);
    } else {
      result = result.replace(full, "");
      console.warn(`  ⚠️  商品未発見: ${keyword}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  return result;
}

async function generateXPost(title) {
  const prompt = `あなたは救急救命士として総合病院で3年働きながら、AI副業をやっている人間です。

以下の記事タイトルをもとに、X投稿文を1本作ってください。

記事タイトル: ${title}

条件:
- 280文字以内
- 冒頭1行にフック
- 改行多め
- URLなし
- ハッシュタグは #ClaudeCode #AI副業 #副業術 の3つだけ
- テンプレっぽい誘導は禁止
- 投稿文のみ`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });
  return message.content[0].text.trim();
}

async function postToX(title) {
  const xClient = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
  });
  const post = await generateXPost(title);
  const tweet = await xClient.v2.tweet(post);
  console.log(`  ✅ X投稿完了: https://x.com/i/web/status/${tweet.data.id}`);
}

async function generateThreadsPost(title) {
  const prompt = `あなたは救急救命士として総合病院で3年働きながら、AI副業をやっている人間です。

以下の記事タイトルをもとに、Threads投稿文を1本作ってください。

記事タイトル: ${title}

条件:
- 300字以内
- 悩みや失敗談から入る
- 体験談ベース
- 最後に自然にNoteへ誘導
- ハッシュタグは #ClaudeCode #AI副業 #副業術
- 投稿文のみ`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });
  return message.content[0].text.trim();
}

async function postToThreads(title, noteUrl) {
  const token = process.env.THREADS_ACCESS_TOKEN;
  const userId = process.env.THREADS_USER_ID;
  if (!token || !userId) {
    console.warn("  ⚠️  THREADS_ACCESS_TOKEN または THREADS_USER_ID が未設定。スキップします。");
    return;
  }

  const posts = [await generateThreadsPost(title), noteUrl];
  let replyToId = null;
  for (let i = 0; i < posts.length; i++) {
    const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "TEXT",
        text: posts[i],
        access_token: token,
        ...(replyToId ? { reply_to_id: replyToId } : {}),
      }),
    });
    const createData = await createRes.json();
    if (createData.error) throw new Error(`Threads作成失敗: ${createData.error.message}`);

    await new Promise((r) => setTimeout(r, 2000));
    const publishRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: createData.id, access_token: token }),
    });
    const publishData = await publishRes.json();
    if (publishData.error) throw new Error(`Threads公開失敗: ${publishData.error.message}`);
    replyToId = publishData.id;
    console.log(`  ✅ Threads投稿${i + 1}完了: https://www.threads.net/t/${publishData.id}`);
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

async function postToNote(title, body, thumbnailPath) {
  const { body: noteBody, isPaid, price } = preparePaidArticleBody(body);
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log("  📝 Noteにログイン中...");
    await page.goto("https://note.com/login");
    await page.waitForTimeout(3000);

    for (const sel of ['input[name="email"]', 'input[type="email"]', 'input[placeholder*="メール"]', 'input[placeholder*="mail"]']) {
      if (await page.locator(sel).isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.fill(sel, process.env.NOTE_EMAIL);
        break;
      }
    }
    for (const sel of ['input[name="password"]', 'input[type="password"]']) {
      if (await page.locator(sel).isVisible({ timeout: 3000 }).catch(() => false)) {
        await page.fill(sel, process.env.NOTE_PASSWORD);
        break;
      }
    }
    await page.click('button:has-text("ログイン")');
    await page.waitForTimeout(4000);

    console.log("  ✏️  新規記事ページへ移動...");
    await page.goto("https://note.com/notes/new");
    await page.waitForTimeout(3000);

    await page.waitForSelector('textarea[placeholder="記事タイトル"]', { timeout: 10000 });
    await page.fill('textarea[placeholder="記事タイトル"]', title);

    if (thumbnailPath) {
      console.log("  🖼️  サムネイル画像をアップロード中...");
      const bodySelector = '.ProseMirror, [contenteditable="true"]';
      await page.waitForSelector(bodySelector, { timeout: 10000 });
      await page.click(bodySelector);
      await page.locator('[aria-label="画像を追加"]').first().click();
      await page.waitForTimeout(1000);
      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 8000 }),
        page.locator("text=画像をアップロード").click(),
      ]);
      await fileChooser.setFiles(thumbnailPath);
      await page.waitForTimeout(5000);
      await closeCropModalIfPresent(page);
      console.log("  ✅ サムネイル挿入完了");
    }

    console.log("  📄 本文を入力中...");
    const bodySelector = '.ProseMirror, [contenteditable="true"]';
    await page.waitForSelector(bodySelector, { timeout: 10000 });
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");

    const chunks = noteBody.match(/.{1,500}/gs) || [noteBody];
    for (const chunk of chunks) {
      await page.keyboard.type(chunk);
      await page.waitForTimeout(100);
    }

    console.log("  ⚙️  公開設定へ...");
    await closeCropModalIfPresent(page);
    const publishSettingsBtn = page.locator('button:has-text("公開に進む")').last();
    await publishSettingsBtn.waitFor({ timeout: 10000 });
    await publishSettingsBtn.click();
    await page.waitForSelector('text=記事タイプ', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const hashtagInput = page.locator('input[placeholder*="ハッシュタグ"]');
    if (await hashtagInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      for (const tag of ["AI副業", "ClaudeCode", "副業術", "救急救命士", "ChatGPT活用"]) {
        await hashtagInput.click();
        await hashtagInput.fill(tag);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(500);
      }
      console.log("  ✅ ハッシュタグ設定完了");
    }

    if (isPaid) {
      console.log(`  💰 有料記事設定中（${price}円）...`);
      const paidOption = page.locator("text=有料").first();
      if (!await paidOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        throw new Error("有料設定の選択肢が見つかりません。有料記事として安全に投稿できないため停止します。");
      }
      await paidOption.click();
      await page.waitForTimeout(1500);

      const priceInputs = [
        page.locator('input[type="number"], input[placeholder*="価格"], input[placeholder*="円"]').first(),
        page.locator('xpath=//*[normalize-space()="価格"]/following::input[1]').first(),
        page.locator('xpath=//*[contains(normalize-space(),"価格")]/following::input[1]').first(),
      ];
      let priceInput = null;
      for (const candidate of priceInputs) {
        if (await candidate.isVisible({ timeout: 3000 }).catch(() => false)) {
          priceInput = candidate;
          break;
        }
      }
      if (!priceInput) {
        await page.screenshot({ path: "note-paid-price-missing.png", fullPage: true });
        throw new Error("価格入力欄が見つかりません。有料記事として安全に投稿できないため停止します。");
      }
      await priceInput.fill(String(price));
      console.log(`  ✅ 価格${price}円設定完了`);

      const paidAreaButton = page.locator('button:has-text("有料エリア設定")').last();
      if (await paidAreaButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await paidAreaButton.click();
        await page.waitForTimeout(4000);
        console.log("  ✅ 有料エリア設定へ反映");
      }
    }

    console.log("  🚀 投稿中...");
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

async function main() {
  const filepath = process.argv[2] || getLatestArticle();
  const { title, body } = parseArticle(filepath);
  console.log(`対象記事: ${filepath}`);
  console.log(`タイトル: ${title}`);

  console.log("\n📦 楽天アフィリリンクを挿入中...");
  const linkedBody = await replaceLinks(body);
  const updated = fs.readFileSync(filepath, "utf-8").replace(body, linkedBody);
  fs.writeFileSync(filepath, updated, "utf-8");

  console.log("\n🖼️  サムネイル生成中...");
  const thumbnailPath = await generateThumbnail(title);
  console.log(`  サムネイル: ${thumbnailPath}`);

  console.log("\n📓 Noteに投稿中...");
  const noteUrl = await postToNote(title, linkedBody, thumbnailPath);

  console.log("\n🐦 Xに投稿中...");
  await postToX(title);

  console.log("\n🧵 Threadsに投稿中...");
  await postToThreads(title, noteUrl);
}

main().catch((err) => {
  console.error("エラー:", err.message);
  process.exit(1);
});
