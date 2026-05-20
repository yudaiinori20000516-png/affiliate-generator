import { TwitterApi } from "twitter-api-v2";

const xClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

const posts = [
  `Claude Codeで副業を始めて気づいたこと。

プログラミングは不要だった。

必要なのは
「何をやらせるか」を考える力だけ。

AIは良い指示がよい成果を生む。
指示力さえあれば、誰でも再現できる。

#ClaudeCode #AI副業 #副業術`,

  `AI副業で成果が出る人の共通点。

ツールを使いこなしている。
ではなく

「仕組みを作っている」。

毎日手動でやるより
一度作った仕組みを回す方が強い。

Claude Codeはその仕組みを作るのに向いている。

#ClaudeCode #AI副業 #副業術`,

  `Claude Code副業の実態を書く。

月の作業時間：約10時間
ジャンル：Note記事の自動生成と投稿

具体的なフロー：
Claude Codeで記事生成
APIで関連リンクを自動挿入
Noteに保存して投稿
Xで集客

スクリプト1本で全部動く。
時間を売らない働き方の実験中。

#ClaudeCode #AI副業 #副業`,

  `「AI副業は難しそう」←よくある誤解。

Claude Codeへの入力はこれだけ：

「〇〇について2000字の記事を書いて」

30秒で骨格ができる。
あとはNoteに貼るだけ。

ツールより先に「何を発信するか」を決める。
それだけで動き出せる。

#ClaudeCode #AI副業 #副業術`,

  `ClaudeCode×Note副業、最初の3ステップ。

①テーマを1つ決める
AI・ChatGPT・副業など自分が語れるもの

②Claude Codeに記事を書かせる
プロンプト1行でOK

③Noteに投稿して実績を積む
まず10記事が最初のゴール

難しく考えなくていい。
動けば見えてくるものがある。

#ClaudeCode #AI副業 #ChatGPT活用`,
];

async function main() {
  console.log(`X投稿 ${posts.length}本を順に投稿します...\n`);

  for (let i = 0; i < posts.length; i++) {
    try {
      const tweet = await xClient.v2.tweet(posts[i]);
      console.log(`✅ 投稿${i + 1}完了: https://x.com/i/web/status/${tweet.data.id}`);
      if (i < posts.length - 1) await new Promise(r => setTimeout(r, 5000));
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
