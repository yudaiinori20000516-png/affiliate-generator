import http from "http";
import { exec } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const APP_ID = "27248412244776216";
const APP_SECRET = "990ee0f6a77a4c0419dba7733a1e2b37";
const REDIRECT_URI = "http://localhost:3000/callback";
const SCOPE = "threads_basic,threads_content_publish";

const authUrl = `https://threads.net/oauth/authorize?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${SCOPE}&response_type=code`;

console.log("🌐 ブラウザでThreads認証を開いています...");
exec(`open "${authUrl}"`);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:3000");
  if (url.pathname !== "/callback") return;

  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.end(`<h1>エラー: ${error}</h1>`);
    server.close();
    return;
  }

  if (!code) {
    res.end("<h1>コードが取得できませんでした</h1>");
    server.close();
    return;
  }

  console.log("✅ 認証コード取得！トークンに交換中...");
  res.end("<h1>認証完了！ターミナルに戻ってください。</h1><script>window.close()</script>");

  try {
    // 短期トークン取得
    const tokenRes = await fetch("https://graph.threads.net/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: APP_ID,
        client_secret: APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error("❌ 短期トークン取得失敗:", tokenData);
      server.close();
      return;
    }

    const shortToken = tokenData.access_token;
    const userId = tokenData.user_id;
    console.log(`✅ 短期トークン取得 (user_id: ${userId})`);

    // 長期トークンに交換（60日有効）
    const longRes = await fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${APP_SECRET}&access_token=${shortToken}`
    );
    const longData = await longRes.json();

    if (longData.error) {
      console.error("❌ 長期トークン取得失敗:", longData);
      server.close();
      return;
    }

    const longToken = longData.access_token;
    console.log(`✅ 長期トークン取得（有効期限: ${longData.expires_in}秒 ≒ ${Math.floor(longData.expires_in / 86400)}日）`);

    // .envに保存
    let env = readFileSync(".env", "utf-8");
    if (env.includes("THREADS_ACCESS_TOKEN=")) {
      env = env.replace(/THREADS_ACCESS_TOKEN=.*/, `THREADS_ACCESS_TOKEN=${longToken}`);
      env = env.replace(/THREADS_USER_ID=.*/, `THREADS_USER_ID=${userId}`);
    } else {
      env += `\nTHREADS_ACCESS_TOKEN=${longToken}\nTHREADS_USER_ID=${userId}\n`;
    }
    writeFileSync(".env", env);

    console.log("\n🎉 完了！.envにTHREADS_ACCESS_TOKENとTHREADS_USER_IDを保存しました");
    console.log("次のステップ: node generate.js でThreads投稿も自動化されます");
  } catch (e) {
    console.error("❌ エラー:", e.message);
  }

  server.close();
});

server.listen(3000, () => {
  console.log("📡 localhost:3000 で待機中... ブラウザでThreadsにログインして承認してください");
});
