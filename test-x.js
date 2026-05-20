import { TwitterApi } from "twitter-api-v2";

const xClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

try {
  const me = await xClient.v2.me();
  console.log("認証OK:", me.data.username);
  const tweet = await xClient.v2.tweet("テスト投稿（すぐ削除）");
  console.log("投稿成功:", tweet.data.id);
} catch (e) {
  console.log("エラー詳細:", JSON.stringify(e.data ?? e.errors ?? e.message, null, 2));
  console.log("コード:", e.code);
}
