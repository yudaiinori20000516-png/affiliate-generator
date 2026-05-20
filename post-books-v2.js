import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const TITLE = "AI副業本10冊読んだ私が伝えたい10のこと";

const IMAGES = {
  thumbnail: "./thumbnails/books_thumbnail.svg.png",
  IMAGE_1: "./images/books/01_action_speed.svg.png",
  IMAGE_2: "./images/books/02_experience_ai.svg.png",
  IMAGE_3: "./images/books/03_niche.svg.png",
  IMAGE_4: "./images/books/04_system.svg.png",
  IMAGE_5: "./images/books/05_empathy.svg.png",
  IMAGE_6: "./images/books/06_mvp.svg.png",
  IMAGE_7: "./images/books/07_prompt.svg.png",
  IMAGE_8: "./images/books/08_asset.svg.png",
  IMAGE_9: "./images/books/09_target.svg.png",
  IMAGE_10: "./images/books/10_time.svg.png",
};

const HASHTAGS = ["AI副業", "ClaudeCode", "副業術", "ChatGPT活用", "本レビュー"];

function splitArticle(text) {
  const parts = [];
  const regex = /【IMAGE_(\d+)】/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.slice(lastIndex, match.index).trim() });
    }
    parts.push({ type: "image", key: `IMAGE_${match[1]}` });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.slice(lastIndex).trim() });
  }
  return parts;
}

