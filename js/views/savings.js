import { state, commit, save, catOf, balanceOf, debtLeft, iOwe, owedToMe } from '../store.js';
import { esc, uid, today, addMonthsToDate, fmtDate, sum, addDays, monthKey } from '../utils.js';
import { money, short, pct, amtText, parseAmt, curCode, num } from '../fmt.js';
import { icon } from '../icons.js';
import { baseline, topSpendCats, avgCategory } from '../insights.js';
import { ruAmount, whatIf, simulatePayoff, STRATEGIES } from '../planner.js';
import { area } from '../charts.js';
import { actions, sheet, fAmount, fSelect, card, empty, toast, confirmBox, amt, progress } from '../ui.js';

const STEPS = () => (curCode() === 'UZS' ? [1000, 5000, 10000] : [1, 5, 10]);
const sample = () => (curCode() === 'UZS' ? 23400 : 23.4);

/* =====================================================================
   1. Yaxlitlab tejash
   ===================================================================== */
export function renderRoundup() {
  const ru = state.ru;
  const goals = state.goals;
  const goal = goals.find((g) => g.id === ru.goalId);
  const entries = Object.entries(ru.ledger || {});
  const txById = new Map(state.transactions.map((t) => [t.id, t]));
  const total = sum(entries, ([, e]) => e.a);
  const mk = monthKey(today());
  const month = sum(entries.filter(([id]) => txById.get(id)?.date.slice(0, 7) === mk), ([, e]) => e.a);
  const last30 = sum(entries.filter(([id]) => (txById.get(id)?.date || '') >= addDays(today(), -30)), ([, e]) => e.a);
  const recent = entries
    .map(([id, e]) => ({ t: txById.get(id), e }))
    .filter((x) => x.t)
    .sort((a, b) => (a.t.date === b.t.date ? b.t.ts - a.t.ts : a.t.date < b.t.date ? 1 : -1))
    .slice(0, 8);
  const step = ru.step;
  const ex = sample();
  const up = Math.ceil(ex / step) * step;
  const toMove = Math.max(0, total - (ru.moved || 0));
  const hasSavingsAcc = state.accounts.some((a) => a.type === 'savings');

  return `
  <div class="page-head"><div class="back-row"><a class="icon-btn" href="#/tools" aria-label="Orqaga">${icon('chevL', 20)}</a><div><h1>Yaxlitlab tejash</h1><p class="sub">Har xarajatni yaxlitlab, farqini maqsadga o'tkazadi — sezilmay yig'iladi</p></div></div></div>
  <div class="grid">
    ${card(`${icon('zap', 18)} Sozlama`, `
      <label class="switch-row"><span><b>Yaxlitlab tejashni yoqish</b><small class="muted">Har yangi xarajat uchun avtomatik</small></span><input type="checkbox" data-ru="on" ${ru.on ? 'checked' : ''}></label>
      <label class="field" style="margin-top:12px"><span>Qaysi maqsadga ketsin?</span>
        <select class="input" data-ru="goalId"><option value="">— tanlang —</option>${goals.map((g) => `<option value="${g.id}" ${g.id === ru.goalId ? 'selected' : ''}>${g.icon} ${esc(g.name)}</option>`).join('')}</select></label>
      ${!goals.length || !goal ? `<button class="btn ghost sm" data-act="ru:newgoal" style="margin-bottom:12px">${icon('plus', 14)} Yangi «Yaxlitlab tejash» maqsadi</button>` : ''}
      <label class="field"><span>Yaxlitlash qadami</span>
        <div class="seg">${STEPS().map((s) => `<label><input type="radio" name="rustep" data-ru="step" value="${s}" ${s === step ? 'checked' : ''}><span>${num(s, 0)}</span></label>`).join('')}</div></label>
      <div class="ru-example"><span>${money(ex, { force: true })}</span>${icon('chevR', 16)}<span>${money(up, { force: true })}</span><b class="pos">+${money(up - ex, { force: true })}</b></div>
      <p class="muted small">Faqat <b>yoqilgandan keyingi</b> xarajatlar hisoblanadi.${ru.on ? ` <button class="link-btn" data-act="ru:backfill" style="margin:0">So'nggi 30 kunni ham qo'shish</button>` : ''}</p>`, { cls: 'c6' })}
    <div class="c6 stack">
      ${card(`${icon('sparkles', 18)} Natija`, `
        <div class="cr big"><span>Jami yig'ildi</span><b>${money(total)}</b></div>
        <div class="calc-rows" style="margin-top:8px">
          <div class="cr"><span>Shu oy</span><b>${money(month)}</b></div>
          <div class="cr"><span>So'nggi 30 kun</span><b>${money(last30)}</b></div>
          <div class="cr"><span>Hisoblangan xarajatlar</span><b>${entries.length} ta</b></div>
          ${last30 > 0 ? `<div class="cr"><span>Shu sur'atda yiliga</span><b class="pos">~${money((last30 / 30) * 365)}</b></div>` : ''}
        </div>
        ${goal ? `<div class="split"><span>${goal.icon} ${esc(goal.name)}</span><span class="muted">${money(goal.saved || 0)} / ${short(goal.target)}</span></div>${progress(goal.target ? (goal.saved || 0) / goal.target : 0, { color: goal.color, h: 8 })}` : ''}`, {})}
      ${card(`${icon('wallet', 18)} Haqiqiy pulni ko'chiring`, `
        <p class="muted small">Maqsaddagi summa — «konvert» (hisob-kitob). Hisobingizdan pul chiqmaydi. Haqiqatda ham jamg'arish uchun to'plangan summani jamg'arma hisobiga o'tkazing.</p>
        ${toMove > 0 ? `<button class="btn primary block" data-act="ru:move" ${hasSavingsAcc ? '' : 'disabled'}>${icon('swap', 16)} ${money(toMove)} ni jamg'arma hisobiga ko'chirish</button>` : '<p class="muted small">Ko\'chiriladigan summa hozircha yo\'q.</p>'}
        ${hasSavingsAcc ? '' : `<p class="muted small">Buning uchun Sozlamalarda «Jamg'arma» turidagi hisob oching.</p>`}`, {})}
    </div>
  </div>
  ${recent.length ? card("So'nggi yaxlitlashlar", `<div class="rows">${recent.map(({ t, e }) => `<div class="row static"><span class="row-ico" style="--c:${catOf(t.categoryId).color}">${catOf(t.categoryId).icon}</span><span class="row-main"><b>${esc(t.note || catOf(t.categoryId).name)}</b><small>${money(t.amount, { force: true })} → ${money(t.amount + e.a, { force: true })}</small></span><span class="amount pos">+${money(e.a)}</span></div>`).join('')}</div>`) : ''}
  ${total > 0 ? `<button class="btn danger-ghost" data-act="ru:reset">${icon('trash', 16)} Hisobni nolga tushirish</button>` : ''}`;
}

