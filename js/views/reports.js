import { state, save, catOf, cats, totalBalance, iOwe, owedToMe, subsMonthly } from '../store.js';
import { esc, addMonths, monthLabel, monthShort, daysInMonth, parseYmd, WEEKDAYS, MONTHS, fmtDate, sum, today, avg } from '../utils.js';
import { money, short, pct } from '../fmt.js';
import { icon } from '../icons.js';
import { stats, curKey, monthsBack, baseline } from '../insights.js';
import { bars, donut } from '../charts.js';
import { actions, card, progress, empty } from '../ui.js';
import { bizMonth } from './business.js';

/* ---------- helpers ---------- */
const delta = (cur, prev, invert = false) => {
  if (!prev) return '';
  const d = (cur - prev) / Math.abs(prev);
  const good = invert ? d <= 0 : d >= 0;
  return `<span class="delta ${good ? 'good' : 'bad'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(d * 100))}%</span>`;
};
const kpi = (label, val, extra = '', cls = '') => `<div class="kpi"><span>${label}</span><b class="${cls}">${val}</b><small>${extra}</small></div>`;

function monthModel(key) {
  const st = stats(key);
  const prev = stats(addMonths(key, -1));
  const dim = daysInMonth(key);
  const txs = state.transactions.filter((t) => t.date.slice(0, 7) === key && t.type !== 'transfer');
  const days = Array.from({ length: dim }, (_, i) => 0);
  txs.filter((t) => t.type === 'expense').forEach((t) => (days[Number(t.date.slice(8)) - 1] += t.amount));
  const wk = Array(7).fill(0);
  const wkN = Array(7).fill(0);
  days.forEach((v, i) => {
    const w = parseYmd(`${key}-${String(i + 1).padStart(2, '0')}`).getDay();
    wk[w] += v;
    wkN[w]++;
  });
  const cat = Object.entries(st.byCat)
    .map(([id, v]) => ({ id, v, prev: prev.byCat[id] || 0, budget: state.budgets[id] || 0 }))
    .sort((a, b) => b.v - a.v);
  const top = txs.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 8);
  return { key, st, prev, dim, days, wk: wk.map((v, i) => v / (wkN[i] || 1)), cat, top };
}

