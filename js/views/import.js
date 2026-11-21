import { state, commit, cats, sortedTx } from '../store.js';
import { esc, uid, today } from '../utils.js';
import { money, curCode, parseAmt, amtText } from '../fmt.js';
import { icon } from '../icons.js';
import { parseMessages, guessCategory } from '../sms.js';
import { actions, toast, card, empty } from '../ui.js';
import { rateMap } from '../rates.js';
import { lastAccountId } from './tx.js';

let text = '';
let items = [];

const SAMPLE = `HUMOCARD: Pokupka 25 000.00 UZS; KORZINKA TASHKENT; 8600 **** 1234; 20.11.26 14:05; Balans: 1 234 000.00 UZS

Uzcard: Oplata: 150000.00 UZS; Karta: 8600*1234; Merchant: YANDEX GO

Postuplenie: +5 000 000.00 UZS; Karta *1234; Zarplata; Balans: 6 100 000.00 UZS`;

function accountFor(last4) {
  return (last4 && state.accounts.find((a) => a.last4 === last4)?.id) || lastAccountId() || state.accounts[0]?.id;
}
const cashAccount = (exceptId) => state.accounts.find((a) => a.type === 'cash' && a.id !== exceptId)?.id || state.accounts.find((a) => a.id !== exceptId)?.id || '';

export function analyze(t) {
  const parsed = parseMessages(t, { currency: curCode(), usdRate: state.settings.usdRate, rates: rateMap() });
  const seen = new Set(state.imported || []);
  const tx = state.transactions;
  return parsed.map((p, i) => {
    const accountId = accountFor(p.last4);
    const type = p.type === 'cash' ? 'transfer' : p.type;
    const date = p.date && p.date <= today() ? p.date : today();
    const dup =
      seen.has(p.hash) ||
      tx.some((x) => x.date === date && x.amount === p.amount && x.accountId === accountId && (x.type === type || (x.type === 'transfer' && type === 'transfer')));
    return {
      id: i,
      checked: !dup,
      dup,
      type,
      amount: p.amount,
      note: p.merchant || (type === 'income' ? 'Kirim' : type === 'transfer' ? 'Naqd pul yechish' : ''),
      merchant: p.merchant,
      categoryId: type === 'transfer' ? null : guessCategory(p, state.rules || {}, type),
      accountId,
      toAccountId: type === 'transfer' ? cashAccount(accountId) : '',
      date,
      hash: p.hash,
      raw: p.raw,
      foreign: p.foreign,
      card: p.last4,
      balance: p.balance,
    };
  });
}
export function setImportText(t) {
  text = t;
  items = analyze(t);
}

