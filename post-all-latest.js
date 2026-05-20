import fs from "fs";
import { TwitterApi } from "twitter-api-v2";

const TOKEN = process.env.THREADS_ACCESS_TOKEN;
const USER_ID = process.env.THREADS_USER_ID;

const xClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

const raw = fs.readFileSync("./x_posts.txt", "utf-8");

// 最後の生成バッチを取得（最後の「生成日時:」以降）
const batches = raw.split(/={10,}\n生成日時:/);
const lastBatch = "生成日時:" + batches[batches.length - 1];

// 投稿ブロックを分割（===で区切る）
const blocks = lastBatch.split(/={10,}/).map(b => b.trim()).filter(b => b.includes("■ X用投稿"));

console.log(`📋 ${blocks.length}本の投稿をX・Threads両方に投稿します...\n`);

for (let i = 0; i < blocks.length; i++) {
  const block = blocks[i];

  // タイトル取得
  const titleMatch = block.match(/【投稿\d+】(.+)/);
  const title = titleMatch?.[1] || `投稿${i + 1}`;

  // X用メインポスト・リプライ抽出
  const xMain = block.match(/\[メインポスト\]\n([\s\S]+?)\n\n\[リプライ\]/)?.[1]?.trim() || "";
  const xReply = block.match(/\[リプライ\]\n([\s\S]+?)(?:\n\n■ Threads用|$)/)?.[1]?.trim() || "";
  const tweets = [xMain, xReply].filter(t => t.length > 0);

  // Threads用抽出
  const threadsText = block.match(/■ Threads用\n+([\s\S]+?)(?:={10,}|$)/)?.[1]?.trim() || "";

  console.log(`\n【投稿${i + 1}/5】${title}`);

  // --- X投稿 ---
  console.log("  🐦 Xに投稿中...");
  try {
    let replyToId = null;
    for (let j = 0; j < tweets.length; j++) {
      const params = replyToId ? { reply: { in_reply_to_tweet_id: replyToId } } : {};
      const tweet = await xClient.v2.tweet(tweets[j], params);
      replyToId = tweet.data.id;
      const label = j === 0 ? "メインポスト" : "リプライ";
      console.log(`    ✅ ${label}: https://x.com/i/web/status/${tweet.data.id}`);
      await new Promise(r => setTimeout(r, 1000));
    }
  } catch (e) {
    console.warn(`    ❌ X投稿失敗: ${e.message}`);
  }

  // --- Threads投稿 ---
  console.log("  🧵 Threadsに投稿中...");
  try {
    const createRes = await fetch(`https://graph.threads.net/v1.0/${USER_ID}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_type: "TEXT", text: threadsText, access_token: TOKEN }),
    });
    const createData = await createRes.json();

    if (createData.error) throw new Error(createData.error.message);

    await new Promise(r => setTimeout(r, 2000));

    const publishRes = await fetch(`https://graph.threads.net/v1.0/${USER_ID}/threads_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: createData.id, access_token: TOKEN }),
    });
    const publishData = await publishRes.json();

    if (publishData.error) throw new Error(publishData.error.message);
    console.log(`    ✅ Threads: https://www.threads.net/t/${publishData.id}`);
  } catch (e) {
    console.warn(`    ❌ Threads投稿失敗: ${e.message}`);
  }

  // 次の投稿まで30秒待機（連投規制対策）
  if (i < blocks.length - 1) {
    console.log("  ⏳ 30秒待機中...");
    await new Promise(r => setTimeout(r, 30000));
  }
}

console.log("\n✅ 全投稿完了！");