export function afterRoundup(root) {
  root.addEventListener('change', (e) => {
    const k = e.target.dataset?.ru;
    if (!k) return;
    const ru = state.ru;
    if (k === 'on') {
      if (e.target.checked && !ru.goalId) {
        e.target.checked = false;
        return toast('Avval maqsadni tanlang yoki yarating', { type: 'warn' });
      }
      ru.on = e.target.checked;
      if (ru.on) ru.since = today(); // never backfills silently
    } else if (k === 'goalId') {
      ru.goalId = e.target.value;
      if (!ru.goalId && ru.on) ru.on = false;
    } else if (k === 'step') ru.step = Number(e.target.value);
    commit();
  });
}

actions['ru:newgoal'] = () => {
  const target = curCode() === 'UZS' ? 5000000 : 1000;
  const g = { id: uid(), name: 'Yaxlitlab tejash', icon: '🐖', color: '#fbbf24', target, saved: 0, deadline: '', monthly: 0 };
  state.goals.push(g);
  state.ru.goalId = g.id;
  commit();
  toast("«Yaxlitlab tejash» maqsadi yaratildi", { type: 'ok' });
};
actions['ru:backfill'] = async () => {
  if (!(await confirmBox("So'nggi 30 kunlik xarajatlar ham yaxlitlanib, maqsadga qo'shiladi. Davom etasizmi?", { ok: "Qo'shish" }))) return;
  state.ru.since = addDays(today(), -30);
  commit();
  toast("So'nggi 30 kun hisobga olindi", { type: 'ok' });
};
actions['ru:reset'] = async () => {
  if (!(await confirmBox("Yaxlitlash hisobi nolga tushadi. Maqsaddagi to'plangan pul o'z joyida qoladi. Davom etasizmi?", { ok: 'Nolga tushirish' }))) return;
  state.ru.ledger = {};
  state.ru.applied = {}; // goal.saved stays: the money was already counted
  state.ru.moved = 0;
  commit();
};
actions['ru:move'] = () => {
  const total = sum(Object.values(state.ru.ledger), (e) => e.a);
  const toMove = Math.max(0, total - (state.ru.moved || 0));
  const savings = state.accounts.filter((a) => a.type === 'savings');
  const from = state.accounts.filter((a) => a.type !== 'savings');
  if (!savings.length || !from.length) return toast("Jamg'arma hisobi kerak", { type: 'warn' });
  sheet({
    title: "Jamg'arma hisobiga ko'chirish",
    submit: "Ko'chirish",
    body: `${fAmount('Summa', 'amount', { value: toMove, big: true, focus: true })}
      ${fSelect('Qaysi hisobdan', 'from', from.map((a) => [a.id, `${a.icon} ${a.name} — ${money(balanceOf(a.id), { force: true })}`]), from[0].id)}
      ${fSelect("Qaysi jamg'arma hisobiga", 'to', savings.map((a) => [a.id, `${a.icon} ${a.name}`]), savings[0].id)}`,
    onSubmit(d) {
      const a = amt(d.amount);
      if (!(a > 0)) return toast('Summani kiriting', { type: 'warn' }), false;
      state.transactions.push({ id: uid(), ts: Date.now(), type: 'transfer', amount: a, accountId: d.from, toAccountId: d.to, categoryId: null, date: today(), note: 'Yaxlitlab tejash' });
      state.ru.moved = (state.ru.moved || 0) + a;
      commit();
      toast("Ko'chirildi ✅", { type: 'ok' });
    },
  });
};

