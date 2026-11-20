/**
 * Receipt (chek) text -> {merchant, total, date, items, candidates}.
 * Pure functions (no DOM) so they can be tested without OCR. Handles Uzbek (Latin) and Russian receipts.
 */
import { parseNum, findDate, titleCase } from './sms.js';

const NUM = /(?:\d{1,3}(?:[\s ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;
const STRONG = /itog[o0]|итого|итог\b|jam[i1l!|]\b|jam[i1l!|]\s*to'?lov|к\s*оплате|to'?lanadigan|to'?lash uchun|total|amount due|summa k oplate/i;
const WEAK = /summa|сумма|to'?lov\b|оплата|oplata/i;
// lines that can never carry the receipt total
const JUNK = /qqs|ндс|nds|vat|chegirma|скидка|discount|bonus|бонус|stir|инн|\binn\b|\btel\b|тел\b|telefon|kassa|касса|chek\s*(?:№|n\b|#)|чек\s*(?:№|n\b|#)|barcode|штрих|\bid\b|\bkod\b|код|ofd|fiskal|фискал|sertifikat|\d\s*%/i;
// payment lines (amount paid): usable as a fallback for the total
const PAY = /naqd|наличн|nalichn|plastik|пластик|karta|карта|card|uzcard|humo|payme|click/i;
const CASH_GIVEN = /naqd|наличн|nalichn|cash|berildi|получено|vnesen|внесено/i;
const CHANGE = /qaytim|сдача|sdacha|change/i;
const SKIP_NAME = /chek|check|kassa|касса|stir|инн|inn|tel|тел|manzil|адрес|address|ko'?cha|улица|\bул\b|tuman|район|shahar|город|ofd|fiskal|фискал|№|www|http|qr|sana|дата|vaqt|время|kassir|кассир|sotuvchi|savdo cheki|товарный|receipt|welcome|xush kelibsiz|rahmat|спасибо/i;

const amountsIn = (line) =>
  [...line.matchAll(NUM)]
    .map((m) => ({ raw: m[0], v: parseNum(m[0]), i: m.index }))
    .filter((x) => Number.isFinite(x.v) && x.v > 0 && x.raw.replace(/\D/g, '').length <= 10);

// OCR often turns 0 into O / l into 1 inside numbers; fix only tokens that are clearly numeric
export function cleanLine(l) {
  return l
    .replace(/[|]/g, ' ')
    .replace(/(?<=\d)[Oo](?=[\d\s.,]|$)|(?<=[\d.,\s])[Oo](?=\d)/g, '0')
    .replace(/(?<=\d)[lI](?=\d)/g, '1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseReceipt(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n').map(cleanLine).filter((l) => l.length > 1);
  // ----- date -----
  let date = null;
  for (const l of lines) {
    const r = findDate(` ${l} `);
    if (r.date) {
      date = r.date;
      break;
    }
  }

  // ----- total -----
  const cand = [];
  lines.forEach((l, idx) => {
    const nums = amountsIn(l);
    if (!nums.length) return;
    const strong = STRONG.test(l);
    const pay = PAY.test(l);
    const junk = JUNK.test(l) && !strong;
    if (junk) return;
    if (!strong && !WEAK.test(l) && !pay && !CHANGE.test(l)) return;
    // "JAMI: 34 900" - the amount follows the label; with several numbers the last one is the sum
    cand.push({ v: nums[nums.length - 1].v, score: strong ? 3 : WEAK.test(l) && !pay ? 1 : 0, pay, cash: CASH_GIVEN.test(l), change: CHANGE.test(l), line: idx });
  });
  let total = null;
  const scored = cand.filter((c) => c.score >= 1 && !c.change);
  if (scored.length) {
    // strongest label wins; among equals the later one (grand total sits at the bottom)
    scored.sort((a, b) => b.score - a.score || b.line - a.line);
    total = scored[0].v;
  } else {
    const cash = cand.find((c) => c.cash && !c.change);
    const chg = cand.find((c) => c.change);
    const card = cand.filter((c) => c.pay && !c.cash && !c.change).sort((a, b) => b.v - a.v)[0];
    if (card) total = card.v; // card is charged exactly the total
    else if (cash && chg && cash.v > chg.v) total = cash.v - chg.v;
    else if (cash) total = cash.v;
    else {
      const all = lines.flatMap((l) => (JUNK.test(l) ? [] : amountsIn(l).map((x) => x.v))).filter((v) => v >= 100 && !(v >= 1990 && v <= 2100));
      total = all.length ? Math.max(...all) : null;
    }
  }

  // ----- items: "Non 2 x 3 500 7 000" / "Sut 1L 1 x 12 900 12 900" -----
  const items = [];
  for (const l of lines) {
    if (STRONG.test(l) || JUNK.test(l) || PAY.test(l) || CHANGE.test(l)) continue;
    const m = l.match(/^(\p{L}[\p{L}\s'.\-/]{1,40}?)(?=\s*\d)/u);
    const nums = amountsIn(l);
    if (!m || !nums.length) continue;
    const name = m[1].trim();
    const sum = nums[nums.length - 1].v;
    if (name.length < 2 || sum < 1 || SKIP_NAME.test(name) || name.includes(',')) continue;
    items.push({ name, sum });
  }

  // ----- merchant: first meaningful text line near the top -----
  let merchant = '';
  for (const l of lines.slice(0, 8)) {
    const letters = (l.match(/\p{L}/gu) || []).length;
    if (letters < 3 || letters < l.replace(/\s/g, '').length * 0.5) continue;
    if (SKIP_NAME.test(l)) continue;
    merchant = l.replace(/["«»“”']/g, '').replace(/\b(ooo|ооо|mchj|мчж|ao|ип|ИП|ytt)\b\.?/gi, '').replace(/\s+/g, ' ').trim();
    if (merchant.length >= 3) break;
    merchant = '';
  }
  merchant = titleCase(merchant).slice(0, 48);

  const all = [...new Set(cand.filter((c) => !c.change && c.v >= 1).map((c) => c.v))].sort((a, b) => b - a).slice(0, 6);
  return { merchant, total, date, items: items.slice(0, 40), candidates: all, lines };
}

// QR printed on fiscal receipts: https://ofd.soliq.uz/check?...&c=20261120143200&s=...
export function parseFiscalQr(url) {
  try {
    const u = new URL(url);
    const c = u.searchParams.get('c') || '';
    const s = u.searchParams.get('s');
    const date = /^\d{8}/.test(c) ? `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}` : null;
    return { date, sum: s ? Number(s) : null, url };
  } catch {
    return null;
  }
}
