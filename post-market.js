import fs from "fs";
import path from "path";
import { TwitterApi } from "twitter-api-v2";

const xClient = new TwitterApi({
  appKey: process.env.X_API_KEY,
  appSecret: process.env.X_API_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET,
});

const IMAGES = [
  "01_夜勤明け朝5時の副業.png",
  "02_AIと人間の役割分担.png",
  "03_月5万達成の行動ログ.png",
  "04_売上0円からの話.png",
  "05_自動化に気づいた瞬間.png",
  "06_稼げる人と稼げない人.png",
  "07_Claude Code 正直な感想.png",
  "08_楽天アフィリ自動化.png",
  "09_毎日投稿が続く理由.png",
  "10_副業を始める人へ.png",
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseSets(txt) {
  return txt
    .split("===")
    .map((s) => s.trim())
    .filter((s) => s.includes("フック:"))
    .map((s) => {
      const hook = s.match(/フック:\s*([\s\S]+?)---/)?.[1]?.trim();
      const content = s.match(/内容:\s*([\s\S]+?)---/)?.[1]?.trim();
      const summary = s.match(/まとめ:\s*([\s\S]+?)$/)?.[1]?.trim();
      return { hook, content, summary };
    });
}

async function postSet(set, imgPath, idx) {
  console.log(`\n📤 [${idx + 1}/10] 投稿開始: ${set.hook.slice(0, 30)}...`);

  // Upload image
  const mediaId = await xClient.v1.uploadMedia(imgPath);

  // フック（画像付き）
  const hook = await xClient.v2.tweet({
    text: set.hook,
    media: { media_ids: [mediaId] },
  });
  console.log(`  ✅ フック: https://x.com/i/web/status/${hook.data.id}`);

  await sleep(3000);

  // 内容
  const content = await xClient.v2.tweet({
    text: set.content,
    reply: { in_reply_to_tweet_id: hook.data.id },
  });
  console.log(`  ✅ 内容: https://x.com/i/web/status/${content.data.id}`);

  await sleep(3000);

  // まとめ
  const summary = await xClient.v2.tweet({
    text: set.summary,
    reply: { in_reply_to_tweet_id: content.data.id },
  });
  console.log(`  ✅ まとめ: https://x.com/i/web/status/${summary.data.id}`);

  return hook.data.id;
}

async function main() {
  const startIdx = parseInt(process.argv[2] ?? "1"); // 0-based, default 1 (2本目から)
  const txt = fs.readFileSync("./x_posts_market.txt", "utf-8");
  const sets = parseSets(txt);

  console.log(`投稿数: ${sets.length - startIdx}本 (${startIdx + 1}〜${sets.length})`);

  for (let i = startIdx; i < sets.length; i++) {
    const imgPath = path.resolve(`./images/market/${IMAGES[i]}`);
    await postSet(sets[i], imgPath, i);

    if (i < sets.length - 1) {
      console.log("  ⏳ 90秒待機中...");
      await sleep(90000);
    }
  }

  console.log("\n🎉 全投稿完了！");
}

main().catch(console.error);
