import fs from "fs";

const TOKEN = process.env.THREADS_ACCESS_TOKEN;
const USER_ID = process.env.THREADS_USER_ID;

const raw = fs.readFileSync("./x_posts.txt", "utf-8");

// 投稿ブロックを分割（===で区切る）
const blocks = raw.split(/={10,}/).map(b => b.trim()).filter(b => b.length > 0);

const posts = blocks.map(block => {
  // 【投稿N】タイトル行と---を除いて本文だけ取る
  const lines = block.split("\n");
  const sepIdx = lines.findIndex(l => l.trim() === "---");
  if (sepIdx === -1) return null;
  return lines.slice(sepIdx + 1).join("\n").trim();
}).filter(Boolean);

console.log(`📋 ${posts.length}本の投稿を順番に投稿します...\n`);

for (let i = 0; i < posts.length; i++) {
  const text = posts[i];
  console.log(`投稿${i + 1}/${posts.length}...`);

  // コンテナ作成
  const createRes = await fetch(`https://graph.threads.net/v1.0/${USER_ID}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_type: "TEXT", text, access_token: TOKEN }),
  });
  const createData = await createRes.json();

  if (createData.error) {
    console.error(`  ❌ 投稿${i + 1}作成失敗:`, createData.error.message);
    continue;
  }

  await new Promise(r => setTimeout(r, 2000));

  // 公開
  const publishRes = await fetch(`https://graph.threads.net/v1.0/${USER_ID}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: createData.id, access_token: TOKEN }),
  });
  const publishData = await publishRes.json();

  if (publishData.error) {
    console.error(`  ❌ 投稿${i + 1}公開失敗:`, publishData.error.message);
  } else {
    console.log(`  ✅ 投稿${i + 1}完了: https://www.threads.net/t/${publishData.id}`);
  }

  // 連投規制対策で30秒待つ
  if (i < posts.length - 1) {
    console.log("  ⏳ 30秒待機中...");
    await new Promise(r => setTimeout(r, 30000));
  }
}

console.log("\n✅ 全投稿完了！");
