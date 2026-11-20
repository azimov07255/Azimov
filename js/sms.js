/**
 * Bank / payment-app message parser (Humo, Uzcard, Payme, Click, bank apps; Uzbek, Russian, Latin).
 * Pure functions, no DOM: parseMessages(text, {currency, usdRate}) -> items.
 * A browser cannot read the SMS inbox; messages arrive by paste, share-to-app or a Shortcuts/automation URL.
 */
import { KEYWORDS } from './data.js';

const OUT = /pokupka|oplata|oplat|xarid|to'?lov\b|spisan|списан|покупк|оплат|platyozh|snyatie|снятие|yechil|yechib|chiqim|rasxod|расход|perevod (?:na|v)|o'?tkazma (?:amalga)?|payment|purchase|debit|withdraw|vy oplatili|вы оплатили|sarflandi|ushlandi|charge/i;
const IN = /postuplen|popolnen|zachislen|kirim|tushum|поступлен|пополнен|зачислен|perevod ot|перевод от|credit(?!\s*card)|deposit|income|qabul qilindi|keldi|vozvrat|возврат|qaytarildi|cashback|кэшбэк/i;
const CASH = /bankomat|atm|snyatie nal|снятие нал|nalichn|наличн|yechib olish|naqd pul yech|cash ?out|withdrawal/i;
// whole-word stripping that also works for Cyrillic (JS \b is ASCII-only)
const L = '(?<![\\p{L}\\p{N}])';
const R = '(?![\\p{L}\\p{N}])';
const OUT_WORD = new RegExp('(?:' + OUT.source + ')\\p{L}*', 'giu');
const IN_WORD = new RegExp('(?:' + IN.source + ')\\p{L}*', 'giu');
const NOISE = new RegExp(
  L + "(?:humo(?:card)?|uzcard|click|payme|visa|mastercard|karta|karty|karte|card|карта|карты|карте|картой|uzs|so'?m|sum|сум|spisano|списано|na|ot|v|dlya|uchun|orqali|via|hisob|hisobingiz|hisobingizdan|sizning|vy|za|oplata|pokupka|успешно|muvaffaqiyatli|amalga oshirildi|tranzaksiya|transaction|operatsiya|операция|s|с|по)" + R,
  'giu'
);
const BAL = /(balans|balance|баланс|остаток|ostatok|qoldiq|dostupno|доступно|available|dost\.?)\s*[:=-]?\s*/i;
const CUR = '(?:uzs|so\'?m|sum|сум|сўм|usd|\\$|eur|€|rub|руб|₽)';
const NUM = '(?:\\d{1,3}(?:[\\s\\u00A0]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d+)?)';
const DATE_RE = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b(?:[ ,T]+(\d{1,2}):(\d{2}))?|\b(\d{4})-(\d{2})-(\d{2})\b(?:[ ,T]+(\d{1,2}):(\d{2}))?/;
const CARD_RE = /(?:\b\d{4}[ *x•.-]{1,6}\d{0,2}[*x•.\s-]{2,}\d{4}\b|[*•x]{1,}\s?\d{4}\b|\bkarta\b[:\s]*\d{4}\b|\bcard\b[:\s]*\d{4}\b|\bkarta\s*\*+\s*\d{4})/gi;