async function uploadImage(page, imgPath) {
  const absPath = path.resolve(imgPath);
  const imgName = path.basename(imgPath);

  // ① スクロールしてカーソルをビューに入れる
  await page.evaluate(() => {
    const editorEl = document.querySelector('.ProseMirror');
    if (!editorEl) return;
    let view = null;
    try {
      const desc = editorEl.pmViewDesc;
      if (desc?.parent?.view) view = desc.parent.view;
    } catch {}
    if (view) {
      const el = view.domAtPos(view.state.selection.from)?.node;
      if (el?.scrollIntoView) el.scrollIntoView({ block: "center" });
    } else {
      window.getSelection()?.getRangeAt(0)?.startContainer?.parentElement?.scrollIntoView({ block: "center" });
    }
  });
  await page.waitForTimeout(1000); // スクロール完了待ち

  // ② スクロール後の座標を取得（ビューポート座標）
  const coords = await page.evaluate(() => {
    const editorEl = document.querySelector('.ProseMirror');
    if (!editorEl) return null;
    let view = null;
    try {
      const desc = editorEl.pmViewDesc;
      if (desc?.parent?.view) view = desc.parent.view;
    } catch {}
    if (view) {
      const pos = view.state.selection.from;
      const c = view.coordsAtPos(pos);
      return { top: c.top, left: c.left, bottom: c.bottom };
    }
    const sel = window.getSelection();
    if (!sel?.rangeCount) return null;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    return { top: r.top, left: r.left, bottom: r.bottom };
  });

  if (!coords) {
    console.warn(`  ⚠️  座標取得失敗: ${imgName}`);
    return;
  }

  // 座標が無効な場合はエディタ要素のBoundingRectから算出
  let lineY = coords.bottom > coords.top + 2
    ? (coords.top + coords.bottom) / 2
    : coords.top + 10;
  let plusX = coords.left > 30 ? coords.left - 40 : coords.left + 10;

  // 座標がビューポート外（top<20 or left<20）ならエディタのRect取得
  if (coords.top < 20 || coords.left < 20) {
    const editorRect = await page.evaluate(() => {
      const el = document.querySelector('.ProseMirror');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, bottom: r.bottom, right: r.right };
    });
    if (editorRect) {
      lineY = (editorRect.top + editorRect.bottom) / 2;
      plusX = Math.max(10, editorRect.left - 30);
    }
  }

  console.log(`  ℹ️  hover at (${plusX.toFixed(0)}, ${lineY.toFixed(0)}): ${imgName}`);

  // ③ ホバーして+ボタンを出現させる
  await page.mouse.move(plusX, lineY);
  await page.waitForTimeout(2000);

  // ④ カーソル位置をクリックしてエディタにフォーカスを戻す
  await page.mouse.click(coords.left + 100, lineY);
  await page.waitForTimeout(400);

  // ⑤ まずスラッシュコマンドを試みる（Note が対応している場合）
  await page.keyboard.type('/');
  await page.waitForTimeout(800);
  const slashMenu = page.locator('[role="menu"], [role="listbox"], [role="option"]:has-text("画像")').first();
  const hasSlash = await slashMenu.isVisible({ timeout: 1500 }).catch(() => false);

  if (hasSlash) {
    // スラッシュメニューから画像を選択
    await page.keyboard.type('画像');
    await page.waitForTimeout(500);
    const imgOpt = page.locator('[role="option"]:has-text("画像"), li:has-text("画像")').first();
    if (await imgOpt.isVisible({ timeout: 2000 }).catch(() => false)) {
      await imgOpt.click();
    } else {
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(600);
  } else {
    // スラッシュを削除してホバー方式にフォールバック
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);

    // 左マージンをホバー（エディタ内部から外に向かう動き）
    await page.mouse.move(coords.left + 100, lineY);
    await page.waitForTimeout(200);
    await page.mouse.move(plusX, lineY);
    await page.waitForTimeout(2500);

    // ±120px Y範囲でボタン探索
    const btn = await page.evaluate(({ px, py }) => {
      const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
      const near = btns.filter(el => {
        const r = el.getBoundingClientRect();
        if (r.width < 5 || r.height < 5) return false;
        const cx = (r.left + r.right) / 2;
        const cy = (r.top + r.bottom) / 2;
        return Math.abs(cx - px) < 120 && Math.abs(cy - py) < 120;
      });
      if (!near.length) return null;
      near.sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        const ax = (ar.left + ar.right) / 2, ay = (ar.top + ar.bottom) / 2;
        const bx = (br.left + br.right) / 2, by = (br.top + br.bottom) / 2;
        return (Math.abs(ax - px) + Math.abs(ay - py)) - (Math.abs(bx - px) + Math.abs(by - py));
      });
      const t = near[0];
      const r = t.getBoundingClientRect();
      return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2, left: r.left, text: t.textContent?.trim().slice(0, 15) || "" };
    }, { px: plusX, py: lineY });

    if (!btn) {
      console.warn(`  ⚠️  +ボタン見つからず: ${imgName}`);
      return;
    }
    console.log(`  ℹ️  クリック x=${btn.left.toFixed(0)} "${btn.text}": ${imgName}`);
    await page.mouse.click(btn.x, btn.y);
    await page.waitForTimeout(1000);

    const imgItem = page.locator('li:has-text("画像"), [role="menuitem"]:has-text("画像"), button:has-text("画像")').first();
    if (!await imgItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.warn(`  ⚠️  画像メニューなし（Esc）: ${imgName}`);
      await page.keyboard.press("Escape");
      return;
    }
    await imgItem.click();
    await page.waitForTimeout(800);
  }

  // ⑥ ファイルアップロード
  const uploadText = page.locator("text=画像をアップロード").first();
  if (await uploadText.isVisible({ timeout: 5000 }).catch(() => false)) {
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 8000 }),
      uploadText.click(),
    ]);
    await fileChooser.setFiles(absPath);
  } else {
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.setInputFiles(absPath);
    } else {
      console.warn(`  ⚠️  ファイル入力なし: ${imgName}`);
      return;
    }
  }
  await page.waitForTimeout(8000); // アップロード完了待ち

  // ⑦ トリミング保存
  const cropBtn = page.locator('button').filter({ hasText: /^保存$/ });
  if (await cropBtn.isVisible({ timeout: 12000 }).catch(() => false)) {
    await cropBtn.click();
    await page.waitForTimeout(4000);
  }

  const imgCount = await page.evaluate(() =>
    document.querySelectorAll('.ProseMirror img, .ProseMirror figure').length
  );
  console.log(`  🖼️  挿入完了: ${imgName} (editor内計${imgCount}枚)`);
}

async function typeText(page, text) {
  if (!text) return;
  const chunks = text.match(/.{1,300}/gs) || [text];
  for (const chunk of chunks) {
    await page.keyboard.type(chunk);
    await page.waitForTimeout(80);
  }
}

async function dismissModal(page) {
  // 邪魔なモーダルを閉じる
  const overlayBtn = page.locator('.ReactModal__Content button').first();
  if (await overlayBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await overlayBtn.click();
    await page.waitForTimeout(1000);
  }
}

