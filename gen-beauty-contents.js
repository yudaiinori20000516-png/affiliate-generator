import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic();

const themes = [
  "夜勤明けの肌崩壊を救ったスキンケア習慣",
  "病院食から学んだ「痩せる食事」の正体",
  "救命士が教える「むくみ」の本当の原因と即効ケア",
  "腸活と美肌の関係を医療職が本気で解説する",
  "睡眠と美容の深い関係【夜勤で肌・体型が崩れるメカニズム】",
];

function buildPrompt(themeIndex, themeName) {
  return `あなたは美容・健康・ダイエットジャンルのSNSコンテンツプランナーです。
救急救命士として総合病院で3年働きながらAI副業・美容発信をしている女性視点で書いてください。
医療の知識を持つ人間ならではのリアルな視点と体験談を盛り込むこと。

【テーマの方向性】
美容×健康×ダイエットジャンルで、最終的に美容グッズ・サプリのアフィリエイトに繋げる構成にすること。
ターゲット: 20〜35歳の女性、美容・健康に関心がある。
文体: 話し言葉ベース、親しみやすく、体験談スタイル。AIっぽい表現・広告っぽい表現禁止。

以下のテーマについて全てのコンテンツを作成してください。

═══════════════════════════════════════
【テーマ${themeIndex}】${themeName}
═══════════════════════════════════════

◆ YouTube用台本

タイトル（SEOキーワード入り）:

サムネイルテキスト案:
案1:
案2:
案3:

台本:
[オープニング 約30秒]
（台本本文）

[本編 約3分]
（台本本文）

[クロージング 約30秒]
（台本本文）

概要欄テキスト:
（説明文＋アフィリリンク誘導文。リンク挿入箇所に【LINK:楽天検索キーワード】と記載）

ハッシュタグ（10個）:

─────────────────────────────────

◆ TikTok用台本

タイトル:

フック（冒頭3秒）:

台本（15〜30秒）:

キャプション:
（アフィリリンク誘導文含む。リンク挿入箇所に【LINK:楽天検索キーワード】と記載）

ハッシュタグ（5個）:

─────────────────────────────────

◆ Instagram用

スライドテキスト案（5枚）:
1枚目（フック）:
2枚目:
3枚目:
4枚目:
5枚目（CTA）:

キャプション:
（アフィリリンク誘導文含む。リンク挿入箇所に【LINK:楽天検索キーワード】と記載）

ハッシュタグ（20個）:

リール用台本（30秒）:

─────────────────────────────────

◆ アフィリエイト設計

紹介すべき商品カテゴリ:

楽天で検索すべきキーワード（3〜5個）:

自然な紹介の流れ:

上記フォーマット通りに全て埋めて出力してください。説明文不要。`;
}

console.log("📝 美容×健康×ダイエット コンテンツを生成中...\n");

const header = `美容×健康×ダイエット SNSコンテンツ一覧
生成日時: ${new Date().toLocaleString("ja-JP")}
${"=".repeat(60)}\n\n`;

fs.writeFileSync("./beauty_contents.txt", header, "utf-8");

for (let i = 0; i < themes.length; i++) {
  const theme = themes[i];
  console.log(`  [${i + 1}/5] 「${theme}」を生成中...`);

  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: buildPrompt(i + 1, theme) }],
  });

  const content = message.content[0].text;
  fs.appendFileSync("./beauty_contents.txt", content + "\n\n", "utf-8");
  console.log(`  ✅ テーマ${i + 1} 完了（${content.length}字）`);

  if (i < themes.length - 1) await new Promise(r => setTimeout(r, 1000));
}

const stats = fs.statSync("./beauty_contents.txt");
const lines = fs.readFileSync("./beauty_contents.txt", "utf-8").split("\n").length;
console.log(`\n✅ 全5テーマ生成完了！`);
console.log(`   保存先: beauty_contents.txt`);
console.log(`   行数: ${lines}行 / ファイルサイズ: ${Math.round(stats.size / 1024)}KB`);
