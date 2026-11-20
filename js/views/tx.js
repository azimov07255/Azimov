import { state, addTx, updateTx, delTx, catOf, acctOf, cats, sortedTx, balanceOf } from '../store.js';
import { esc, today, relDay, monthLabel, addMonths, sum } from '../utils.js';
import { money, parseAmt, short } from '../fmt.js';
import { KEYWORDS } from '../data.js';
import { icon } from '../icons.js';
import { stats, curKey } from '../insights.js';
import { actions, sheet, fSeg, fAmount, fChips, fSelect, fDate, fText, toast, empty, amt } from '../ui.js';

/* ---------- smart quick-add parser ("taksi 25 ming", "+maosh 5 mln") ---------- */
const MULT = { mlrd: 1e9, milliard: 1e9, mln: 1e6, million: 1e6, milyon: 1e6, m: 1e6, ming: 1e3, min: 1e3, k: 1e3, тыс: 1e3 };
export function parseQuick(input) {
  let s = String(input || '').trim();
  if (!s) return null;
  let type = 'expense';
  let forced = false;
  if (s.startsWith('+')) {
    type = 'income';
    forced = true;
    s = s.slice(1).trim();
  } else if (s.startsWith('-')) {
    s = s.slice(1).trim();
  }
  let prev;
  do {
    prev = s;
    s = s.replace(/(\d)[\s ](\d{3})(?!\d)/, '$1$2');
  } while (s !== prev);
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(mlrd|milliard|mln|million|milyon|ming|min|k|тыс|m)?(?![a-zA-Zа-я])/i);
  if (!m) return null;
  const amount = Math.round(parseFloat(m[1].replace(',', '.')) * (m[2] ? MULT[m[2].toLowerCase()] : 1));
  if (!amount) return null;
  const note = (s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
  let categoryId = null;
  for (const [id, re] of KEYWORDS) {
    if (re.test(note) || re.test(s)) {
      const isInc = id.startsWith('i_');
      if (forced && !isInc) continue;
      if (!forced && isInc) type = 'income';
      categoryId = id;
      break;
    }
  }
  if (!categoryId) categoryId = type === 'income' ? 'i_other' : 'c_other';
  const cap = note ? note.charAt(0).toUpperCase() + note.slice(1) : '';
  return { type, amount, categoryId, note: cap };
}
export const lastAccountId = () => sortedTx().find((t) => acctOf(t.accountId))?.accountId || state.accounts[0]?.id;

export function quickAdd(text) {
  const p = parseQuick(text);
  if (!p) {
    toast("Tushunmadim. Masalan: «taksi 25 ming» yoki «+maosh 5 mln»", { type: 'warn' });
    return false;
  }
  if (!state.accounts.length) {
    toast("Avval hisob qo'shing (Sozlamalar)", { type: 'warn' });
    return false;
  }
  const tx = addTx({ ...p, accountId: lastAccountId(), date: today() });
  const c = catOf(tx.categoryId);
  toast(`${c.icon} ${c.name}: ${tx.type === 'income' ? '+' : '−'}${money(tx.amount, { force: true })} qo'shildi`, {
    type: 'ok',
    action: { label: 'Bekor qilish', fn: () => delTx(tx.id) },
  });
  return true;
}

/* ---------- row ---------- */
export function txRow(t, { showDate = false } = {}) {
  if (t.type === 'transfer') {
    return `<button class="row" data-act="tx:edit" data-id="${t.id}"><span class="row-ico" style="--c:#60a5fa">🔄</span><span class="row-main"><b>${esc(t.note || "O'tkazma")}</b><small>${esc(acctOf(t.accountId)?.name || '?')} → ${esc(acctOf(t.toAccountId)?.name || '?')}${showDate ? ' · ' + relDay(t.date) : ''}</small></span><span class="amount muted">${money(t.amount)}</span></button>`;
  }
  const c = catOf(t.categoryId);
  const a = acctOf(t.accountId);
  const inc = t.type === 'income';
  return `<button class="row" data-act="tx:edit" data-id="${t.id}"><span class="row-ico" style="--c:${c.color}">${c.icon}</span><span class="row-main"><b>${esc(t.note || c.name)}</b><small>${esc(c.name)} · ${esc(a?.name || '?')}${showDate ? ' · ' + relDay(t.date) : ''}</small></span><span class="amount ${inc ? 'pos' : ''}">${money(inc ? t.amount : -t.amount, { sign: inc })}</span></button>`;
}

