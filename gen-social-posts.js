import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic();

const prompt = `あなたは救急救命士として総合病院で3年働きながらAI副業をやっている人間です。
アカウント名「AIツール研究所」としてX（Twitter）とThreadsに投稿します。

以下の条件でX用とThreads用の投稿文を5セット作成してください。

テーマ：AI副業
ターゲット：副業に興味がある20〜40代の会社員

フックの型（5本それぞれ必ず別の型を使うこと）：
- 数字系：「月◯万円」「◯時間」など具体的な数字で驚かせる
- 逆説系：「やっても稼げない理由」「頑張るほど失敗する」
- 共感系：「これ知らずにやってる人多すぎる」「副業始めたけど変わらない人へ」
- 緊急系：「今すぐやらないと手遅れ」「半年後に後悔する」
- 語りかけ系：「知っていましたか？」「正直に聞きます」
- 暴露系：「稼いでる人が言わないこと」「実際のリアルを話します」
- 限定系：「医療職だから気づいた」「非エンジニアが発見した」

共通条件：
- 救急救命士・総合病院3年勤務の体験談として書く
- 話し言葉ベース、「笑」を自然に使う
- AIっぽい・広告っぽい言い回し禁止

X用の条件（メインポスト＋リプライの2投稿構成）：
- メインポスト: フックと問題提起のみ。誘導文・ハッシュタグなし。自然に続きが気になる終わり方。100文字以内厳守。
- リプライ: 解決策・内容・まとめ＋「詳しくはプロフのNoteリンクへ」などの自然な誘導＋ハッシュタグ（#AI副業 #生成AI #副業 から3つ）。300文字以内厳守。
- 1文ごとに改行、短くテンポよく

Threads用の条件：
- 1投稿500文字以内の単発投稿
- フック→内容→まとめ→Note誘導→ハッシュタグの流れで書く
- X版より少し詳しく体験談を膨らませる

出力形式（厳守）：

===POST_START===
【フック型】（型の名前）
【テーマ】（この投稿のテーマ）

[X用メインポスト]
メインポスト文（100文字以内）

---
[X用リプライ]
リプライ文（300文字以内・ハッシュタグ含む）

[Threads用]
投稿文章（ハッシュタグ含む）
===POST_END===

5セット分出力してください。説明文は不要。`;

console.log("📝 Claude APIで投稿文を生成中...\n");

const message = await client.messages.create({
  model: "claude-opus-4-6",
  max_tokens: 4096,
  messages: [{ role: "user", content: prompt }],
});

const raw = message.content[0].text;

// パース
const postBlocks = raw.split("===POST_START===").slice(1).map(b => {
  const content = b.split("===POST_END===")[0].trim();
  const hookMatch = content.match(/【フック型】(.+)/);
  const themeMatch = content.match(/【テーマ】(.+)/);

  const xMainMatch = content.match(/\[X用メインポスト\]([\s\S]+?)---/);
  const xReplyMatch = content.match(/---\n\[X用リプライ\]([\s\S]+?)\[Threads用\]/);
  const threadsMatch = content.match(/\[Threads用\]([\s\S]+?)$/);

  return {
    hook: hookMatch?.[1]?.trim() || "",
    theme: themeMatch?.[1]?.trim() || "",
    xMain: xMainMatch?.[1]?.trim() || "",
    xReply: xReplyMatch?.[1]?.trim() || "",
    threads: threadsMatch?.[1]?.trim() || "",
  };
});

// x_posts.txtに追記
const timestamp = new Date().toLocaleString("ja-JP");
let output = `\n\n${"=".repeat(50)}\n生成日時: ${timestamp}\n${"=".repeat(50)}\n`;

postBlocks.forEach((post, i) => {
  output += `\n【投稿${i + 1}】${post.theme}（${post.hook}）\n`;
  output += `${"─".repeat(40)}\n`;
  output += `■ X用投稿\n\n`;
  output += `[メインポスト]\n${post.xMain}\n\n`;
  output += `[リプライ]\n${post.xReply}\n\n`;

  output += `■ Threads用\n\n${post.threads}\n`;
  output += `\n${"=".repeat(50)}\n`;
});

fs.appendFileSync("./x_posts.txt", output, "utf-8");

console.log(`✅ ${postBlocks.length}セット生成・追記完了！`);
console.log("\n--- 生成内容プレビュー ---\n");
postBlocks.forEach((post, i) => {
  console.log(`投稿${i + 1}: 【${post.hook}】${post.theme}`);
});