function itemHtml(it) {
  const catList = cats(it.type === 'income' ? 'income' : 'expense');
  return `<article class="imp ${it.dup ? 'dup' : ''}" data-i="${it.id}">
    <div class="imp-h">
      <input class="imp-chk" type="checkbox" data-f="checked" ${it.checked ? 'checked' : ''} aria-label="Tanlash">
      <select class="input sm" data-f="type"><option value="expense" ${it.type === 'expense' ? 'selected' : ''}>Xarajat</option><option value="income" ${it.type === 'income' ? 'selected' : ''}>Daromad</option><option value="transfer" ${it.type === 'transfer' ? 'selected' : ''}>O'tkazma (naqd)</option></select>
      <input class="input amt imp-amt" inputmode="decimal" data-f="amount" value="${amtText(it.amount)}">
    </div>
    ${it.dup ? `<p class="imp-warn">${icon('bell', 14)} Bu xabar avval qo'shilgan bo'lishi mumkin (dublikat)</p>` : ''}
    <input class="input" data-f="note" value="${esc(it.note)}" placeholder="Do'kon / izoh">
    <div class="grid-2">
      ${it.type === 'transfer' ? `<select class="input" data-f="toAccountId">${state.accounts.map((a) => `<option value="${a.id}" ${a.id === it.toAccountId ? 'selected' : ''}>→ ${a.icon} ${esc(a.name)}</option>`).join('')}</select>` : `<select class="input" data-f="categoryId">${catList.map((c) => `<option value="${c.id}" ${c.id === it.categoryId ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select>`}
      <select class="input" data-f="accountId">${state.accounts.map((a) => `<option value="${a.id}" ${a.id === it.accountId ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('')}</select>
    </div>
    <div class="imp-meta"><input class="input sm" type="date" data-f="date" value="${it.date}">${it.card ? `<span class="pill">•••• ${it.card}</span>` : ''}${it.foreign ? `<span class="pill warn">${esc(it.foreign)}</span>` : ''}${it.balance != null ? `<span class="pill">Qoldiq ${money(it.balance, { force: true })}</span>` : ''}</div>
    <details><summary>Asl xabar</summary><p class="raw">${esc(it.raw)}</p></details>
  </article>`;
}
function resultsHtml() {
  if (!text.trim()) return '';
  if (!items.length) return empty('🔍', 'Summa topilmadi', "Xabarda summa (masalan «25 000 UZS») va amal turi (Pokupka, Postuplenie...) bo'lishi kerak. Boshqa xabar bilan urinib ko'ring.");
  const n = items.filter((i) => i.checked).length;
  return `<h3 class="sec">${items.length} ta xabar topildi</h3><div class="imp-list">${items.map(itemHtml).join('')}</div>
    <div class="imp-bar"><button class="btn primary block" data-act="import:save" ${n ? '' : 'disabled'}>${icon('check', 18)} Tanlanganlarni qo'shish (${n})</button></div>`;
}

export function renderImport() {
  const base = location.origin + location.pathname;
  return `
  <div class="page-head"><div><h1>Bank xabarlari</h1><p class="sub">SMS yoki Payme / Click / bank ilovasi xabarini joylang — summa, do'kon va kategoriyani o'zim aniqlayman</p></div></div>
  <section class="card">
    <label class="field"><span>Xabar(lar)ni shu yerga joylang</span><textarea id="impText" class="input" rows="6" placeholder="Masalan: HUMOCARD: Pokupka 25 000.00 UZS; KORZINKA; *1234">${esc(text)}</textarea></label>
    <div class="imp-actions"><button class="btn primary" data-act="import:run">${icon('sparkles', 16)} Tahlil qilish</button><button class="btn ghost" data-act="import:paste">${icon('upload', 16)} Buferdan</button><button class="btn ghost" data-act="import:sample">Namuna</button></div>
    <p class="muted small">Bir nechta xabarni bo'sh qator bilan ajratib joylashingiz mumkin. Hech narsa serverga yuborilmaydi.</p>
  </section>
  <div id="impResults">${resultsHtml()}</div>
  ${card(`${icon('zap', 18)} Avtomatik qilish`, `
    <details class="how" open><summary>🤖 Android</summary><ol><li>Ilovani o'rnating (Chrome → «Bosh ekranga qo'shish»).</li><li>Xabarlar ilovasida xabarni bosib turing → <b>Ulashish</b> → <b>Azimov</b>.</li><li>Xabar shu sahifada tahlilga tayyor bo'ladi.</li></ol></details>
    <details class="how"><summary>🍎 iPhone (Buyruqlar)</summary><ol><li><b>Buyruqlar → Avtomatlashtirish → Xabar</b> (jo'natuvchi: bankingiz raqami).</li><li>Amal: <b>URL'larni ochish</b>, manzil:<br><code class="url">${esc(base)}#/import?text=</code> + <i>Kiruvchi xabar</i> (URL-kodlangan).</li><li>«Darhol ishga tushirish» ni yoqing.</li></ol></details>
    <p class="muted small">⚠️ Brauzer ilovasi telefon SMS'larini <b>o'zi o'qiy olmaydi</b> (xavfsizlik cheklovi) — shuning uchun «ulashish» yoki «joylash» kerak. To'liq avtomatik o'qish uchun Android ilova (SMS ruxsati bilan) alohida yoziladi.</p>`, {})}`;
}

export function afterImport(root) {
  const ta = root.querySelector('#impText');
  ta?.addEventListener('input', () => (text = ta.value));
  const res = root.querySelector('#impResults');
  const redraw = () => (res.innerHTML = resultsHtml());
  res?.addEventListener('input', (e) => onField(e, false, redraw));
  res?.addEventListener('change', (e) => onField(e, true, redraw));
  // pasted/shared text arrives already analysed
}
function onField(e, isChange, redraw) {
  const f = e.target.dataset?.f;
  const card = e.target.closest('[data-i]');
  if (!f || !card) return;
  const it = items[Number(card.dataset.i)];
  if (!it) return;
  if (f === 'checked') it.checked = e.target.checked;
  else if (f === 'amount') it.amount = parseAmt(e.target.value);
  else if (isChange || f === 'note') it[f] = e.target.value;
  if (isChange && (f === 'type' || f === 'checked' || f === 'accountId')) {
    if (f === 'type') {
      it.categoryId = it.type === 'transfer' ? null : guessCategory({ merchant: it.merchant, raw: it.raw }, state.rules, it.type);
      if (it.type === 'transfer') it.toAccountId = cashAccount(it.accountId);
    }
    if (f === 'accountId' && it.type === 'transfer' && it.toAccountId === it.accountId) it.toAccountId = cashAccount(it.accountId);
    redraw();
  }
}

actions['import:run'] = () => {
  const ta = document.getElementById('impText');
  setImportText(ta?.value || '');
  document.getElementById('impResults').innerHTML = resultsHtml();
};
actions['import:sample'] = () => {
  document.getElementById('impText').value = SAMPLE;
  actions['import:run']();
};
actions['import:paste'] = async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (!t.trim()) return toast('Bufer bo\'sh', { type: 'warn' });
    document.getElementById('impText').value = t;
    actions['import:run']();
  } catch {
    toast("Buferdan o'qib bo'lmadi. Matnni qo'lda joylang", { type: 'warn' });
  }
};
actions['import:save'] = () => {
  const chosen = items.filter((i) => i.checked && i.amount > 0);
  if (!chosen.length) return;
  let n = 0;
  for (const it of chosen) {
    if (it.type === 'transfer' && (!it.toAccountId || it.toAccountId === it.accountId)) continue;
    state.transactions.push({
      id: uid(),
      ts: Date.now() + n,
      type: it.type,
      amount: it.amount,
      accountId: it.accountId,
      toAccountId: it.type === 'transfer' ? it.toAccountId : null,
      categoryId: it.type === 'transfer' ? null : it.categoryId,
      date: it.date,
      note: it.note.trim(),
    });
    if (it.type !== 'transfer' && it.merchant && it.categoryId) (state.rules ||= {})[it.merchant.toLowerCase()] = it.categoryId;
    (state.imported ||= []).push(it.hash);
    n++;
  }
  if (state.imported.length > 3000) state.imported = state.imported.slice(-3000);
  text = '';
  items = [];
  commit();
  toast(`${n} ta tranzaksiya qo'shildi ✅`, { type: 'ok' });
  location.hash = '#/transactions';
};