/* =====================================================================
   2. «Nima bo'ladi agar» simulyatori
   ===================================================================== */
const wf = { cuts: {}, incomeDelta: 0, extra: 0, rate: 12, years: 5, start: 0, goalId: '', income: null, expense: null };

function wfInputs() {
  const b = baseline();
  const income = wf.income ?? Math.round(b.income);
  const expense = wf.expense ?? Math.round(b.expense);
  const cats = topSpendCats(6);
  return { income, expense, cats };
}
function wfResult() {
  const { income, expense, cats } = wfInputs();
  const goal = state.goals.find((g) => g.id === wf.goalId);
  return {
    cats,
    r: whatIf({
      income, expense, cuts: cats.map(({ c, avg }) => ({ avg, pct: (wf.cuts[c.id] || 0) / 100 })), incomeDelta: wf.incomeDelta, extra: wf.extra,
      rate: wf.rate / 100, years: wf.years, start: wf.start, target: goal ? Math.max(0, goal.target - (goal.saved || 0)) : 0,
    }),
    goal,
  };
}
function wfOutHtml() {
  const { r, goal } = wfResult();
  const y = Math.round(wf.years);
  const labels = Array.from({ length: y + 1 }, (_, i) => `${i}y`);
  const mfmt = (m) => (m == null ? 'hech qachon' : m >= 12 ? `${Math.floor(m / 12)} yil ${m % 12 ? (m % 12) + ' oy' : ''}`.trim() : `${m} oy`);
  return `
    <div class="cr big"><span>${y} yildan keyin farq</span><b>${r.gain >= 0 ? '+' : ''}${money(r.gain, { force: true })}</b></div>
    <div class="calc-rows" style="margin-top:8px">
      <div class="cr"><span>Oyiga bo'shaydigan pul</span><b class="${r.freed >= 0 ? 'pos' : 'neg'}">${money(r.freed, { force: true, sign: true })}</b></div>
      <div class="cr"><span>Hozirgi yo'l (oyiga ${short(r.baseSave, { force: true })})</span><b>${money(r.endBase, { force: true })}</b></div>
      <div class="cr"><span>Yangi yo'l (oyiga ${short(r.newSave, { force: true })})</span><b class="pos">${money(r.endNew, { force: true })}</b></div>
      ${goal ? `<div class="cr"><span>${goal.icon} ${esc(goal.name)}ga yetish</span><b>${mfmt(r.monthsBase)} → <span class="pos">${mfmt(r.monthsNew)}</span></b></div>` : ''}
    </div>
    ${r.base < 0 ? `<p class="muted small">⚠️ Hozir xarajat daromaddan ${money(-r.base, { force: true })} ko'p — «hozirgi yo'l»da jamg'arma 0 deb olindi.</p>` : ''}
    <div class="chart-wrap">${area(labels, [{ values: r.new_series, color: '#34d399' }, { values: r.base_series, color: '#7c5cff', fill: false, dash: '4 4' }], { height: 190 })}</div>
    <div class="legend-inline"><span><i style="background:#34d399"></i>Yangi yo'l</span><span><i style="background:#7c5cff"></i>Hozirgi yo'l</span></div>`;
}

export function renderWhatIf() {
  const { income, expense, cats } = wfInputs();
  return `
  <div class="page-head"><div class="back-row"><a class="icon-btn" href="#/tools" aria-label="Orqaga">${icon('chevL', 20)}</a><div><h1>Nima bo'ladi agar...</h1><p class="sub">Xarajatni kamaytirsangiz yoki daromadingiz oshsa, kelajakda nima o'zgaradi</p></div></div></div>
  <div class="grid">
    <form id="wfForm" class="c6 card" autocomplete="off" onsubmit="return false">
      <div class="card-h"><h3>${icon('sliders', 18)} Stsenariy</h3><button type="button" class="btn ghost sm" data-act="wf:clear">Tozalash</button></div>
      <div class="quick-amts" style="margin:0 0 14px">
        ${cats.find((x) => x.c.id === 'c_cafe') ? `<button type="button" class="hint" data-act="wf:preset" data-k="cafe">☕ Kafe −30%</button>` : ''}
        <button type="button" class="hint" data-act="wf:preset" data-k="want">Ixtiyoriy xarajat −20%</button>
        <button type="button" class="hint" data-act="wf:preset" data-k="income">Daromad +${curCode() === 'UZS' ? '2 mln' : '200'}</button>
      </div>
      <div class="grid-2">${fAmount('Oylik daromad', 'income', { value: income })}${fAmount('Oylik xarajat', 'expense', { value: expense })}</div>
      ${cats.length ? `<h4 class="sub-h">Qaysi xarajatni kamaytirasiz?</h4><div class="wf-cuts">${cats.map(({ c, avg }) => `<div class="wf-cut"><div class="split"><span>${c.icon} <b>${esc(c.name)}</b> <small class="muted">${short(avg)}/oy</small></span><b data-cutv="${c.id}">${wf.cuts[c.id] || 0}%</b></div><input class="range" type="range" name="cut_${c.id}" min="0" max="100" step="5" value="${wf.cuts[c.id] || 0}"></div>`).join('')}</div>` : '<p class="muted small">Xarajat ma\'lumotlari yo\'q — daromad va xarajatni qo\'lda kiriting.</p>'}
      <div class="grid-2">${fAmount('Daromad o\'zgarishi (oyiga)', 'incomeDelta', { value: wf.incomeDelta })}${fAmount("Qo'shimcha jamg'arma (oyiga)", 'extra', { value: wf.extra })}</div>
      <div class="grid-2"><label class="field"><span>Yillik foyda %</span><input class="input" type="number" name="rate" step="0.5" min="0" max="80" value="${wf.rate}"></label>${fAmount("Hozirgi jamg'arma", 'start', { value: wf.start })}</div>
      <label class="field"><span>Muddat: <b id="wfYears">${wf.years}</b> yil</span><input class="range" type="range" name="years" min="1" max="30" step="1" value="${wf.years}"></label>
      <label class="field"><span>Maqsadga yetish vaqtini ko'rish</span><select class="input" name="goalId"><option value="">— maqsad tanlamayman —</option>${state.goals.filter((g) => (g.saved || 0) < g.target).map((g) => `<option value="${g.id}" ${g.id === wf.goalId ? 'selected' : ''}>${g.icon} ${esc(g.name)}</option>`).join('')}</select></label>
      <button type="button" class="btn ghost block" data-act="wf:apply">${icon('check', 16)} Kamaytirishlarni byudjetga qo'llash</button>
    </form>
    <section class="c6 card"><div class="card-h"><h3>${icon('trending', 18)} Natija</h3></div><div id="wfOut">${wfOutHtml()}</div>
      <p class="muted small">Prognoz — taxmin: foyda kafolatlanmaydi, xarajatlar o'tgan 3 oyning o'rtachasidan olingan.</p></section>
  </div>`;
}

export function afterWhatIf(root) {
  const form = root.querySelector('#wfForm');
  const out = root.querySelector('#wfOut');
  if (!form) return;
  const read = () => {
    const f = new FormData(form);
    wf.income = parseAmt(f.get('income'));
    wf.expense = parseAmt(f.get('expense'));
    wf.incomeDelta = parseAmt(f.get('incomeDelta'));
    wf.extra = parseAmt(f.get('extra'));
    wf.start = parseAmt(f.get('start'));
    wf.rate = Math.max(0, Math.min(80, Number(f.get('rate')) || 0));
    wf.years = Number(f.get('years')) || 5;
    wf.goalId = f.get('goalId') || '';
    for (const [k, v] of f) if (k.startsWith('cut_')) wf.cuts[k.slice(4)] = Number(v);
    root.querySelector('#wfYears').textContent = wf.years;
    form.querySelectorAll('[data-cutv]').forEach((el) => (el.textContent = (wf.cuts[el.dataset.cutv] || 0) + '%'));
    out.innerHTML = wfOutHtml();
  };
  form.addEventListener('input', read);
  form.addEventListener('change', read);
}

actions['wf:clear'] = () => {
  Object.assign(wf, { cuts: {}, incomeDelta: 0, extra: 0, rate: 12, years: 5, start: 0, goalId: '', income: null, expense: null });
  actions._render();
};
actions['wf:preset'] = (el) => {
  const k = el.dataset.k;
  if (k === 'cafe') wf.cuts.c_cafe = 30;
  else if (k === 'want') topSpendCats(8).forEach(({ c }) => c.grp === 'want' && (wf.cuts[c.id] = 20));
  else if (k === 'income') wf.incomeDelta = curCode() === 'UZS' ? 2000000 : 200;
  actions._render();
};
actions['wf:apply'] = async () => {
  const cuts = topSpendCats(6).filter(({ c }) => (wf.cuts[c.id] || 0) > 0);
  if (!cuts.length) return toast('Avval kamida bitta xarajatni kamaytiring', { type: 'warn' });
  const round = (n) => Math.max(1, Math.round(n / (curCode() === 'UZS' ? 1000 : 1)) * (curCode() === 'UZS' ? 1000 : 1));
  const list = cuts.map(({ c, avg }) => `${c.icon} ${c.name}: ${short(round(avg * (1 - wf.cuts[c.id] / 100)))}`).join(', ');
  if (!(await confirmBox(`Byudjet limitlari o'zgaradi: ${list}. Davom etasizmi?`, { ok: "Qo'llash" }))) return;
  cuts.forEach(({ c, avg }) => (state.budgets[c.id] = round(avg * (1 - wf.cuts[c.id] / 100))));
  commit();
  toast("Byudjetga qo'llandi ✅", { type: 'ok' });
};

