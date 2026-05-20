import { TwitterApi } from "twitter-api-v2";
import Anthropic from "@anthropic-ai/sdk";

const xClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

const claude = new Anthropic();

function extractTweetId(input) {
  // URL形式: https://x.com/xxx/status/1234567890
  const match = input.match(/status\/(\d+)/);
  if (match) return match[1];
  // IDのみの場合
  if (/^\d+$/.test(input.trim())) return input.trim();
  return null;
}

async function fetchTweet(tweetId) {
  const res = await xClient.v2.singleTweet(tweetId, {
    "tweet.fields": ["public_metrics", "author_id", "created_at"],
    expansions: ["author_id"],
    "user.fields": ["username", "public_metrics"],
  });
  const tweet = res.data;
  const author = res.includes?.users?.[0];
  return { tweet, author };
}

async function generateReply(tweetText, authorUsername, authorFollowers) {
  const prompt = `あなたはAI副業・ChatGPT活用・Claude Code活用の専門家として発信しているXユーザー「AIツール研究所」です。

以下のツイートに返信します。相手のフォロワーに自分の存在を印象づけるための、的を射た返信を1つ作ってください。

【元ツイート】
@${authorUsername}（フォロワー: ${authorFollowers?.toLocaleString() ?? "不明"}）
${tweetText}

返信の要件：
- 元ツイートの本題から絶対に脱線しない
- 自分の実体験・視点を1行だけ添える（AI副業・Claude・自動化の文脈で自然に）
- 共感・補足・鋭い切り口・質問のいずれかで構成
- 宣伝・自己紹介・URLは一切入れない
- 3〜5行、改行を活用してスキャンしやすく
- 自然な日本語（AIっぽい言い回し禁止）
- ハッシュタグなし
- 読んだ人が「この人、分かってるな」と思う内容

返信文のみ出力してください。`;

  const msg = await claude.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  return msg.content[0].text.trim();
}

async function main() {
  const inputs = process.argv.slice(2);

  if (inputs.length === 0) {
    console.log("使い方: node gen-reply.js <ツイートURL or ID> [URL2] [URL3]...");
    console.log("例: node gen-reply.js https://x.com/user/status/1234567890");
    process.exit(0);
  }

  for (const input of inputs) {
    const tweetId = extractTweetId(input);
    if (!tweetId) {
      console.log(`⚠️  URLの形式が正しくありません: ${input}`);
      continue;
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🔍 ツイート取得中... (ID: ${tweetId})`);

    let tweet, author;
    try {
      ({ tweet, author } = await fetchTweet(tweetId));
    } catch (e) {
      console.log(`❌ 取得失敗: ${e.message}`);
      continue;
    }

    console.log(`\n【元ツイート】 @${author?.username} (フォロワー: ${author?.public_metrics?.followers_count?.toLocaleString()})`);
    console.log(`いいね: ${tweet.public_metrics?.like_count}  RT: ${tweet.public_metrics?.retweet_count}  返信: ${tweet.public_metrics?.reply_count}`);
    console.log(`\n${tweet.text}\n`);
    console.log(`💬 返信文を生成中...`);

    const reply = await generateReply(
      tweet.text,
      author?.username,
      author?.public_metrics?.followers_count
    );

    console.log(`\n【コピーして投稿してください】`);
    console.log(`─`.repeat(50));
    console.log(reply);
    console.log(`─`.repeat(50));
    console.log(`\n🔗 投稿先: ${input}`);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("完了！上のテキストをコピーしてXで返信してください。");
}

main().catch((err) => {
  console.error("エラー:", err.message);
  process.exit(1);
});