export function parseNum(raw) {
  let s = String(raw).replace(/[\s ]/g, '');
  if (!s) return NaN;
  const c = s.lastIndexOf(',');
  const d = s.lastIndexOf('.');
  if (c > -1 && d > -1) {
    const dec = c > d ? ',' : '.';
    s = s.split(dec === ',' ? '.' : ',').join('').replace(dec, '.');
  } else if (c > -1) s = /,\d{1,2}$/.test(s) && s.split(',').length === 2 ? s.replace(',', '.') : s.replace(/,/g, '');
  else if (d > -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return parseFloat(s);
}
const curCode = (t = '') => (/usd|\$/i.test(t) ? 'USD' : /eur|€/i.test(t) ? 'EUR' : /rub|руб|₽/i.test(t) ? 'RUB' : 'UZS');

export function hashOf(s) {
  const n = s.toLowerCase().replace(/[^a-z0-9а-я]/g, '');
  let h = 5381;
  for (let i = 0; i < n.length; i++) h = ((h << 5) + h + n.charCodeAt(i)) | 0;
  return 'm' + (h >>> 0).toString(36);
}

export function splitMessages(text) {
  const blocks = String(text || '')
    .replace(/\r/g, '')
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
  const out = [];
  for (const b of blocks) {
    const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
    const msgLike = lines.filter((l) => new RegExp(NUM + '\\s*' + CUR, 'i').test(l) && (OUT.test(l) || IN.test(l) || CASH.test(l)));
    if (lines.length > 1 && msgLike.length === lines.length) out.push(...lines);
    else out.push(lines.join(' '));
  }
  return out;
}

export function findDate(t) {
  const m = t.match(DATE_RE);
  if (!m) return { date: null, rest: t };
  let y, mo, d;
  if (m[6]) [y, mo, d] = [+m[6], +m[7], +m[8]];
  else {
    [d, mo, y] = [+m[1], +m[2], +m[3]];
    if (y < 100) y += 2000;
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
  }
  const dt = new Date(y, mo - 1, d);
  const ok = dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
  const iso = ok ? `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
  return { date: iso, rest: t.replace(m[0], ' ') };
}

export function titleCase(s) {
  if (s && s === s.toUpperCase() && /[A-Z]/.test(s)) return s.toLowerCase().replace(/(^|[\s\-/.])([a-zа-я])/g, (_, a, b) => a + b.toUpperCase());
  return s;
}

export function parseOne(raw, opts = {}) {
  const orig = raw.trim();
  let t = ' ' + orig + ' ';
  // 1) balance segment (must never be mistaken for the amount)
  let balance = null;
  const bm = t.match(new RegExp(BAL.source + '(' + NUM + ')\\s*(' + CUR + ')?', 'i'));
  if (bm) {
    balance = parseNum(bm[2]);
    t = t.replace(bm[0], ' ');
  }
  // 2) card
  let last4 = null;
  const cards = t.match(CARD_RE);
  if (cards) {
    const m4 = cards[cards.length - 1].match(/(\d{4})\s*$/);
    last4 = m4 ? m4[1] : null;
    t = t.replace(CARD_RE, ' ');
  }
  // 3) date
  const { date, rest } = findDate(t);
  t = rest.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ');
  // 4) amount: number glued to a currency, else the biggest decimal-looking number
  let amount = NaN;
  let currency = 'UZS';
  let sign = '';
  const cm = [...t.matchAll(new RegExp('([+\\-−])?\\s*(' + NUM + ')\\s*(' + CUR + ')', 'gi'))];
  const cm2 = [...t.matchAll(new RegExp('(' + CUR + ')\\s*([+\\-−])?\\s*(' + NUM + ')', 'gi'))];
  if (cm.length) {
    const m = cm[0];
    amount = parseNum(m[2]);
    currency = curCode(m[3]);
    sign = m[1] || '';
    t = t.replace(m[0], ' ');
  } else if (cm2.length) {
    const m = cm2[0];
    amount = parseNum(m[3]);
    currency = curCode(m[1]);
    sign = m[2] || '';
    t = t.replace(m[0], ' ');
  } else {
    const nums = [...t.matchAll(new RegExp('([+\\-−])?(' + NUM + ')', 'g'))].map((m) => ({ m, v: parseNum(m[2]) })).filter((x) => x.v >= 1);
    if (nums.length) {
      nums.sort((a, b) => b.v - a.v);
      amount = nums[0].v;
      sign = nums[0].m[1] || '';
      t = t.replace(nums[0].m[0], ' ');
    }
  }
  if (!(amount > 0)) return null;
  const head = orig.slice(0, 160);
  let type = CASH.test(orig) ? 'cash' : null;
  if (!type) {
    const iOut = orig.search(OUT);
    const iIn = orig.search(IN);
    if (iOut >= 0 && (iIn < 0 || iOut <= iIn)) type = 'expense';
    else if (iIn >= 0) type = 'income';
    else type = sign === '+' ? 'income' : 'expense';
  }
  if (type === 'expense' && /[+]\s*\d/.test(head) && !OUT.test(orig)) type = 'income';
  // 5) merchant
  let merchant = '';
  const label = orig.match(/(?:merchant|magazin|do'?kon|tashkilot|poluchatel|получатель|торговая точка|joy|obyekt|ob'yekt|to|for|za|для|на)\s*[:\-]\s*([^;,\n|]+)/i);
  if (label) merchant = label[1].trim();
  if (!merchant) {
    const cleaned = t
      .replace(OUT_WORD, ' ')
      .replace(IN_WORD, ' ')
      .replace(NOISE, ' ')
      .replace(/[:;|]+/g, ',')
      .replace(/\s+/g, ' ');
    const parts = cleaned.split(/[,\n]|\s-\s|\.\s(?=[A-ZА-Я])/).map((x) => x.replace(/[^\p{L}\p{N}&'’ .\-/]/gu, '').trim()).filter((x) => x.length >= 2 && /\p{L}/u.test(x));
    merchant = parts.sort((a, b) => b.length - a.length)[0] || '';
  }
  merchant = titleCase(merchant.replace(/\s+/g, ' ').replace(/^[\s.\-]+|[\s.\-]+$/g, '')).slice(0, 48);

  // 6) currency conversion into the app currency
  const base = opts.currency || 'UZS';
  let value = amount;
  let note = '';
  if (currency !== base) {
    if (currency === 'USD' && base === 'UZS' && opts.usdRate) {
      value = Math.round(amount * opts.usdRate);
      note = `${amount} USD`;
    } else note = `${amount} ${currency}`;
  }
  return { raw: orig, hash: hashOf(orig), type, amount: Math.round(value * 100) / 100, currency, foreign: note, merchant, last4, balance, date };
}

export function guessCategory(item, rules = {}, type = item.type) {
  const key = (item.merchant || '').toLowerCase();
  if (key && rules[key]) return rules[key];
  const hay = `${item.merchant} ${item.raw}`;
  for (const [id, re] of KEYWORDS) {
    const inc = id.startsWith('i_');
    if ((type === 'income') !== inc) continue;
    if (re.test(hay)) return id;
  }
  return type === 'income' ? 'i_other' : 'c_other';
}

export function parseMessages(text, opts = {}) {
  return splitMessages(text).map((m) => parseOne(m, opts)).filter(Boolean);
}