/* =====================================================================
   3. Qarzni tez yopish rejasi
   ===================================================================== */
const po = { strategy: null, extra: 0 };

function debtsForPlan() {
  return state.debts.filter((d) => d.type === 'borrowed' && debtLeft(d) > 0).map((d) => ({ id: d.id, name: d.person, left: debtLeft(d), rate: d.rate || 0, minPay: d.minPay || 0, due: d.due || '' }));
}
const monthsLabel = (m) => (m == null ? 'tugamaydi' : m >= 12 ? `${Math.floor(m / 12)} yil${m % 12 ? ' ' + (m % 12) + ' oy' : ''}` : `${m} oy`);
const payoffDate = (m) => (m == null ? '—' : fmtDate(addMonthsToDate(today(), m), true));

export function renderPayoff() {
  const debts = debtsForPlan();
  if (!debts.length)
    return `<div class="page-head"><div class="back-row"><a class="icon-btn" href="#/debts" aria-label="Orqaga">${icon('chevL', 20)}</a><div><h1>Qarzni tez yopish rejasi</h1></div></div></div>${card('', empty('🎉', "Qarzingiz yo'q!", "Hozir hech kimga qarzdor emassiz. Qarz olsangiz, shu yerda eng tez yopish rejasi paydo bo'ladi.", `<a class="btn primary" href="#/debts">Qarzlar</a>`))}`;
  const b = baseline();
  const need = sum(debts, (d) => d.minPay);
  const total = sum(debts, (d) => d.left);
  const surplus = Math.max(0, Math.round((b.income - b.expense) / 1000) * 1000);
  const budget = state.settings.payoffBudget || Math.max(need, surplus, Math.round(total / 24 / 1000) * 1000 || 1000);
  const total2 = budget + (po.extra || 0);
  const sims = Object.fromEntries(Object.keys(STRATEGIES).map((k) => [k, simulatePayoff(debts, total2, k)]));
  const done = Object.values(sims).filter((s) => s.done);
  // best = least interest, then fastest; with no interest anywhere the snowball (quick wins) is preferred
  const best = done.length ? [...done].sort((a, c) => a.interest - c.interest || a.months - c.months || (a.strategy === 'snowball' ? -1 : 1))[0].strategy : 'snowball';
  const cur = po.strategy && sims[po.strategy] ? po.strategy : best;
  const S = sims[cur];
  const base = simulatePayoff(debts, budget, cur);
  const faster = po.extra > 0 && S.done && base.done ? base.months - S.months : 0;
  const saved = po.extra > 0 && S.done && base.done ? base.interest - S.interest : 0;
  const labels = S.history.map((_, i) => (i % Math.max(1, Math.ceil(S.history.length / 6)) === 0 ? `${i}` : '')).map((l, i, a) => l || (i === a.length - 1 ? String(i) : ''));

  return `
  <div class="page-head"><div class="back-row"><a class="icon-btn" href="#/debts" aria-label="Orqaga">${icon('chevL', 20)}</a><div><h1>Qarzni tez yopish rejasi</h1><p class="sub">Jami qarz ${money(total)} · ${debts.length} ta</p></div></div></div>
  <div class="grid">
    <section class="card c6">
      <div class="card-h"><h3>${icon('wallet', 18)} Oyiga qancha ajrata olasiz?</h3></div>
      <div id="poForm">
        <label class="field"><span>Qarzlarga oylik to'lov</span><div class="amt-wrap big"><input class="input amt" inputmode="numeric" id="poBudget" value="${amtText(budget)}"><i></i></div></label>
        ${!S.feasible ? `<div class="banner warn">${icon('bell', 18)}<span>Minimal to'lovlar yig'indisi <b>${money(need)}</b> — shuncha ajratishingiz shart. Reja shu summadan hisoblandi.</span></div>` : need > 0 ? `<p class="muted small">Minimal to'lovlar: ${money(need)}</p>` : ''}
        ${surplus > 0 ? `<p class="muted small">O'tgan oylarda oyiga o'rtacha <b>${money(surplus)}</b> ortgan.</p>` : ''}
        <label class="field"><span>Qo'shimcha to'lov bo'lsa? (taqqoslash uchun)</span><div class="amt-wrap"><input class="input amt" inputmode="numeric" id="poExtra" value="${amtText(po.extra)}" placeholder="0"><i></i></div></label>
        ${po.extra > 0 && S.done ? `<div class="cr pos"><span>+${money(po.extra)}/oy bilan</span><b>${faster > 0 ? `${faster} oy tezroq` : 'xuddi shu muddat'}${saved > 0 ? `, ${money(saved)} foiz tejaladi` : ''}</b></div>` : ''}
        ${owedToMe() > 0 ? `<p class="muted small">💡 Sizga ${money(owedToMe())} qarzdor — qaytsa, shu pul ham qarzni tezlashtiradi.</p>` : ''}
      </div>
    </section>
    <section class="card c6">
      <div class="card-h"><h3>${icon('target', 18)} Usullarni solishtirish</h3></div>
      <div class="po-strats">${Object.entries(STRATEGIES).map(([k, st]) => { const s = sims[k]; return `<button class="po-s ${k === cur ? 'on' : ''}" data-act="po:strategy" data-k="${k}"><div class="split"><b>${st.name}</b>${k === best ? '<span class="pill pos">Tavsiya</span>' : ''}</div><small class="muted">${st.hint}</small><div class="po-n"><span>${monthsLabel(s.months)}</span><span class="muted">${s.done ? 'Foiz: ' + money(s.interest) : ''}</span></div></button>`; }).join('')}</div>
    </section>
  </div>
  ${S.done ? card(`${icon('check', 18)} ${STRATEGIES[cur].name}: tartib va muddatlar`, `
    <div class="cr big"><span>Qarzsiz bo'lish sanasi</span><b>${payoffDate(S.months)}</b></div>
    <div class="po-order">${S.order.map((o, i) => { const d = debts.find((x) => x.id === o.id); return `<div class="po-o"><span class="po-i">${i + 1}</span><div class="grow"><b>${esc(o.name)}</b><small class="muted">${money(o.left)}${o.rate ? ' · ' + o.rate + '% yillik' : ''}${d?.minPay ? ' · min ' + short(d.minPay) : ''}</small></div><div class="po-d"><b>${monthsLabel(o.paidMonth)}</b><small class="muted">${payoffDate(o.paidMonth)}</small></div></div>`; }).join('')}</div>
    <div class="chart-wrap">${area(labels, [{ values: S.history, color: '#fb7185' }], { height: 170 })}</div><p class="muted small center">Qolgan qarz (oylar bo'yicha)</p>` ) : card('', `<div class="banner warn">${icon('bell', 18)}<span>Bu to'lov bilan qarz <b>tugamaydi</b>: foiz to'lovdan ko'p. Oylik to'lovni oshiring.</span></div>`)}
  <p class="muted small center">Foizlar oylik hisoblangan taxmin. Qarz bergan kishi bilan kelishuvingiz boshqacha bo'lishi mumkin. Foiz va minimal to'lovni «Qarzlar» → qarzni tahrirlash orqali kiriting.</p>`;
}

export function afterPayoff(root) {
  const b = root.querySelector('#poBudget');
  const x = root.querySelector('#poExtra');
  b?.addEventListener('change', () => {
    state.settings.payoffBudget = parseAmt(b.value);
    save();
    actions._render();
  });
  x?.addEventListener('change', () => {
    po.extra = parseAmt(x.value);
    actions._render();
  });
}
actions['po:strategy'] = (el) => {
  po.strategy = el.dataset.k;
  actions._render();
};
