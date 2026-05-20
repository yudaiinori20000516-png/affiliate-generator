export const PAID_MARKER_PATTERN = /【ここから有料部分｜(\d+)円】/g;
export const DEFAULT_PAID_PRICE = 100;
export const MIN_PAID_PRICE = 100;
export const MAX_PAID_PRICE = 9999;
export const NOTE_ACCOUNT = process.env.NOTE_ACCOUNT || "ailab2026";

export function validatePaidPrice(price) {
  const normalized = Number.isInteger(price) ? price : DEFAULT_PAID_PRICE;
  if (normalized < MIN_PAID_PRICE || normalized > MAX_PAID_PRICE) {
    throw new Error(`有料記事価格が範囲外です: ${normalized}円。${MIN_PAID_PRICE}〜${MAX_PAID_PRICE}円で指定してください。`);
  }
  return normalized;
}

export function preparePaidArticleBody(body) {
  const matches = [...body.matchAll(PAID_MARKER_PATTERN)];
  const isPaid = matches.length > 0;
  const rawPrice = parseInt(matches[0]?.[1] ?? String(DEFAULT_PAID_PRICE), 10);
  const price = validatePaidPrice(Number.isInteger(rawPrice) ? rawPrice : DEFAULT_PAID_PRICE);
  const cleanedBody = body
    .replace(PAID_MARKER_PATTERN, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { body: cleanedBody, isPaid, price };
}

export function toPublicNoteUrl(url) {
  const match = url.match(/\/notes\/(n[a-z0-9]+)/i) || url.match(/\/n\/(n[a-z0-9]+)/i);
  if (!match) return url;
  return `https://note.com/${NOTE_ACCOUNT}/n/${match[1]}`;
}
