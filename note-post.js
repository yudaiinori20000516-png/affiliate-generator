import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const NOTE_EMAIL = process.env.NOTE_EMAIL;
const NOTE_PASSWORD = process.env.NOTE_PASSWORD;
const ARTICLES_DIR = "./articles/ai-fukugyou";

function getLatestArticle() {
  const files = fs.readdirSync(ARTICLES_DIR)
    .filter(f => f.endsWith(".md"))
    .sort()
    .reverse();
  if (files.length === 0) throw new Error("記事が見つかりません");
  return path.join(ARTICLES_DIR, files[0]);
}

function parseArticle(filepath) {
  const raw = fs.readFileSync(filepath, "utf-8");
  const lines = raw.split("\n");
  const title = lines[0].trim();
  // 目次・生成日時をスキップして本文を取得
  const bodyStart = lines.findIndex((l, i) => i > 2 && l.trim() && !l.startsWith("生成日時") && !l.startsWith("【目次】") && !/^\d+\./.test(l));
  const body = lines.slice(bodyStart).join("\n").trim();
  return { title, body };
}

async function postToNoteDraft(title, body) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // ログイン
    console.log("  📝 Noteにログイン中...");
    await page.goto("https://note.com/login");
    await page.waitForTimeout(3000);

    // スクリーンショットで現在の画面を確認
    await page.screenshot({ path: "note-login-debug.png" });

    // メールアドレス入力（複数セレクターを試す）
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
        await page.fill(sel, NOTE_EMAIL);
        emailFilled = true;
        console.log(`  ✅ メール入力: ${sel}`);
        break;
      } catch {}
    }
    if (!emailFilled) throw new Error("メール入力欄が見つかりません");

    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[placeholder*="パスワード"]',
    ];
    for (const sel of passwordSelectors) {
      try {
        await page.waitForSelector(sel, { timeout: 3000 });
        await page.fill(sel, NOTE_PASSWORD);
        console.log(`  ✅ パスワード入力: ${sel}`);
        break;
      } catch {}
    }

    await page.click('button:has-text("ログイン")');
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "note-after-login-debug.png" });

    // 新規記事作成ページへ
    console.log("  ✏️  新規記事ページへ移動...");
    await page.goto("https://note.com/notes/new");
    await page.waitForTimeout(3000);

    // タイトル入力
    const titleSelector = 'textarea[placeholder="記事タイトル"]';
    await page.waitForSelector(titleSelector, { timeout: 10000 });
    await page.click(titleSelector);
    await page.fill(titleSelector, title);
    await page.waitForTimeout(500);

    // 本文入力
    console.log("  📄 本文を入力中...");
    const bodySelector = '.ProseMirror, [contenteditable="true"]';
    await page.waitForSelector(bodySelector, { timeout: 10000 });
    await page.click(bodySelector);
    await page.waitForTimeout(500);

    // 本文をチャンクで入力（長文対策）
    const chunks = body.match(/.{1,500}/gs) || [body];
    for (const chunk of chunks) {
      await page.keyboard.type(chunk);
      await page.waitForTimeout(100);
    }

    // 下書き保存
    console.log("  💾 下書き保存中...");
    await page.waitForTimeout(1000);

    // 「保存」または「下書き保存」ボタンを探してクリック
    const saveButton = page.locator('button:has-text("下書き保存"), button:has-text("保存")').first();
    await saveButton.click();
    await page.waitForTimeout(3000);

    console.log("  ✅ 下書き保存完了！");
    await page.waitForTimeout(2000);

  } finally {
    await browser.close();
  }
}

async function main() {
  const filepath = process.argv[2] || getLatestArticle();
  console.log(`\n対象ファイル: ${filepath}`);

  const { title, body } = parseArticle(filepath);
  console.log(`タイトル: ${title}`);
  console.log(`本文文字数: ${body.length}字`);

  await postToNoteDraft(title, body);
}

main().catch(err => {
  console.error("エラー:", err.message);
  process.exit(1);
});