function narrative(m) {
  const { st, prev, cat, days, key } = m;
  const L = [];
  const name = monthLabel(key);
  L.push(`${name} oyida jami <b>${money(st.income)}</b> daromad olindi va <b>${money(st.expense)}</b> sarflandi. Sof natija: <b class="${st.net >= 0 ? 'pos' : 'neg'}">${money(st.net, { sign: true })}</b>${st.rate !== null ? ` (jamg'arma darajasi <b>${pct(st.rate)}</b>)` : ''}.`);
  if (prev.expense > 0) {
    const d = (st.expense - prev.expense) / prev.expense;
    L.push(`Xarajatlar o'tgan oyga nisbatan <b>${Math.abs(Math.round(d * 100))}% ${d >= 0 ? "ko'p" : 'kam'}</b> (${money(prev.expense)}).`);
  }
  if (cat[0]) L.push(`Eng katta xarajat kategoriyasi — <b>${esc(catOf(cat[0].id).icon + ' ' + catOf(cat[0].id).name)}</b>: ${money(cat[0].v)} (${pct(cat[0].v / st.expense)}).`);
  const mx = Math.max(...days);
  if (mx > 0) L.push(`Eng qimmat kun — <b>${fmtDate(`${key}-${String(days.indexOf(mx) + 1).padStart(2, '0')}`)}</b> (${money(mx)}). Kunlik o'rtacha: ${money(st.expense / (key === curKey() ? Number(today().slice(8)) : m.dim))}.`);
  const over = cat.filter((c) => c.budget > 0 && c.v > c.budget);
  if (Object.keys(state.budgets).length) L.push(over.length ? `Byudjet: <b>${over.length} ta</b> kategoriyada limit oshgan — ${over.slice(0, 3).map((c) => esc(catOf(c.id).name)).join(', ')}.` : `Byudjet: barcha limitli kategoriyalar me'yorda ✅`);
  return L;
}
function advice(m) {
  const { st, cat } = m;
  const out = [];
  const want = cat.filter((c) => catOf(c.id).grp === 'want')[0];
  if (want) out.push(`${catOf(want.id).icon} <b>${esc(catOf(want.id).name)}</b> xarajatini 20% qisqartirsangiz, oyiga <b>${money(want.v * 0.2)}</b>, yiliga <b>${money(want.v * 2.4)}</b> tejaladi.`);
  if (st.income > 0 && st.rate < 0.2) out.push(`Jamg'arma darajasini 20% ga yetkazish uchun oyiga yana <b>${money(Math.max(0, st.income * 0.2 - st.net))}</b> tejash kerak.`);
  if (st.rate >= 0.2) out.push(`Jamg'arma darajangiz a'lo. Ortiqcha mablag'ni <b>maqsad yoki biznes kapitaliga</b> yo'naltiring.`);
  const sm = subsMonthly();
  if (sm > 0) out.push(`Takroriy to'lovlar oyiga <b>${money(sm)}</b> (yiliga ${money(sm * 12)}) — keraksizlarini ko'rib chiqing.`);
  return out;
}

/* ---------- month report ---------- */
function renderMonth(key) {
  const m = monthModel(key);
  const { st, prev } = m;
  if (st.count === 0) return empty('📊', "Bu oy uchun ma'lumot yo'q", "Tranzaksiya qo'shilgandan keyin hisobot avtomatik tuziladi.");
  const dayBars = m.days.map((v, i) => ({ label: (i + 1) % 5 === 0 || i === 0 ? String(i + 1) : '', a: v }));
  const wkBars = [1, 2, 3, 4, 5, 6, 0].map((w) => ({ label: WEEKDAYS[w].slice(0, 3), a: m.wk[w] }));
  const total = st.expense || 1;
  const donutItems = m.cat.slice(0, 6).map((c) => ({ label: catOf(c.id).name, value: c.v, color: catOf(c.id).color }));
  const income = Object.entries(st.incByCat).sort((a, b) => b[1] - a[1]);
  const biz = state.businesses.map((b) => ({ b, m: bizMonth(b, key) })).filter((x) => x.m.inc > 0 || x.m.exp > 0);

  return `
  <div class="grid rep-kpis">
    <div class="c3 card">${kpi('Daromad', money(st.income), delta(st.income, prev.income), 'pos')}</div>
    <div class="c3 card">${kpi('Xarajat', money(st.expense), delta(st.expense, prev.expense, true), 'neg')}</div>
    <div class="c3 card">${kpi('Sof natija', money(st.net, { sign: true }), delta(st.net, prev.net), st.net >= 0 ? 'pos' : 'neg')}</div>
    <div class="c3 card">${kpi("Jamg'arma darajasi", st.rate === null ? '—' : pct(st.rate), st.rate === null ? '' : st.rate >= 0.2 ? 'Maqsad: 20% ✅' : 'Maqsad: 20%')}</div>
  </div>
  <div class="grid">
    ${card(`${icon('sparkles', 18)} Oy xulosasi`, `<ul class="narr">${narrative(m).map((l) => `<li>${l}</li>`).join('')}</ul>${advice(m).length ? `<h4 class="sub-h">Tavsiyalar</h4><ul class="narr tips">${advice(m).map((l) => `<li>${l}</li>`).join('')}</ul>` : ''}`, { cls: 'c6' })}
    ${card(`${icon('pie', 18)} Xarajat tuzilmasi`, `<div class="donut-wrap">${donut(donutItems, { size: 150, center: `<small>Jami</small><b>${short(st.expense)}</b>` })}<ul class="legend">${donutItems.map((x) => `<li><i style="background:${x.color}"></i><span>${esc(x.label)}</span><b>${pct(x.value / total)}</b></li>`).join('')}</ul></div>`, { cls: 'c6' })}
    ${card(`${icon('trending', 18)} Kunlik xarajat`, `<div class="chart-wrap">${bars(dayBars, { height: 170, single: true, aColor: 'var(--accent)' })}</div>`, { cls: 'c12 wide' })}
  </div>
  ${card('Kategoriyalar bo\'yicha', `<div class="rep-cats">${m.cat.map((c) => {
    const cc = catOf(c.id);
    const d = c.prev ? (c.v - c.prev) / c.prev : null;
    const over = c.budget && c.v > c.budget;
    return `<div class="rc"><span class="row-ico" style="--c:${cc.color}">${cc.icon}</span><div class="rc-m"><div class="split"><b>${esc(cc.name)}</b><span><b>${money(c.v)}</b> <small class="muted">${pct(c.v / total)}</small></span></div>${progress(c.v / m.cat[0].v, { color: over ? 'var(--neg)' : cc.color, h: 6 })}<small class="muted">${d === null ? "O'tgan oy: —" : `O'tgan oy ${money(c.prev)} · <span class="${d > 0 ? 'neg' : 'pos'}">${d > 0 ? '▲' : '▼'} ${Math.abs(Math.round(d * 100))}%</span>`}${c.budget ? ` · limit ${short(c.budget)}${over ? ' <b class="neg">oshdi</b>' : ''}` : ''}</small></div></div>`;
  }).join('')}</div>`, { cls: 'brk' })}
  <div class="grid">
    ${card('Eng katta xarajatlar', `<div class="rows">${m.top.map((t) => `<div class="row static"><span class="row-ico" style="--c:${catOf(t.categoryId).color}">${catOf(t.categoryId).icon}</span><span class="row-main"><b>${esc(t.note || catOf(t.categoryId).name)}</b><small>${fmtDate(t.date)} · ${esc(catOf(t.categoryId).name)}</small></span><span class="amount">${money(t.amount)}</span></div>`).join('')}</div>`, { cls: 'c6' })}
    ${card('Daromad manbalari', income.length ? `<div class="rows">${income.map(([id, v]) => `<div class="row static"><span class="row-ico" style="--c:${catOf(id).color}">${catOf(id).icon}</span><span class="row-main"><b>${esc(catOf(id).name)}</b><small>${pct(v / st.income)}</small></span><span class="amount pos">${money(v)}</span></div>`).join('')}</div>` : '<p class="muted">Daromad yozilmagan</p>', { cls: 'c6' })}
    ${card(`${icon('clock', 18)} Hafta kunlari bo'yicha o'rtacha`, `<div class="chart-wrap">${bars(wkBars, { height: 160, single: true, aColor: 'var(--info)' })}</div>`, { cls: 'c6' })}
    ${biz.length ? card(`${icon('briefcase', 18)} Bizneslar`, `<div class="rows">${biz.map(({ b, m: x }) => `<div class="row static"><span class="row-ico" style="--c:${b.color}">${b.icon}</span><span class="row-main"><b>${esc(b.name)}</b><small>Daromad ${money(x.inc)} · xarajat ${money(x.exp)}</small></span><span class="amount ${x.profit >= 0 ? 'pos' : 'neg'}">${money(x.profit, { sign: true })}</span></div>`).join('')}</div>`, { cls: 'c6' }) : ''}
    ${card(`${icon('target', 18)} Hozirgi holat`, `<div class="calc-rows"><div class="cr"><span>Umumiy balans</span><b>${money(totalBalance())}</b></div><div class="cr"><span>Men qarzdorman</span><b class="neg">${money(iOwe())}</b></div><div class="cr"><span>Menga qarzdor</span><b class="pos">${money(owedToMe())}</b></div>${state.goals.map((g) => `<div class="cr"><span>${g.icon} ${esc(g.name)}</span><b>${pct(Math.min(1, (g.saved || 0) / g.target))}</b></div>`).join('')}</div>`, { cls: 'c6' })}
  </div>`;
}

/* ---------- year report ---------- */
function renderYear(year) {
  const keys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const ms = keys.map((k) => stats(k));
  const active = ms.filter((s) => s.count > 0);
  if (!active.length) return empty('📊', `${year}-yil uchun ma'lumot yo'q`, "Tranzaksiya qo'shilgandan keyin yillik hisobot tuziladi.");
  const inc = sum(ms, (s) => s.income);
  const exp = sum(ms, (s) => s.expense);
  const net = inc - exp;
  const byCat = {};
  ms.forEach((s) => Object.entries(s.byCat).forEach(([id, v]) => (byCat[id] = (byCat[id] || 0) + v)));
  const catList = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const best = [...active].sort((a, b) => b.net - a.net)[0];
  const worst = [...active].sort((a, b) => a.net - b.net)[0];
  return `
  <div class="grid rep-kpis">
    <div class="c3 card">${kpi('Yillik daromad', money(inc), `Oyiga o'rtacha ${short(inc / active.length)}`, 'pos')}</div>
    <div class="c3 card">${kpi('Yillik xarajat', money(exp), `Oyiga o'rtacha ${short(exp / active.length)}`, 'neg')}</div>
    <div class="c3 card">${kpi('Sof natija', money(net, { sign: true }), '', net >= 0 ? 'pos' : 'neg')}</div>
    <div class="c3 card">${kpi("Jamg'arma darajasi", inc > 0 ? pct(net / inc) : '—', inc > 0 && net / inc >= 0.2 ? 'Maqsad: 20% ✅' : 'Maqsad: 20%')}</div>
  </div>
  <div class="grid">
    ${card(`${icon('trending', 18)} 12 oylik dinamika`, `<div class="chart-wrap">${bars(keys.map((k, i) => ({ label: monthShort(k), a: ms[i].income, b: ms[i].expense })), { height: 200 })}</div><div class="legend-inline"><span><i style="background:var(--pos)"></i>Daromad</span><span><i style="background:var(--neg)"></i>Xarajat</span></div>`, { cls: 'c8' })}
    ${card(`${icon('sparkles', 18)} Xulosa`, `<ul class="narr"><li>Eng yaxshi oy: <b>${MONTHS[Number(best.key.slice(5)) - 1]}</b> (${money(best.net, { sign: true })}).</li><li>Eng zaif oy: <b>${MONTHS[Number(worst.key.slice(5)) - 1]}</b> (${money(worst.net, { sign: true })}).</li>${catList[0] ? `<li>Eng ko'p sarflangan: <b>${esc(catOf(catList[0][0]).icon + ' ' + catOf(catList[0][0]).name)}</b> — ${money(catList[0][1])}.</li>` : ''}<li>Shu sur'atda yil oxirigacha jamg'arma: <b>${money((net / active.length) * 12, { sign: true })}</b>.</li></ul>`, { cls: 'c4' })}
  </div>
  ${card('Oylar bo\'yicha', `<div class="rep-table"><div class="rt h"><span>Oy</span><span>Daromad</span><span>Xarajat</span><span>Sof</span><span>%</span></div>${ms.map((s, i) => (s.count ? `<div class="rt"><span>${MONTHS[i]}</span><span>${short(s.income)}</span><span>${short(s.expense)}</span><span class="${s.net >= 0 ? 'pos' : 'neg'}">${short(s.net)}</span><span>${s.rate === null ? '—' : pct(s.rate)}</span></div>` : '')).join('')}</div>`, { cls: 'brk' })}
  ${card('Yil davomida kategoriyalar', `<div class="rep-cats">${catList.slice(0, 10).map(([id, v]) => `<div class="rc"><span class="row-ico" style="--c:${catOf(id).color}">${catOf(id).icon}</span><div class="rc-m"><div class="split"><b>${esc(catOf(id).name)}</b><span><b>${money(v)}</b> <small class="muted">${pct(v / exp)}</small></span></div>${progress(v / catList[0][1], { color: catOf(id).color, h: 6 })}</div></div>`).join('')}</div>`)}`;
}

/* ---------- page ---------- */
export function renderReports(param) {
  const cur = curKey();
  const isYear = /^\d{4}$/.test(param || '');
  const key = !isYear && /^\d{4}-\d{2}$/.test(param || '') ? param : isYear ? param : addMonths(cur, -(stats(cur).count === 0 ? 1 : 0));
  if (!isYear && state.settings.reportSeen !== key) {
    state.settings.reportSeen = key; // hides the dashboard "report ready" banner; plain save, no re-render
    save();
  }
  const title = isYear ? `${key}-yil hisoboti` : `${monthLabel(key)} hisoboti`;
  const prevHref = isYear ? `#/reports/${Number(key) - 1}` : `#/reports/${addMonths(key, -1)}`;
  const nextHref = isYear ? `#/reports/${Number(key) + 1}` : `#/reports/${addMonths(key, 1)}`;
  const canNext = isYear ? Number(key) < Number(cur.slice(0, 4)) : key < cur;
  return `
  <div class="print-head"><div class="brand"><span class="logo"></span><b>Azimov</b></div><div class="ph-r"><b>${esc(title)}</b><small>${esc(state.settings.name || '')} · ${new Date().toLocaleDateString('uz-UZ')}</small></div></div>
  <div class="page-head no-print"><div><h1>Hisobotlar</h1><p class="sub">Oylik va yillik tahlil · PDF sifatida saqlash mumkin</p></div>
    <button class="btn primary" data-act="rep:print" data-key="${key}">${icon('printer', 18)} <span class="hide-m">PDF</span></button></div>
  <div class="month-nav card no-print">
    <a class="icon-btn" href="${prevHref}" aria-label="Oldingi">${icon('chevL', 20)}</a>
    <div class="mn-c"><b>${isYear ? key + '-yil' : monthLabel(key)}</b>
      <div class="mn-sum"><a class="${!isYear ? 'on' : ''}" href="#/reports/${isYear ? cur : key}">Oylik</a><a class="${isYear ? 'on' : ''}" href="#/reports/${key.slice(0, 4)}">Yillik</a></div></div>
    ${canNext ? `<a class="icon-btn" href="${nextHref}" aria-label="Keyingi">${icon('chevR', 20)}</a>` : `<span class="icon-btn" style="opacity:.3">${icon('chevR', 20)}</span>`}
  </div>
  <h2 class="print-title">${esc(title)}</h2>
  <div class="report">${isYear ? renderYear(key) : renderMonth(key)}</div>
  <p class="print-foot">Azimov · shaxsiy moliya hisoboti · ${new Date().toLocaleDateString('uz-UZ')}</p>`;
}
export function afterReports() {}

let savedTitle = '';
window.addEventListener('beforeprint', () => {
  savedTitle = document.title;
  const k = location.hash.split('/')[1]?.split('?')[0] || curKey();
  document.title = `Azimov-hisobot-${k}`;
});
window.addEventListener('afterprint', () => savedTitle && (document.title = savedTitle));
actions['rep:print'] = () => window.print();
