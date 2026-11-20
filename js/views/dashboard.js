import { state, catOf, balanceOf, netWorth, totalBalance, sortedTx, subsMonthly, goalsAllocated, monthlyEq, debtLeft } from '../store.js';
import { addMonths, monthLabel, esc, today, diffDays, fmtDate, greeting, MONTHS_GEN, parseYmd, monthShort, sum } from '../utils.js';
import { money, short, pct } from '../fmt.js';
import { icon } from '../icons.js';
import { stats, curKey, monthsBack, healthScore, forecast, insights, balanceSeries } from '../insights.js';
import { ring, donut, bars, spark } from '../charts.js';
import { actions, progress, card, empty } from '../ui.js';
import { txRow, quickAdd } from './tx.js';
import { overdueSubs } from './subs.js';

const EXAMPLES = ['taksi 25 ming', 'kafe 80k', 'bozor 150 000', '+maosh 5 mln'];

export function renderDashboard() {
  const S = state.settings;
  const key = curKey();
  const st = stats(key);
  const prev = stats(monthsBack(2)[0]);
  const nw = netWorth();
  const series = balanceSeries(30);
  const delta = series[series.length - 1] - series[0];
  const deltaPct = series[0] ? delta / Math.abs(series[0]) : 0;
  const hs = healthScore();
  const f = forecast();
  const ins = insights();
  const t = today();
  const d = parseYmd(t);

  /* ---- hero ---- */
  const hero = `
  <section class="hero">
    <div class="hero-top">
      <div>
        <span class="eyebrow">Sof boylik</span>
        <div class="hero-amt" data-count="${nw}">${money(nw)}</div>
      </div>
      <div class="hero-delta ${delta >= 0 ? 'up' : 'down'}">${icon(delta >= 0 ? 'arrowUp' : 'arrowDown', 14)} ${series.length > 1 ? (delta >= 0 ? '+' : '') + short(delta) : '—'}<small>30 kun</small></div>
    </div>
    <div class="hero-spark">${spark(series, { color: '#ffffff' })}</div>
    <div class="hero-stats">
      <div><span>${icon('arrowDown', 13)} Daromad</span><b>${short(st.income)}</b></div>
      <div><span>${icon('arrowUp', 13)} Xarajat</span><b>${short(st.expense)}</b></div>
      <div><span>${icon('sparkles', 13)} Jamg'arma</span><b>${st.rate === null ? '—' : pct(st.rate)}</b></div>
    </div>
  </section>`;

  /* ---- accounts strip ---- */
  const accs = `<div class="acc-strip">${state.accounts.map((a) => `<button class="acc" data-act="acct:edit" data-id="${a.id}" style="--c:${a.color}"><span class="acc-ico">${a.icon}</span><span><small>${esc(a.name)}</small><b>${money(balanceOf(a.id))}</b></span></button>`).join('')}<button class="acc add" data-act="acct:new">${icon('plus', 18)}<span><small>Hisob</small><b>Qo'shish</b></span></button></div>`;

  /* ---- quick add ---- */
  const quick = `
  <section class="card quick">
    <form data-quick autocomplete="off">
      <div class="quick-in">${icon('zap', 18)}<input name="q" class="input" placeholder="Tez qo'shish: taksi 25 ming" enterkeyhint="send"><button class="btn primary sm" type="submit">${icon('send', 16)}</button></div>
    </form>
    <div class="quick-hints">${EXAMPLES.map((e) => `<button type="button" class="hint" data-act="quick:fill" data-v="${esc(e)}">${esc(e)}</button>`).join('')}<a class="hint bank" href="#/import">🏦 Bank xabari</a></div>
  </section>`;

  /* ---- overdue subs ---- */
  const od = overdueSubs();
  const odBanner = od.length ? `<a class="banner warn" href="#/subs">${icon('bell', 18)}<span><b>${od.length} ta takroriy to'lov</b> muddati keldi — ${money(sum(od, (s) => s.amount))}</span>${icon('chevR', 18)}</a>` : '';

  /* ---- demo data notice ---- */
  const demoBanner = S.demo ? `<div class="banner demo">${icon('sparkles', 18)}<span><b>Demo ma'lumot</b> ko'rsatilmoqda — bular haqiqiy pulingiz emas.</span><button class="btn primary sm" data-act="demo:clear">0 dan boshlash</button></div>` : '';

  /* ---- monthly report ready ---- */
  const pk = addMonths(key, -1);
  const repBanner = d.getDate() <= 10 && S.reportSeen !== pk && stats(pk).count > 0 ? `<a class="banner info" href="#/reports/${pk}">${icon('sparkles', 18)}<span><b>${monthLabel(pk)} hisoboti tayyor</b> — oylik tahlil va PDF</span>${icon('chevR', 18)}</a>` : '';

  /* ---- safe to spend ---- */
  const spent = f.limit > 0 ? Math.min(1, f.spent / f.limit) : 0;
  const safe = card(
    `${icon('shield', 18)} Bugun xavfsiz sarflash`,
    f.limit > 0
      ? `<div class="safe"><div class="safe-amt ${f.remaining < 0 ? 'neg' : ''}" data-count="${f.perDay}">${money(f.perDay)}</div>
         <p class="muted">${f.remaining < 0 ? `Limitdan ${money(-f.remaining)} oshib ketgan` : `Oy oxirigacha ${f.daysLeft} kun, qolgan ${money(f.remaining)}`}</p>
         ${progress(spent, { color: spent > 0.9 ? 'var(--neg)' : spent > 0.7 ? 'var(--warn)' : 'var(--grad)', h: 10 })}
         <div class="split"><span>Sarflandi ${money(f.spent)}</span><span>${f.limitKind === 'budget' ? 'Byudjet' : 'Daromad'} ${money(f.limit)}</span></div>
         <div class="forecast ${f.over ? 'bad' : 'ok'}">${icon(f.over ? 'flame' : 'trending', 16)} Prognoz: oy oxirigacha ~${money(f.projected)}</div></div>`
      : `<p class="muted pad">Byudjet yoki daromad kiritsangiz, har kuni qancha sarflash xavfsizligini hisoblayman.</p><a class="btn ghost sm" href="#/budgets">Byudjet belgilash</a>`,
    { cls: 'c4' }
  );

  /* ---- health ---- */
  const hcol = { pos: ['#34d399', '#22d3ee'], info: ['#60a5fa', '#7c5cff'], warn: ['#fbbf24', '#fb923c'], neg: ['#fb7185', '#f43f5e'] }[hs.tone];
  const health = card(
    `${icon('sparkles', 18)} Moliyaviy salomatlik`,
    `<div class="health"><div>${ring(hs.score / 100, { size: 118, thick: 11, colors: hcol, center: `<b class="ring-num">${hs.score}</b><small>${hs.label}</small>` })}</div>
     <ul class="parts">${hs.parts.map((p) => `<li><div class="split"><span>${p.label}</span><span class="muted">${Math.round(p.pts)}/${p.max}</span></div>${progress(p.pts / p.max, { h: 5, color: p.pts / p.max > 0.66 ? 'var(--pos)' : p.pts / p.max > 0.33 ? 'var(--warn)' : 'var(--neg)' })}<small class="muted">${esc(p.note)}</small></li>`).join('')}</ul></div>`,
    { cls: 'c4' }
  );

  /* ---- spending donut ---- */
  const top = Object.entries(st.byCat).sort((a, b) => b[1] - a[1]);
  const topShow = top.slice(0, 5).map(([id, v]) => ({ label: catOf(id).name, value: v, color: catOf(id).color, icon: catOf(id).icon }));
  const rest = sum(top.slice(5), (x) => x[1]);
  if (rest > 0) topShow.push({ label: 'Boshqalar', value: rest, color: '#64748b', icon: '•' });
  const spend = card(
    `${icon('pie', 18)} ${MONTHS_GEN[d.getMonth()][0].toUpperCase() + MONTHS_GEN[d.getMonth()].slice(1)} xarajatlari`,
    topShow.length
      ? `<div class="donut-wrap">${donut(topShow, { size: 150, center: `<small>Jami</small><b>${short(st.expense)}</b>` })}<ul class="legend">${topShow.map((x) => `<li><i style="background:${x.color}"></i><span>${x.icon} ${esc(x.label)}</span><b>${pct(x.value / st.expense)}</b></li>`).join('')}</ul></div>`
      : empty('🍩', "Hali xarajat yo'q", "Bu oy xarajat qo'shganingizda diagramma shu yerda paydo bo'ladi."),
    { cls: 'c4' }
  );

  /* ---- trend ---- */
  const months = monthsBack(6);
  const groups = months.map((m) => {
    const s = stats(m);
    return { label: monthShort(m), a: s.income, b: s.expense };
  });
  const trend = card(
    `${icon('trending', 18)} 6 oylik dinamika`,
    `<div class="chart-wrap">${bars(groups, { height: 260 })}</div><div class="legend-inline"><span><i style="background:var(--pos)"></i>Daromad</span><span><i style="background:var(--neg)"></i>Xarajat</span></div>`,
    { cls: 'c6' }
  );

  /* ---- insights ---- */
  const insCard = card(
    `${icon('sparkles', 18)} Aqlli maslahatlar`,
    `<div class="insights">${ins.map((i) => `<div class="insight ${i.tone}"><span class="ins-ico">${i.icon}</span><div><b>${esc(i.title)}</b><p>${esc(i.text)}</p></div></div>`).join('')}</div>`,
    { cls: 'c6' }
  );

  /* ---- upcoming ---- */
  const upcoming = [];
  state.subs.filter((s) => s.active !== false).forEach((s) => {
    const dd = diffDays(s.nextDate, t);
    if (dd <= 10) upcoming.push({ dd, ico: s.icon || '🔁', title: s.name, sub: dd < 0 ? `${-dd} kun kechikkan` : dd === 0 ? 'Bugun' : `${dd} kundan keyin`, amount: s.amount, href: '#/subs' });
  });
  state.debts.filter((x) => x.due && debtLeft(x) > 0).forEach((x) => {
    const dd = diffDays(x.due, t);
    if (dd <= 10) upcoming.push({ dd, ico: x.type === 'borrowed' ? '📤' : '📥', title: x.type === 'borrowed' ? `${x.person}ga qarz` : `${x.person} qaytaradi`, sub: dd < 0 ? `${-dd} kun kechikkan` : dd === 0 ? 'Bugun' : `${dd} kundan keyin`, amount: debtLeft(x), href: '#/debts' });
  });
  upcoming.sort((a, b) => a.dd - b.dd);
  const up = card(
    `${icon('clock', 18)} Yaqin to'lovlar`,
    upcoming.length
      ? `<div class="rows">${upcoming.slice(0, 5).map((u) => `<a class="row" href="${u.href}"><span class="row-ico" style="--c:${u.dd < 0 ? '#fb7185' : '#fbbf24'}">${u.ico}</span><span class="row-main"><b>${esc(u.title)}</b><small class="${u.dd < 0 ? 'neg' : ''}">${u.sub}</small></span><span class="amount">${money(u.amount)}</span></a>`).join('')}</div>`
      : `<p class="muted pad">Keyingi 10 kunda to'lov yo'q 🎉</p>`,
    { cls: 'c4' }
  );

  /* ---- goals ---- */
  const goals = card(
    `${icon('target', 18)} Maqsadlar`,
    state.goals.length
      ? `<div class="mini-goals">${state.goals.slice(0, 3).map((g) => { const p = g.target ? (g.saved || 0) / g.target : 0; return `<a href="#/goals" class="mg"><span class="mg-ico" style="--c:${g.color}">${g.icon}</span><div><div class="split"><b>${esc(g.name)}</b><span class="muted">${pct(Math.min(1, p))}</span></div>${progress(p, { color: g.color, h: 6 })}</div></a>`; }).join('')}</div>`
      : `<p class="muted pad">Birinchi maqsadingizni yarating — masalan, avariya fondi yoki biznes kapitali.</p><a class="btn ghost sm" href="#/goals">Maqsad qo'shish</a>`,
    { cls: 'c4', action: `<a class="link" href="#/goals">Barchasi</a>` }
  );

  /* ---- recent ---- */
  const recent = sortedTx().slice(0, 6);
  const rec = card(
    `${icon('list', 18)} So'nggi tranzaksiyalar`,
    recent.length ? `<div class="rows">${recent.map((x) => txRow(x, { showDate: true })).join('')}</div>` : empty('✨', 'Boshlaymiz!', "Yuqoridagi «Tez qo'shish» maydoniga yozing: «taksi 25 ming»"),
    { cls: 'c4', action: `<a class="link" href="#/transactions">Barchasi</a>` }
  );

  return `
  <div class="page-head greet"><div><h1>${greeting()}${S.name ? ', ' + esc(S.name) : ''} 👋</h1><p class="sub">${d.getDate()}-${MONTHS_GEN[d.getMonth()]}, ${d.getFullYear()}</p></div></div>
  ${demoBanner}${odBanner}${repBanner}
  <div class="grid">
    <div class="c8">${hero}${accs}</div>
    <div class="c4">${quick}${state.goals.length ? `<div class="alloc card"><span>Erkin mablag'</span><b>${money(totalBalance() - goalsAllocated())}</b><small class="muted">Maqsadlarga ajratilgan: ${money(goalsAllocated())}</small></div>` : ''}</div>
    ${safe}${health}${spend}
    ${trend}${insCard}
    ${up}${goals}${rec}
  </div>`;
}

actions['quick:fill'] = (el) => {
  const i = document.querySelector('[data-quick] input');
  if (i) {
    i.value = el.dataset.v;
    i.focus();
  }
};
export function bindQuick(root) {
  root.querySelector('[data-quick]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const i = e.target.q;
    if (quickAdd(i.value)) i.value = '';
  });
}
