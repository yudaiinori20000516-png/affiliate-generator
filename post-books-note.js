import fs from "fs";
import { chromium } from "playwright";

const TITLE = "AI副業に関する本10冊を読んだ私が伝えたい10のこと";

async function main() {
  const body = fs.readFileSync("./note_books_article.md", "utf-8");
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log("📝 Noteにログイン中...");
    await page.goto("https://note.com/login");
    await page.waitForTimeout(3000);

    // メール入力（プレースホルダーで特定）
    const emailInput = page.locator('input[placeholder*="mail"], input[placeholder*="note ID"], input[type="email"]').first();
    await emailInput.waitFor({ timeout: 5000 });
    await emailInput.click();
    await emailInput.fill(process.env.NOTE_EMAIL);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);

    // パスワード入力
    const pwInput = page.locator('input[type="password"]').first();
    await pwInput.waitFor({ timeout: 3000 });
    await pwInput.click();
    await pwInput.fill(process.env.NOTE_PASSWORD);
    await page.waitForTimeout(800);

    // ログインボタンが有効になるまで待つ（最大5秒）
    const loginBtn = page.locator('button:has-text("ログイン")').last();
    for (let i = 0; i < 10; i++) {
      const disabled = await loginBtn.getAttribute("disabled");
      if (!disabled) break;
      await page.waitForTimeout(500);
    }
    await loginBtn.click({ force: true });
    // ログイン完了を待つ（ログインページから離れるまで）
    await page.waitForURL((url) => !url.includes("/login"), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    console.log("✏️  新規記事ページへ移動...");
    await page.goto("https://note.com/notes/new");
    await page.waitForTimeout(5000);

    // タイトル入力欄を複数セレクタで試す
    const titleSelectors = [
      'textarea[placeholder="記事タイトル"]',
      'textarea[placeholder*="タイトル"]',
      '.o-noteEditArticle__title textarea',
      'div[data-placeholder="記事タイトル"]',
    ];
    let titleSelector = null;
    for (const sel of titleSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 5000 });
        titleSelector = sel;
        break;
      } catch {}
    }
    if (!titleSelector) {
      // スクリーンショットを撮って現在の状態を確認
      await page.screenshot({ path: "./debug_note.png" });
      throw new Error("タイトル入力欄が見つかりません（debug_note.png を確認）");
    }
    await page.click(titleSelector);
    await page.fill(titleSelector, TITLE);
    await page.waitForTimeout(500);

    console.log("📄 本文を入力中...");
    const bodySelector = '.ProseMirror, [contenteditable="true"]';
    await page.waitForSelector(bodySelector, { timeout: 10000 });
    await page.click(bodySelector);
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    const chunks = body.match(/.{1,500}/gs) || [body];
    for (const chunk of chunks) {
      await page.keyboard.type(chunk);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(1000);

    console.log("⚙️  公開設定へ...");
    await page.click('button:has-text("公開に進む")');
    await page.waitForTimeout(3000);

    // ハッシュタグ設定
    const hashtags = ["AI副業", "ClaudeCode", "副業術", "救急救命士", "ChatGPT活用"];
    const hashtagInput = page.locator('input[placeholder*="ハッシュタグ"]');
    if (await hashtagInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      for (const tag of hashtags) {
        await hashtagInput.click();
        await hashtagInput.fill(tag);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(500);
      }
    }

    console.log("🚀 投稿中...");
    const publishBtn = page.locator('button:has-text("投稿する")').last();
    await publishBtn.click();
    await page.waitForTimeout(5000);

    const url = page.url();
    console.log(`✅ Note公開完了！ ${url}`);
    await page.waitForTimeout(2000);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
