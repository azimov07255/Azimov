import { state, commit } from '../store.js';
import { esc, uid, today, monthKey, addMonths, monthLabel, monthShort, fmtDate, sum, avg } from '../utils.js';
import { money, short, pct } from '../fmt.js';
import { icon } from '../icons.js';
import { businessReadiness, curKey } from '../insights.js';
import { bars } from '../charts.js';
import { actions, sheet, fText, fAmount, fDate, fEmoji, fColor, fSeg, progress, card, empty, toast, amt } from '../ui.js';
import { COLORS } from '../data.js';

/* ---------- math ---------- */
const fixedTotal = (b) => sum(b.fixed || [], (f) => f.amount);
export function bizMonth(b, key) {
  let inc = 0;
  let varExp = 0;
  for (const e of b.entries || []) {
    if (e.date.slice(0, 7) !== key) continue;
    if (e.type === 'income') inc += e.amount;
    else varExp += e.amount;
  }
  const started = key >= monthKey(b.startDate || today()) && key <= curKey();
  const fixed = started ? fixedTotal(b) : 0;
  const exp = varExp + fixed;
  return { key, inc, varExp, fixed, exp, profit: inc - exp, margin: inc > 0 ? (inc - exp) / inc : null };
}
function bizMonths(b) {
  const out = [];
  let k = monthKey(b.startDate || today());
  const end = curKey();
  let guard = 0;
  while (k <= end && guard++ < 240) {
    out.push(bizMonth(b, k));
    k = addMonths(k, 1);
  }
  return out;
}
export function bizSummary(b) {
  const ms = bizMonths(b);
  const total = sum(ms, (m) => m.profit);
  const recent = ms.slice(-3).filter((m) => m.inc > 0 || m.varExp > 0);
  const avgProfit = recent.length ? avg(recent.map((m) => m.profit)) : 0;
  const cap = b.capital || 0;
  const recovered = total;
  const remaining = Math.max(0, cap - recovered);
  const payback = remaining <= 0 ? 0 : avgProfit > 0 ? Math.ceil(remaining / avgProfit) : null;
  // break-even revenue using recent variable-cost ratio
  const rev = sum(recent, (m) => m.inc);
  const vr = rev > 0 ? sum(recent, (m) => m.varExp) / rev : 0;
  const be = vr < 1 ? fixedTotal(b) / (1 - vr) : null;
  return { ms, total, avgProfit, cap, recovered, remaining, payback, vr, be };
}

/* ---------- list page ---------- */
export function renderBusiness() {
  const key = curKey();
  const r = businessReadiness();
  const ready = `
  <section class="card ready">
    <div class="card-h"><h3>${icon('briefcase', 18)} Biznesga tayyormisiz?</h3><span class="pill ${r.done >= 4 ? 'pos' : r.done >= 2 ? 'warn' : 'neg'}">${r.done}/${r.items.length}</span></div>
    ${progress(r.done / r.items.length, { h: 10 })}
    <ul class="checklist">${r.items.map((i) => `<li class="${i.ok ? 'ok' : ''}"><span class="chk">${i.ok ? icon('check', 14) : ''}</span><div><b>${esc(i.title)}</b><small class="muted">${esc(i.note)}</small></div></li>`).join('')}</ul>
    <p class="muted small">${r.done >= 4 ? "Ajoyib! Moliyaviy poydevor tayyor — g'oyani sinovdan o'tkazing 🚀" : "Biznes boshlashdan oldin bu 5 poydevorni mustahkamlang — shunda xavf kamayadi."}</p>
  </section>`;

  const list = state.businesses.map((b) => {
    const m = bizMonth(b, key);
    const s = bizSummary(b);
    return `<a class="biz" href="#/business/${b.id}" style="--c:${b.color}">
      <div class="biz-h"><span class="biz-ico">${b.icon}</span><div><b>${esc(b.name)}</b><small class="muted">${fmtDate(b.startDate, true)} dan</small></div></div>
      <div class="biz-k"><div><small>Daromad</small><b>${money(m.inc)}</b></div><div><small>Foyda</small><b class="${m.profit >= 0 ? 'pos' : 'neg'}">${money(m.profit, { sign: true })}</b></div></div>
      ${b.capital ? `<div class="biz-p">${progress(Math.max(0, s.recovered) / b.capital, { color: b.color, h: 6 })}<small class="muted">Kapital qaytishi: ${pct(Math.max(0, Math.min(1, s.recovered / b.capital)))}${s.payback ? ` · ~${s.payback} oy qoldi` : ''}</small></div>` : ''}
    </a>`;
  }).join('');

  return `
  <div class="page-head"><div><h1>Biznes</h1><p class="sub">Daromad, xarajat, foyda va kapital qaytishi</p></div><button class="btn primary" data-act="biz:new">${icon('plus', 18)} <span class="hide-m">Yangi biznes</span></button></div>
  <div class="grid"><div class="c6">${ready}</div>
  <div class="c6">${state.businesses.length ? `<div class="biz-list">${list}</div>` : empty('🏪', "Hali biznes yo'q", "Kichik daromad manbaingiz yoki kelajakdagi loyihangizni qo'shing: kiosk, onlayn do'kon, xizmat... Foyda va kapital qaytishini avtomatik hisoblayman.", `<button class="btn primary" data-act="biz:new">${icon('plus', 16)} Biznes qo'shish</button>`)}</div></div>`;
}

