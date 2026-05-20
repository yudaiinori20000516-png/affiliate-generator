import { TwitterApi } from "twitter-api-v2";
import Anthropic from "@anthropic-ai/sdk";

const xClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

const claude = new Anthropic();

// AI・副業・ChatGPT系で影響力のある日本語アカウント
// フォロワーが多いほど、そのツイートへの返信がより多くの人に見られる
// ↓ 自由に追加・変更してください
const TARGET_ACCOUNTS = [
  "shi3z",         // 清水亮 - AI研究者 2.4万フォロワー
  "yamada_nt",     // ウェブ・AI系 1.5万フォロワー
  "aimin_bkh",     // AI副業系 1.3万フォロワー（検索で発見）
  "dansyu_callenge", // Claude×副業 5000フォロワー
  "hoikusiA",      // 保育×AI×副業 1600フォロワー
  "shinamon058",   // AI副業 1600フォロワー
];

// いいね数のしきい値（これ以上のツイートに返信する）
const MIN_LIKES = 5;

// 返信済みのツイートIDを記録するファイル
import fs from "fs";
const REPLIED_FILE = "./replied_ids.json";

function loadReplied() {
  if (!fs.existsSync(REPLIED_FILE)) return new Set();
  return new Set(JSON.parse(fs.readFileSync(REPLIED_FILE, "utf-8")));
}

function saveReplied(ids) {
  fs.writeFileSync(REPLIED_FILE, JSON.stringify([...ids]), "utf-8");
}

async function generateReply(tweetText, authorUsername) {
  const prompt = `あなたはAI副業・ChatGPT活用・副業術の専門家として発信しているXユーザーです。
アカウント名は「AIツール研究所」で、Claude CodeやAIを使った副業の自動化に取り組んでいます。

以下のツイートに対して、返信コメントを1つ作ってください。

【元ツイート（@${authorUsername}）】
${tweetText}

要件：
- 元の話題から脱線しない（的を射た返信）
- 自分の体験・視点を1〜2行で添える（押しつけがましくない）
- 共感・賛同・補足・質問のどれかのアプローチで
- 宣伝・自己紹介・URLは絶対に入れない
- 3〜5行の短い文章（改行を活用してスキャンしやすく）
- 自然な日本語で、AIっぽくない
- ハッシュタグは付けない

返信文のみを出力してください（説明不要）。`;

  const msg = await claude.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  return msg.content[0].text.trim();
}

async function processAccount(username, repliedIds) {
  let userId;
  try {
    const user = await xClient.v2.userByUsername(username, {
      "user.fields": ["public_metrics"],
    });
    if (!user.data) return [];
    userId = user.data.id;
    const followers = user.data.public_metrics?.followers_count ?? 0;
    console.log(`\n📱 @${username} (フォロワー: ${followers.toLocaleString()})`);
  } catch (e) {
    console.log(`  ⚠️  @${username} 取得失敗: ${e.message}`);
    return [];
  }

  let tweets;
  try {
    const tl = await xClient.v2.userTimeline(userId, {
      max_results: 20,
      "tweet.fields": ["public_metrics", "created_at"],
      exclude: ["retweets", "replies"],
    });
    tweets = tl.data?.data ?? [];
  } catch (e) {
    console.log(`  ⚠️  タイムライン取得失敗: ${e.message}`);
    return [];
  }

  const targets = tweets.filter(
    (t) =>
      (t.public_metrics?.like_count ?? 0) >= MIN_LIKES &&
      !repliedIds.has(t.id)
  );

  if (targets.length === 0) {
    console.log(`  → 返信対象なし（いいね${MIN_LIKES}以上の未返信ツイートなし）`);
    return [];
  }

  // エンゲージメント順にソートして上位1件に返信
  targets.sort(
    (a, b) =>
      (b.public_metrics?.like_count ?? 0) - (a.public_metrics?.like_count ?? 0)
  );
  const top = targets[0];

  console.log(
    `  🎯 対象: いいね${top.public_metrics?.like_count} | ${top.text.slice(0, 60)}...`
  );

  const reply = await generateReply(top.text, username);
  console.log(`  💬 返信案:\n${reply}`);

  return [{ tweetId: top.id, username, reply }];
}

async function main() {
  const repliedIds = loadReplied();
  const toPost = [];

  for (const username of TARGET_ACCOUNTS) {
    const results = await processAccount(username, repliedIds);
    toPost.push(...results);
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (toPost.length === 0) {
    console.log("\n返信対象の投稿が見つかりませんでした。");
    return;
  }

  console.log(`\n\n投稿する返信: ${toPost.length}件`);

  for (const { tweetId, username, reply } of toPost) {
    try {
      const posted = await xClient.v2.tweet(reply, {
        reply: { in_reply_to_tweet_id: tweetId },
      });
      repliedIds.add(tweetId);
      console.log(
        `✅ @${username}への返信完了: https://x.com/i/web/status/${posted.data.id}`
      );
    } catch (e) {
      console.error(
        `❌ 返信失敗: ${e.message}`,
        JSON.stringify(e.data ?? "", null, 2)
      );
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  saveReplied(repliedIds);
  console.log("\n✅ 完了！返信済みIDを保存しました。");
}

main().catch((err) => {
  console.error("エラー:", err.message);
  process.exit(1);
});