/* ---------- add / edit sheet ---------- */
export function openTxSheet(tx = null, preset = {}) {
  if (!state.accounts.length) return toast("Avval Sozlamalardan hisob qo'shing", { type: 'warn' });
  const t = tx || { type: preset.type || 'expense', amount: preset.amount || 0, categoryId: preset.categoryId, accountId: preset.accountId || lastAccountId(), toAccountId: '', date: preset.date || today(), note: preset.note || '' };
  const accOpts = state.accounts.map((a) => [a.id, `${a.icon} ${a.name} — ${money(balanceOf(a.id), { force: true })}`]);
  const body = `
    ${fSeg('type', [['expense', 'Xarajat', 'neg'], ['income', 'Daromad', 'pos'], ['transfer', "O'tkazma"]], t.type)}
    ${fAmount('Summa', 'amount', { value: t.amount, big: true, focus: !tx })}
    <div id="txcatwrap">${fChips('Kategoriya', 'categoryId', cats(t.type === 'income' ? 'income' : 'expense'), t.categoryId || cats(t.type === 'income' ? 'income' : 'expense')[0]?.id)}</div>
    <div class="grid-2">
      <div id="fromWrap">${fSelect(t.type === 'transfer' ? 'Qaysi hisobdan' : 'Hisob', 'accountId', accOpts, t.accountId)}</div>
      <div id="txto" ${t.type === 'transfer' ? '' : 'hidden'}>${fSelect('Qaysi hisobga', 'toAccountId', state.accounts.filter((a) => a.id !== t.accountId).map((a) => [a.id, `${a.icon} ${a.name}`]), t.toAccountId)}</div>
      ${fDate('Sana', 'date', t.date)}
    </div>
    ${fText('Izoh', 'note', { value: t.note, placeholder: 'Ixtiyoriy' })}`;
  sheet({
    title: tx ? 'Tranzaksiyani tahrirlash' : "Yangi tranzaksiya",
    body,
    submit: tx ? 'Saqlash' : "Qo'shish",
    danger: tx ? { label: "O'chirish", fn: () => (delTx(tx.id), toast("O'chirildi", { type: 'ok' })) } : null,
    onMount(form) {
      const wrap = form.querySelector('#txcatwrap');
      const refresh = () => {
        const type = form.type.value;
        const isT = type === 'transfer';
        wrap.hidden = isT;
        form.querySelector('#txto').hidden = !isT;
        form.querySelector('#fromWrap span').textContent = isT ? 'Qaysi hisobdan' : 'Hisob';
        if (!isT) {
          const list = cats(type === 'income' ? 'income' : 'expense');
          const sel = form.categoryId?.value;
          const keep = list.find((c) => c.id === sel)?.id || list[0]?.id;
          wrap.innerHTML = fChips('Kategoriya', 'categoryId', list, keep);
        }
        const from = form.accountId.value;
        const to = form.toAccountId;
        const cur = to.value;
        to.innerHTML = state.accounts.filter((a) => a.id !== from).map((a) => `<option value="${a.id}" ${a.id === cur ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('');
      };
      form.addEventListener('change', (e) => {
        if (e.target.name === 'type' || e.target.name === 'accountId') refresh();
      });
      refresh();
    },
    onSubmit(d) {
      const amount = amt(d.amount);
      if (!(amount > 0)) return toast('Summani kiriting', { type: 'warn' }), false;
      const isT = d.type === 'transfer';
      if (isT && (!d.toAccountId || d.toAccountId === d.accountId)) return toast("Ikki xil hisobni tanlang", { type: 'warn' }), false;
      const data = { type: d.type, amount, accountId: d.accountId, date: d.date || today(), note: d.note.trim(), categoryId: isT ? null : d.categoryId, toAccountId: isT ? d.toAccountId : null };
      if (tx) updateTx(tx.id, data);
      else addTx(data);
      toast(tx ? 'Saqlandi' : "Qo'shildi", { type: 'ok' });
    },
  });
}
actions['tx:new'] = (el) => openTxSheet(null, { type: el.dataset.type });
actions['tx:edit'] = (el) => openTxSheet(state.transactions.find((t) => t.id === el.dataset.id));

/* ---------- page ---------- */
const ui = { month: null, type: 'all', q: '', cat: 'all' };
export function setTxFilter(f) {
  Object.assign(ui, f);
}

function filtered() {
  const q = ui.q.trim().toLowerCase();
  return sortedTx().filter((t) => {
    if (t.date.slice(0, 7) !== ui.month) return false;
    if (ui.type !== 'all' && t.type !== ui.type) return false;
    if (ui.cat !== 'all' && t.categoryId !== ui.cat) return false;
    if (q) {
      const hay = `${t.note} ${t.type === 'transfer' ? "o'tkazma" : catOf(t.categoryId).name} ${acctOf(t.accountId)?.name || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function listHtml() {
  const list = filtered();
  if (!list.length) return empty('🧾', "Tranzaksiya topilmadi", ui.q || ui.type !== 'all' || ui.cat !== 'all' ? "Filtrlarni o'zgartirib ko'ring" : "Bu oyda hali yozuv yo'q. «+» tugmasi bilan qo'shing.");
  const groups = new Map();
  list.forEach((t) => groups.set(t.date, [...(groups.get(t.date) || []), t]));
  let html = '';
  for (const [date, items] of groups) {
    const net = sum(items, (t) => (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0));
    html += `<div class="day"><div class="day-h"><span>${relDay(date)}</span><span class="${net >= 0 ? 'pos' : 'muted'}">${money(net, { sign: true })}</span></div><div class="rows">${items.map((t) => txRow(t)).join('')}</div></div>`;
  }
  return html;
}

export function renderTransactions() {
  if (!ui.month) ui.month = curKey();
  const st = stats(ui.month);
  const all = [...cats('expense'), ...cats('income')];
  const isCur = ui.month === curKey();
  return `
  <div class="page-head"><div><h1>Tranzaksiyalar</h1><p class="sub">Barcha daromad va xarajatlaringiz</p></div>
    <button class="btn primary" data-act="tx:new">${icon('plus', 18)} <span class="hide-m">Qo'shish</span></button></div>
  <div class="month-nav card">
    <button class="icon-btn" data-act="tx:prev" aria-label="Oldingi oy">${icon('chevL', 20)}</button>
    <div class="mn-c"><b>${monthLabel(ui.month)}</b><div class="mn-sum"><span class="pos">+${short(st.income)}</span><span class="neg">−${short(st.expense)}</span><span class="${st.net >= 0 ? 'pos' : 'neg'}">= ${short(st.net)}</span></div></div>
    <button class="icon-btn" data-act="tx:next" aria-label="Keyingi oy" ${isCur ? 'disabled' : ''}>${icon('chevR', 20)}</button>
  </div>
  <div class="filters">
    <div class="search">${icon('search', 18)}<input id="txq" class="input" placeholder="Qidirish..." value="${esc(ui.q)}"></div>
    <div class="seg sm" id="txtype">${[['all', 'Hammasi'], ['expense', 'Xarajat'], ['income', 'Daromad'], ['transfer', "O'tkazma"]].map(([v, l]) => `<label><input type="radio" name="ftype" value="${v}" ${ui.type === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    <select id="txcat" class="input sm"><option value="all">Barcha kategoriyalar</option>${all.map((c) => `<option value="${c.id}" ${ui.cat === c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select>
  </div>
  <div id="txlist">${listHtml()}</div>`;
}
export function afterTransactions(root, rerender) {
  const q = root.querySelector('#txq');
  q?.addEventListener('input', () => {
    ui.q = q.value;
    root.querySelector('#txlist').innerHTML = listHtml();
  });
  root.querySelector('#txtype')?.addEventListener('change', (e) => {
    ui.type = e.target.value;
    root.querySelector('#txlist').innerHTML = listHtml();
  });
  root.querySelector('#txcat')?.addEventListener('change', (e) => {
    ui.cat = e.target.value;
    root.querySelector('#txlist').innerHTML = listHtml();
  });
}
actions['tx:prev'] = () => ((ui.month = addMonths(ui.month || curKey(), -1)), actions._render());
actions['tx:next'] = () => {
  if ((ui.month || curKey()) < curKey()) ui.month = addMonths(ui.month, 1);
  actions._render();
};
