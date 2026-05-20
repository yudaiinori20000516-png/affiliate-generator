import { chromium } from "playwright";

const NOTE_ARTICLE_ID = "n36031e7749c0";
const THUMBNAIL_PATH = "./thumbnails/books_thumbnail.svg.png";

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log("📝 Noteにログイン中...");
    await page.goto("https://note.com/login");
    await page.waitForTimeout(3000);

    const emailInput = page.locator('input[placeholder*="mail"], input[placeholder*="note ID"]').first();
    await emailInput.waitFor({ timeout: 5000 });
    await emailInput.click();
    await emailInput.fill(process.env.NOTE_EMAIL);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);

    const pwInput = page.locator('input[type="password"]').first();
    await pwInput.waitFor({ timeout: 3000 });
    await pwInput.click();
    await pwInput.fill(process.env.NOTE_PASSWORD);
    await page.waitForTimeout(800);

    const loginBtn = page.locator('button:has-text("ログイン")').last();
    for (let i = 0; i < 10; i++) {
      const disabled = await loginBtn.getAttribute("disabled");
      if (!disabled) break;
      await page.waitForTimeout(500);
    }
    await loginBtn.click({ force: true });
    await page.waitForURL((url) => !url.includes("/login"), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    console.log("✏️  記事編集ページへ移動...");
    await page.goto(`https://editor.note.com/notes/${NOTE_ARTICLE_ID}/edit/`);
    await page.waitForTimeout(4000);

    // サムネイル設定ボタンを探す
    console.log("🖼️  サムネイルを設定中...");

    // エディタでサムネイル画像を追加ボタンを探す（公開設定に進む前）
    console.log("🖼️  エディタでサムネイル設定中...");
    await page.screenshot({ path: "./debug_editor.png" });

    // 画像追加ボタン（ツールバー内）
    const imgBtnSelectors = [
      '[aria-label="画像を追加"]',
      'button[data-type="image"]',
      '.o-editorToolbar button[title*="画像"]',
    ];
    let imgBtnClicked = false;
    for (const sel of imgBtnSelectors) {
      if (await page.locator(sel).first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.locator(sel).first().click();
        imgBtnClicked = true;
        console.log(`  ✅ 画像ボタン発見: ${sel}`);
        break;
      }
    }

    if (imgBtnClicked) {
      await page.waitForTimeout(1000);
      // ファイルアップロードダイアログ
      const uploadText = page.locator("text=画像をアップロード").first();
      if (await uploadText.isVisible({ timeout: 3000 }).catch(() => false)) {
        const [fileChooser] = await Promise.all([
          page.waitForEvent("filechooser", { timeout: 8000 }),
          uploadText.click(),
        ]);
        await fileChooser.setFiles(THUMBNAIL_PATH);
        await page.waitForTimeout(3000);
      } else {
        // file input を直接使う
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await fileInput.setInputFiles(THUMBNAIL_PATH);
          await page.waitForTimeout(3000);
        }
      }

      // トリミング保存ボタン
      const cropBtn = page.locator('button').filter({ hasText: /^保存$/ });
      if (await cropBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
        await cropBtn.click();
        await page.waitForTimeout(2000);
      }
      console.log("  ✅ 画像をエディタに追加");

      // 先頭の画像をサムネイルに設定
      const thumbnailSetBtn = page.locator('button:has-text("サムネイルに設定"), [aria-label*="サムネイル"]').first();
      if (await thumbnailSetBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await thumbnailSetBtn.click();
        await page.waitForTimeout(1000);
        console.log("  ✅ サムネイル設定完了");
      }
    } else {
      await page.screenshot({ path: "./debug_thumbnail.png" });
      console.log("  ⚠️ 画像ボタンが見つかりません（debug_thumbnail.png確認）");
    }

    // 公開に進む → 更新する
    const publishBtn = page.locator('button:has-text("公開に進む")');
    if (await publishBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await publishBtn.click();
      await page.waitForTimeout(2000);
    }

    const updateBtn = page.locator('button:has-text("更新する"), button:has-text("投稿する")').last();
    if (await updateBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await updateBtn.click();
      await page.waitForTimeout(4000);
      console.log(`✅ 記事更新完了: https://note.com/ailab2026/n/${NOTE_ARTICLE_ID}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
