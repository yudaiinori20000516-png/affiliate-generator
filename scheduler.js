import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Anthropic();

const ARTICLES_DIR = path.join(__dirname, "articles");
const TITLES_FILE = path.join(__dirname, "titles.txt");
const INDEX_FILE = path.join(__dirname, ".titles_index");
const LOG_FILE = path.join(__dirname, "scheduler.log");
const X_POSTS_FILE = path.join(__dirname, "x_posts.txt");

function log(message) {
  const timestamp = new Date().toLocaleString("ja-JP");
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n", "utf-8");
}

function loadTitles() {
  if (!fs.existsSync(TITLES_FILE)) {
    log("ERROR: titles.txt が見つかりません");
    process.exit(1);
  }
  return fs
    .readFileSync(TITLES_FILE, "utf-8")
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function loadIndex() {
  if (!fs.existsSync(INDEX_FILE)) return 0;
  const val = parseInt(fs.readFileSync(INDEX_FILE, "utf-8").trim(), 10);
  return isNaN(val) ? 0 : val;
}

function saveIndex(index) {
  fs.writeFileSync(INDEX_FILE, String(index), "utf-8");
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
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

async function generateArticle(title) {
  const prompt = `あなたはNote向けのアフィリエイト記事ライターです。

以下のタイトルで記事を書いてください。

タイトル: ${title}

要件:
- 文字数は約2000字（日本語）
- Note（ノート）プラットフォーム向けの読みやすい文体
- 読者の悩みや興味を引く導入
- 商品・サービスを自然に紹介する本文
- アフィリエイトリンクを挿入すべき箇所に【LINK】というマーカーを入れる（2〜4箇所）
- 【LINK】の前後には、何の商品・サービスのリンクを想定しているかをコメントとして記述する（例: <!-- おすすめ商品A -->【LINK】）
- 読者が行動したくなるまとめ・CTA（行動喚起）で締める
- Markdown形式で出力する（見出しは##、###を使用）

記事本文のみを出力してください（タイトルのh1は含めないでください）。`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].text;
}

function saveArticle(title, content) {
  ensureArticlesDir();
  const timestamp = getTimestamp();
  const safeTitle = sanitizeFilename(title);
  const filename = `${timestamp}_${safeTitle}.md`;
  const filepath = path.join(ARTICLES_DIR, filename);
  const fullContent = `# ${title}\n\n> 生成日時: ${new Date().toLocaleString("ja-JP")}\n\n${content}`;
  fs.writeFileSync(filepath, fullContent, "utf-8");
  return filepath;
}

async function generateXPost(title, content) {
  const prompt = `以下のNote記事のタイトルと本文をもとに、X（旧Twitter）投稿文を1つ作成してください。

タイトル: ${title}
本文（冒頭500字）:
${content.slice(0, 500)}

要件:
- 140字以内（厳守）
- ハッシュタグを末尾に3つ付ける（ハッシュタグも140字に含める）
- 記事の内容が気になるような煽り文句を入れる
- 「Noteで全文読めます👇」のような誘導文を入れる
- 絵文字を1〜2個使ってよい

投稿文のみを出力してください。`;

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  return message.content[0].text.trim();
}

function saveXPost(title, post) {
  const date = new Date().toLocaleDateString("ja-JP");
  const entry = `【${date}】${title}\n${post}\n${"─".repeat(40)}\n`;
  fs.appendFileSync(X_POSTS_FILE, entry, "utf-8");
}

async function main() {
  log("=== スケジューラー起動 ===");

  const titles = loadTitles();
  log(`titles.txt から ${titles.length} 件のタイトルを読み込みました`);

  let index = loadIndex();

  if (index >= titles.length) {
    log("全タイトルの生成が完了しています。titles.txtに新しいタイトルを追加するか、.titles_indexを削除してリセットしてください。");
    process.exit(0);
  }

  const title = titles[index];
  log(`タイトル [${index + 1}/${titles.length}]: 「${title}」`);

  const content = await generateArticle(title);
  const filepath = saveArticle(title, content);

  const charCount = content.length;
  const linkCount = (content.match(/【LINK】/g) || []).length;

  log(`生成完了: ${path.basename(filepath)}`);
  log(`文字数: 約${charCount}字 / 【LINK】: ${linkCount}箇所`);

  log("X投稿文を生成中...");
  const xPost = await generateXPost(title, content);
  saveXPost(title, xPost);
  log(`X投稿文を保存: x_posts.txt（${xPost.length}字）`);
  log(`---\n${xPost}\n---`);

  saveIndex(index + 1);
  log(`次回は [${index + 2}/${titles.length}]: 「${titles[index + 1] ?? "（なし）"}」`);
  log("=== 完了 ===");
}

main().catch((err) => {
  log(`ERROR: ${err.message}`);
  process.exit(1);
});
