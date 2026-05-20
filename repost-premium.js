/**
 * プレミアム記事の集客投稿を新フォーマットで再投稿
 * 対象記事: https://note.com/ailab2026/n/n8aa269faec36
 */
import Anthropic from "@anthropic-ai/sdk";
import { TwitterApi } from "twitter-api-v2";

const client = new Anthropic();

const TITLE = "【完全保存版】Claude Codeで副業を全自動化した全手順｜ゼロから月5万円の仕組みを作るまでにやったこと全部";
const NOTE_URL = "https://note.com/ailab2026/n/n8aa269faec36";

// X集客投稿（5本）新フォーマット
async function generateXPosts() {
  console.log("🐦 X集客投稿文を生成中（新フォーマット・1投稿完結）...");
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

// Threads集客投稿（3本）新フォーマット
async function generateThreadsPosts() {
  console.log("🧵 Threads集客投稿文を生成中（新フォーマット）...");
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

// X投稿
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

// Threads投稿（スレッド形式: 1/2テキスト → 2/2 NoteURL）
async function postToThreads(threadsText) {
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

  const limited = posts.slice(0, 1);
  console.log(`\n🧵 Threads投稿開始（${limited.length}本・スレッド形式）...`);
  for (let i = 0; i < limited.length; i++) {
    try {
      // 1/2: 本文テキスト
      const firstId = await createAndPublish(limited[i]);
      console.log(`  ✅ Threads${i + 1} (1/2): https://www.threads.net/t/${firstId}`);
      // 2/2: NoteのURL（OGPカード表示）
      await new Promise(r => setTimeout(r, 3000));
      const secondId = await createAndPublish(NOTE_URL, firstId);
      console.log(`  ✅ Threads${i + 1} (2/2): https://www.threads.net/t/${secondId}`);
    } catch (e) {
      console.warn(`  ⚠️  Threads${i + 1} 失敗: ${e.message}`);
    }
    if (i < posts.length - 1) await new Promise(r => setTimeout(r, 5000));
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// メイン実行
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("🚀 プレミアム記事 集客再投稿（新フォーマット）\n");
console.log(`  対象Note: ${NOTE_URL}\n`);

const [xPostsText, threadsText] = await Promise.all([
  generateXPosts(),
  generateThreadsPosts(),
]);

// テキスト保存
import { writeFileSync } from "fs";
writeFileSync("./repost_premium.txt",
  `=== X投稿 ===\n${xPostsText}\n\n=== Threads投稿 ===\n${threadsText}`,
  "utf-8"
);
console.log("\n💾 投稿文を repost_premium.txt に保存しました");
console.log("\n--- 生成内容プレビュー ---");
console.log("\n[X投稿]");
console.log(xPostsText.slice(0, 500) + "...\n");
console.log("[Threads投稿]");
console.log(threadsText.slice(0, 300) + "...\n");

// 投稿実行
await postToX(xPostsText);
await postToThreads(threadsText);

console.log("\n🎉 集客再投稿完了！");
console.log(`  対象記事: ${NOTE_URL}`);