async function main() {
  const raw = fs.readFileSync("./note_books_article.md", "utf-8");
  const body = raw.split("\n").slice(1).join("\n").trim();
  const parts = splitArticle(body);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  try {
    // ─── ログイン ───
    console.log("📝 Noteにログイン中...");
    await page.goto("https://note.com/login");
    await page.waitForTimeout(3000);

    const emailInput = page.locator('input[placeholder*="mail"], input[placeholder*="note ID"]').first();
    await emailInput.waitFor({ timeout: 5000 });
    await emailInput.click();
    await emailInput.fill(process.env.NOTE_EMAIL);
    await page.keyboard.press("Tab");
    await page.waitForTimeout(400);

    const pwInput = page.locator('input[type="password"]').first();
    await pwInput.click();
    await pwInput.fill(process.env.NOTE_PASSWORD);
    await page.waitForTimeout(800);

    const loginBtn = page.locator('button:has-text("ログイン")').last();
    for (let i = 0; i < 10; i++) {
      if (!(await loginBtn.getAttribute("disabled"))) break;
      await page.waitForTimeout(500);
    }
    await loginBtn.click({ force: true });
    await page.waitForURL((u) => !u.includes("/login"), { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // ─── 新規記事 ───
    console.log("✏️  新規記事ページへ...");
    await page.goto("https://note.com/notes/new");
    await page.waitForTimeout(5000);

    const titleSels = [
      'textarea[placeholder="記事タイトル"]',
      'textarea[placeholder*="タイトル"]',
    ];
    let titleSel = null;
    for (let attempt = 0; attempt < 3 && !titleSel; attempt++) {
      for (const s of titleSels) {
        if (await page.locator(s).isVisible({ timeout: 5000 }).catch(() => false)) {
          titleSel = s;
          break;
        }
      }
      if (!titleSel) {
        await page.reload();
        await page.waitForTimeout(4000);
      }
    }
    if (!titleSel) throw new Error("タイトル欄が見つかりません");
    await page.click(titleSel);
    await page.fill(titleSel, TITLE);
    await page.waitForTimeout(500);

    // ─── サムネイル ───
    console.log("🖼️  サムネイル画像をアップロード中...");
    const editor = page.locator('.ProseMirror, [contenteditable="true"]').first();
    await editor.click();
    await page.waitForTimeout(500);
    await uploadImage(page, IMAGES.thumbnail);
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);

    // ─── 本文 ───
    console.log("📄 本文を入力中...");
    for (const part of parts) {
      if (part.type === "text") {
        await typeText(page, part.content);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(200);
      } else if (part.type === "image") {
        await page.keyboard.press("Enter");
        await page.waitForTimeout(500);
        await uploadImage(page, IMAGES[part.key]);
        await page.keyboard.press("End");
        await page.keyboard.press("Enter");
        await page.waitForTimeout(300);
      }
    }
    await page.waitForTimeout(2000);

    // ─── 下書き保存 ───
    console.log("💾 下書きに保存中...");

    // モーダルを先に閉じる
    await dismissModal(page);

    // 「公開に進む」でモーダルを開く
    const publishBtn = page.locator('button:has-text("公開に進む")');
    if (await publishBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await publishBtn.click();
      await page.waitForTimeout(3000);
    }

    // 邪魔なメッセージモーダルを閉じる
    await dismissModal(page);
    await page.waitForTimeout(1000);

    // ハッシュタグ
    const hashInput = page.locator('input[placeholder*="ハッシュタグ"]');
    if (await hashInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      for (const tag of HASHTAGS) {
        await hashInput.click();
        await hashInput.fill(tag);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(400);
      }
    }

    // 下書き保存ボタン
    const draftSelectors = [
      'button:has-text("下書き保存")',
      'button:has-text("下書きに保存")',
      'button:has-text("下書き")',
    ];
    let saved = false;
    for (const sel of draftSelectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await btn.click({ force: true });
        await page.waitForTimeout(5000);
        saved = true;
        break;
      }
    }

    if (!saved) {
      // Escで閉じて自動保存
      await page.keyboard.press("Escape");
      await page.waitForTimeout(3000);
      console.log("  ℹ️  下書き自動保存（ボタン未検出）");
    }

    const url = page.url();
    console.log(`\n✅ 下書き保存完了！ ${url}`);
    await page.waitForTimeout(3000);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