/* ---------- detail ---------- */
export function renderBusinessDetail(id) {
  const b = state.businesses.find((x) => x.id === id);
  if (!b) return `<div class="page-head"><h1>Topilmadi</h1></div><a class="btn ghost" href="#/business">← Orqaga</a>`;
  const key = curKey();
  const m = bizMonth(b, key);
  const s = bizSummary(b);
  const last6 = Array.from({ length: 6 }, (_, i) => addMonths(key, -(5 - i))).map((k) => bizMonth(b, k));
  const entries = [...b.entries].sort((a, c) => (a.date === c.date ? c.ts - a.ts : a.date < c.date ? 1 : -1)).slice(0, 25);
  const beP = s.be ? Math.min(1, m.inc / s.be) : 0;

  return `
  <div class="page-head"><div class="back-row"><a class="icon-btn" href="#/business" aria-label="Orqaga">${icon('chevL', 20)}</a><div><h1>${b.icon} ${esc(b.name)}</h1><p class="sub">${monthLabel(key)} · boshlangan ${fmtDate(b.startDate, true)}</p></div></div>
    <button class="btn ghost" data-act="biz:edit" data-id="${b.id}">${icon('edit', 16)} <span class="hide-m">Tahrirlash</span></button></div>
  <div class="bizbar"><button class="btn primary" data-act="biz:entry" data-id="${b.id}" data-type="income">${icon('arrowDown', 16)} Daromad</button><button class="btn danger-ghost" data-act="biz:entry" data-id="${b.id}" data-type="expense">${icon('arrowUp', 16)} Xarajat</button><button class="btn ghost" data-act="biz:fixed" data-id="${b.id}">${icon('repeat', 16)} Doimiy xarajatlar</button></div>
  <div class="grid">
    <div class="c3 card stat-card"><span class="eyebrow">Daromad</span><b class="big pos">${money(m.inc)}</b><small class="muted">Bu oy</small></div>
    <div class="c3 card stat-card"><span class="eyebrow">Xarajat</span><b class="big neg">${money(m.exp)}</b><small class="muted">Shundan doimiy: ${money(m.fixed)}</small></div>
    <div class="c3 card stat-card"><span class="eyebrow">Sof foyda</span><b class="big ${m.profit >= 0 ? 'pos' : 'neg'}">${money(m.profit, { sign: true })}</b><small class="muted">${m.margin === null ? 'Daromad yo\'q' : `Marja ${pct(m.margin)}`}</small></div>
    <div class="c3 card stat-card"><span class="eyebrow">Jami foyda</span><b class="big ${s.total >= 0 ? 'pos' : 'neg'}">${money(s.total, { sign: true })}</b><small class="muted">Boshlanganidan beri</small></div>
    ${card(`${icon('trending', 18)} Oxirgi 6 oy`, `<div class="chart-wrap">${bars(last6.map((x) => ({ label: monthShort(x.key), a: x.inc, b: x.exp })), { height: 190 })}</div><div class="legend-inline"><span><i style="background:var(--pos)"></i>Daromad</span><span><i style="background:var(--neg)"></i>Xarajat</span></div>`, { cls: 'c6' })}
    <div class="c6 stack">
      ${card(`${icon('shield', 18)} Kapital qaytishi`, b.capital ? `<div class="split"><b>${money(Math.max(0, s.recovered))}</b><span class="muted">/ ${money(b.capital)}</span></div>${progress(Math.max(0, s.recovered) / b.capital, { color: b.color, h: 10 })}<p class="muted small">${s.remaining <= 0 ? '🎉 Investitsiya to\'liq qaytgan!' : s.payback ? `Oxirgi oylar foydasi (${money(s.avgProfit)}/oy) bilan taxminan <b>${s.payback} oyda</b> qaytadi.` : "Hozircha oylik foyda musbat emas — xarajatlarni kamaytiring yoki narxni oshiring."}</p>` : `<p class="muted">Boshlang'ich kapitalni kiritsangiz, qaytish muddati hisoblanadi.</p><button class="btn ghost sm" data-act="biz:edit" data-id="${b.id}">Kapital kiritish</button>`)}
      ${card(`${icon('target', 18)} Zararsizlik nuqtasi`, s.be && fixedTotal(b) > 0 ? `<div class="split"><b>${money(s.be)}</b><span class="muted">oylik daromad kerak</span></div>${progress(beP, { color: beP >= 1 ? 'var(--pos)' : 'var(--warn)', h: 10 })}<p class="muted small">Doimiy xarajat ${money(fixedTotal(b))}, o'zgaruvchan xarajat ulushi ${pct(s.vr)}. ${m.inc >= s.be ? "Bu oy zararsizlik nuqtasidan o'tdingiz ✅" : `Yana ${money(s.be - m.inc)} daromad kerak.`}</p>` : `<p class="muted">«Doimiy xarajatlar» (ijara, maosh, internet) ni kiriting — zararsizlik nuqtasini hisoblayman.</p>`)}
    </div>
  </div>
  ${card('Yozuvlar', entries.length ? `<div class="rows">${entries.map((e) => `<button class="row" data-act="biz:entry-edit" data-id="${b.id}" data-eid="${e.id}"><span class="row-ico" style="--c:${e.type === 'income' ? '#34d399' : '#fb7185'}">${e.type === 'income' ? '💰' : '🧾'}</span><span class="row-main"><b>${esc(e.note || (e.type === 'income' ? 'Daromad' : 'Xarajat'))}</b><small>${fmtDate(e.date)}</small></span><span class="amount ${e.type === 'income' ? 'pos' : ''}">${money(e.type === 'income' ? e.amount : -e.amount, { sign: e.type === 'income' })}</span></button>`).join('')}</div>` : empty('📒', "Yozuv yo'q", "Birinchi sotuv yoki xarajatni yozing."))}`;
}

/* ---------- sheets ---------- */
function bizSheet(b = null) {
  const v = b || { name: '', icon: '🏪', color: COLORS[state.businesses.length % COLORS.length], capital: 0, startDate: today() };
  sheet({
    title: b ? 'Biznesni tahrirlash' : 'Yangi biznes',
    body: `${fText('Nomi', 'name', { value: v.name, placeholder: 'Masalan: Kofe kiosk', focus: !b })}
      ${fAmount("Boshlang'ich kapital", 'capital', { value: v.capital, big: true })}
      ${fDate('Boshlangan sana', 'startDate', v.startDate)}
      ${fEmoji('icon', v.icon, ['🏪', '☕', '🍔', '🛒', '💻', '📦', '🚚', '✂️', '🎨', '🏗️', '🌾', '🐄', '👗', '📱', '🚀', '🛠️'])}
      ${fColor('color', v.color)}`,
    danger: b ? { label: "O'chirish", confirm: "Biznes va uning barcha yozuvlari o'chadi. Davom etasizmi?", fn: () => ((state.businesses = state.businesses.filter((x) => x.id !== b.id)), commit(), (location.hash = '#/business')) } : null,
    onSubmit(d) {
      if (!d.name.trim()) return toast('Nomini kiriting', { type: 'warn' }), false;
      const data = { name: d.name.trim(), capital: amt(d.capital), startDate: d.startDate, icon: d.icon, color: d.color };
      if (b) Object.assign(b, data);
      else {
        const nb = { id: uid(), entries: [], fixed: [], ...data };
        state.businesses.push(nb);
        setTimeout(() => (location.hash = '#/business/' + nb.id), 50);
      }
      commit();
    },
  });
}
actions['biz:new'] = () => bizSheet();
actions['biz:edit'] = (el) => bizSheet(state.businesses.find((x) => x.id === el.dataset.id));

function entrySheet(b, e = null, type = 'income') {
  const v = e || { type, amount: 0, date: today(), note: '' };
  sheet({
    title: e ? 'Yozuvni tahrirlash' : v.type === 'income' ? 'Biznes daromadi' : 'Biznes xarajati',
    body: `${fSeg('type', [['income', 'Daromad', 'pos'], ['expense', 'Xarajat', 'neg']], v.type)}${fAmount('Summa', 'amount', { value: v.amount, big: true, focus: true })}${fDate('Sana', 'date', v.date)}${fText('Izoh', 'note', { value: v.note, placeholder: v.type === 'income' ? 'Masalan: 30 ta kofe' : 'Masalan: Xom ashyo' })}`,
    danger: e ? { label: "O'chirish", fn: () => ((b.entries = b.entries.filter((x) => x.id !== e.id)), commit(), toast("O'chirildi", { type: 'ok' })) } : null,
    onSubmit(d) {
      const a = amt(d.amount);
      if (!(a > 0)) return toast('Summani kiriting', { type: 'warn' }), false;
      const data = { type: d.type, amount: a, date: d.date, note: d.note.trim() };
      if (e) Object.assign(e, data);
      else b.entries.push({ id: uid(), ts: Date.now(), ...data });
      commit();
      toast('Saqlandi', { type: 'ok' });
    },
  });
}
actions['biz:entry'] = (el) => entrySheet(state.businesses.find((x) => x.id === el.dataset.id), null, el.dataset.type);
actions['biz:entry-edit'] = (el) => {
  const b = state.businesses.find((x) => x.id === el.dataset.id);
  entrySheet(b, b.entries.find((x) => x.id === el.dataset.eid));
};
actions['biz:fixed'] = (el) => {
  const b = state.businesses.find((x) => x.id === el.dataset.id);
  const rows = [...(b.fixed || [])];
  while (rows.length < Math.max(5, rows.length + 1)) rows.push({ name: '', amount: 0 });
  sheet({
    title: 'Doimiy oylik xarajatlar',
    body: `<p class="muted small">Ijara, ish haqi, internet, soliq — savdo bo'lmasa ham har oy to'lanadigan xarajatlar.</p>
    <div class="fixed-rows">${rows.map((r, i) => `<div class="fx"><input class="input" name="n${i}" value="${esc(r.name)}" placeholder="Nomi"><input class="input amt" inputmode="numeric" name="a${i}" value="${r.amount ? Math.round(r.amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''}" placeholder="0"></div>`).join('')}</div><input type="hidden" name="count" value="${rows.length}">`,
    onSubmit(d) {
      const out = [];
      for (let i = 0; i < Number(d.count); i++) {
        const a = amt(d['a' + i]);
        if (d['n' + i]?.trim() && a > 0) out.push({ id: uid(), name: d['n' + i].trim(), amount: a });
      }
      b.fixed = out;
      commit();
      toast('Saqlandi', { type: 'ok' });
    },
  });
};
