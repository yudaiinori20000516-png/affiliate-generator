import { TwitterApi } from "twitter-api-v2";

const xClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

// 10万インプレ超えの投稿に寄せた5本
// パターン: 逆説・Before/After・ノウハウ公開・本音・リスト
const posts = [
  // Pattern 1: Before/After（具体的数字で信頼獲得）
  `AIを副業に使う前と後で変わったこと。

【Before】
記事1本：4〜5時間
月に書ける本数：4〜6本
毎日消耗していた

【After】
記事1本：30分（生成＋確認）
月に書ける本数：20本以上
週末だけで回せる

ツールが変わったんじゃなくて
「時間の使い方」が変わった。

#AI副業 #ChatGPT活用 #副業術`,

  // Pattern 2: 逆説フック（反直感で止める）
  `「AIで稼ぐのは文章力がない人がやること」

と言われた。

現実は逆で
文章力がある人ほどAIを使った方がいい。

AIに骨格を作らせて
人間が磨けばいい。

AIは下書き担当。
あなたは編集長。

その構造に気づいた時点で勝ち。

#AI副業 #ChatGPT活用 #副業`,

  // Pattern 3: ノウハウ公開（保存される投稿）
  `ClaudeでNote記事を書く時のプロンプト。

「[テーマ]について、
悩みを持つ初心者に向けて
2000字で記事を書いて。
見出しは【】形式で。
重要な部分だけ太字にして。」

これだけで記事の骨格が30秒でできる。

毎日1本出すだけで
3ヶ月後に30記事のストック。

継続だけが唯一の差別化になる。

#ClaudeCode #AI副業 #副業術`,

  // Pattern 4: 本音系（共感を呼ぶ失敗談）
  `副業を始めた時の正直な話。

最初の1ヶ月は
収益ゼロだった。

今振り返ると
「0→1」が全てだと分かる。

最初の1記事を出したかどうかで
その後が全部変わる。

AIがあれば記事は書ける。
問題は「出す勇気」だけ。

まず1本。それだけでいい。

#AI副業 #副業 #副業術`,

  // Pattern 5: リスト（保存・RT狙い）
  `AI副業で伸びている人の共通点、5つ。

1. 完璧な記事より速さを優先する
2. ジャンルを1つに絞っている
3. 毎日投稿より毎週投稿を続けている
4. 失敗した記事をデータとして見ている
5. 「稼ごう」より「届けよう」で書いている

どれも才能じゃなくて
習慣と視点の話。

#AI副業 #副業術 #ChatGPT活用`,
];

async function main() {
  console.log(`バイラル狙いX投稿 ${posts.length}本を順に投稿します...\n`);

  for (let i = 0; i < posts.length; i++) {
    try {
      const tweet = await xClient.v2.tweet(posts[i]);
      console.log(`✅ 投稿${i + 1}完了: https://x.com/i/web/status/${tweet.data.id}`);
      if (i < posts.length - 1) await new Promise(r => setTimeout(r, 8000));
    } catch (e) {
      console.error(`❌ 投稿${i + 1}失敗: ${e.message}`, JSON.stringify(e.data ?? "", null, 2));
    }
  }

  console.log("\n全投稿完了！");
}

main().catch(err => {
  console.error("エラー:", err.message);
  process.exit(1);
});
