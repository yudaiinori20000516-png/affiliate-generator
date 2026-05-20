import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const THUMBNAIL_DIR = "./thumbnails";

function ensureDir() {
  if (!fs.existsSync(THUMBNAIL_DIR)) fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}

function buildTitleHtml(title) {
  const main = title.split("｜")[0].trim();
  const highlights = [
    "Claude Code", "Claude", "ChatGPT", "AI副業", "AI",
    "収益化", "副業", "自動化", "月3万", "月5万", "月10万", "稼ぐ",
  ];
  let html = main;
  for (const kw of highlights) {
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    html = html.replace(new RegExp(esc, "g"), `<span class="hl">${kw}</span>`);
  }
  return html;
}

export async function generateThumbnail(title) {
  ensureDir();
  const safeName = title.replace(/[\\/:*?"<>|｜]/g, "-").slice(0, 40);
  const outputPath = path.resolve(`${THUMBNAIL_DIR}/${safeName}.png`);

  const mainTitle = title.split("｜")[0].trim();
  const fontSize = mainTitle.length > 22 ? 48 : mainTitle.length > 16 ? 58 : 68;
  const titleHtml = buildTitleHtml(title);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1280px;
    height: 670px;
    background: #b8c9b8;
    font-family: 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic Medium', 'Noto Sans JP', sans-serif;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .circle-tr {
    position: absolute; top: -75px; right: 55px;
    width: 190px; height: 190px;
    background: #9a8c7e; border-radius: 50%;
  }
  .circle-bl {
    position: absolute; bottom: -75px; left: 45px;
    width: 190px; height: 190px;
    background: #9a8c7e; border-radius: 50%;
  }
  .wave {
    position: absolute; top: 0; bottom: 0;
    width: 55px; display: flex; align-items: center;
  }
  .wave-left { left: 18px; }
  .wave-right { right: 18px; }
  .content {
    position: relative; z-index: 10;
    text-align: center;
    padding: 0 150px;
    width: 100%;
  }
  .my-work {
    font-size: 17px; color: #666;
    letter-spacing: 5px; font-style: italic;
    margin-bottom: 6px;
  }
  .edit-icon {
    font-size: 40px; display: block;
    margin-bottom: 18px;
  }
  .badge {
    font-size: 40px; color: #e04848;
    font-weight: 900; letter-spacing: 10px;
    margin-bottom: 20px;
  }
  .title {
    font-size: ${fontSize}px;
    font-weight: 900; color: #1a1a1a;
    line-height: 1.4; margin-bottom: 34px;
    letter-spacing: 1px;
  }
  .hl { color: #e04848; }
  .footer {
    font-size: 19px; color: #444;
    letter-spacing: 11px;
  }
</style>
</head>
<body>
  <div class="circle-tr"></div>
  <div class="circle-bl"></div>
  <div class="wave wave-left">
    <svg width="55" height="640" viewBox="0 0 55 640">
      <path d="M28 0 Q44 32 28 64 Q12 96 28 128 Q44 160 28 192 Q12 224 28 256 Q44 288 28 320 Q12 352 28 384 Q44 416 28 448 Q12 480 28 512 Q44 544 28 576 Q12 608 28 640" stroke="rgba(255,255,255,0.55)" stroke-width="2.5" fill="none"/>
      <path d="M40 0 Q56 32 40 64 Q24 96 40 128 Q56 160 40 192 Q24 224 40 256 Q56 288 40 320 Q24 352 40 384 Q56 416 40 448 Q24 480 40 512 Q56 544 40 576 Q24 608 40 640" stroke="rgba(255,255,255,0.35)" stroke-width="2" fill="none"/>
      <path d="M16 0 Q32 32 16 64 Q0 96 16 128 Q32 160 16 192 Q0 224 16 256 Q32 288 16 320 Q0 352 16 384 Q32 416 16 448 Q0 480 16 512 Q32 544 16 576 Q0 608 16 640" stroke="rgba(255,255,255,0.35)" stroke-width="2" fill="none"/>
    </svg>
  </div>
  <div class="wave wave-right">
    <svg width="55" height="640" viewBox="0 0 55 640">
      <path d="M28 0 Q44 32 28 64 Q12 96 28 128 Q44 160 28 192 Q12 224 28 256 Q44 288 28 320 Q12 352 28 384 Q44 416 28 448 Q12 480 28 512 Q44 544 28 576 Q12 608 28 640" stroke="rgba(255,255,255,0.55)" stroke-width="2.5" fill="none"/>
      <path d="M40 0 Q56 32 40 64 Q24 96 40 128 Q56 160 40 192 Q24 224 40 256 Q56 288 40 320 Q24 352 40 384 Q56 416 40 448 Q24 480 40 512 Q56 544 40 576 Q24 608 40 640" stroke="rgba(255,255,255,0.35)" stroke-width="2" fill="none"/>
      <path d="M16 0 Q32 32 16 64 Q0 96 16 128 Q32 160 16 192 Q0 224 16 256 Q32 288 16 320 Q0 352 16 384 Q32 416 16 448 Q0 480 16 512 Q32 544 16 576 Q0 608 16 640" stroke="rgba(255,255,255,0.35)" stroke-width="2" fill="none"/>
    </svg>
  </div>
  <div class="content">
    <div class="my-work">my work</div>
    <span class="edit-icon">✏️</span>
    <div class="badge">話　題</div>
    <div class="title">${titleHtml}</div>
    <div class="footer">Ａ Ｉ ツ ー ル 研 究 所　｜　２０２６ 年 最 新 版</div>
  </div>
</body>
</html>`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 670 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: outputPath, type: "png" });
  await browser.close();

  return outputPath;
}
