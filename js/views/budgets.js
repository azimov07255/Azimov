import { state, catOf, cats, commit, budgetTotal } from '../store.js';
import { esc, sum, clamp } from '../utils.js';
import { money, short, pct } from '../fmt.js';
import { icon } from '../icons.js';
import { stats, curKey, forecast, baseline, monthsBack } from '../insights.js';
import { ring } from '../charts.js';
import { actions, sheet, fAmount, progress, card, toast, amt, empty, fText, confirmBox, closeSheet } from '../ui.js';
import { openCatSheet } from './settings.js';
import { monthLabel, addMonths } from '../utils.js';

export function renderBudgets() {
  const key = curKey();
  const st = stats(key);
  const f = forecast();
  const bt = budgetTotal();
  const exp = cats('expense');
  const withB = exp.filter((c) => state.budgets[c.id] > 0).sort((a, b) => (st.byCat[b.id] || 0) / state.budgets[b.id] - (st.byCat[a.id] || 0) / state.budgets[a.id]);
  const noB = exp.filter((c) => !(state.budgets[c.id] > 0) && st.byCat[c.id] > 0).sort((a, b) => st.byCat[b.id] - st.byCat[a.id]);
  const spentBudgeted = sum(withB, (c) => st.byCat[c.id] || 0);
  const p = bt > 0 ? spentBudgeted / bt : 0;
  const colr = p > 1 ? ['#fb7185', '#f43f5e'] : p > 0.8 ? ['#fbbf24', '#fb923c'] : ['#7c5cff', '#22d3ee'];

  const overview = `
  <section class="card overview">
    <div class="ov-ring">${ring(p, { size: 150, thick: 13, colors: colr, center: bt > 0 ? `<b class="ring-num">${Math.round(p * 100)}%</b><small>ishlatildi</small>` : `<small>Byudjet</small><b>yo'q</b>` })}</div>
    <div class="ov-info">
      <div class="ov-row"><span>Umumiy byudjet</span><b>${bt > 0 ? money(bt) : '—'}</b></div>
      <div class="ov-row"><span>Sarflandi</span><b>${money(spentBudgeted)}</b></div>
      <div class="ov-row"><span>Qoldi</span><b class="${bt - spentBudgeted < 0 ? 'neg' : 'pos'}">${bt > 0 ? money(bt - spentBudgeted) : '—'}</b></div>
      <div class="ov-row"><span>Kuniga xavfsiz</span><b>${bt > 0 ? money(f.perDay) : '—'}</b></div>
      <div class="ov-actions"><button class="btn primary sm" data-act="budget:edit">${icon('edit', 16)} Byudjetni sozlash</button><button class="btn ghost sm" data-act="budget:auto">${icon('sparkles', 16)} Avto-reja</button>${bt > 0 ? `<button class="btn danger-ghost sm" data-act="budget:clear">${icon('trash', 16)} Byudjetni o'chirish</button>` : ''}<a class="btn ghost sm" href="#/settings">${icon('edit', 16)} Kategoriyalar</a></div>
    </div>
  </section>`;

  const row = (c, limit) => {
    const sp = st.byCat[c.id] || 0;
    const pr = limit ? sp / limit : 0;
    const col = pr > 1 ? 'var(--neg)' : pr > 0.8 ? 'var(--warn)' : c.color;
    const left = limit - sp;
    return `<button class="brow" data-act="budget:cat" data-id="${c.id}">
      <span class="row-ico" style="--c:${c.color}">${c.icon}</span>
      <div class="brow-main"><div class="split"><b>${esc(c.name)}</b><span class="${pr > 1 ? 'neg' : 'muted'}">${limit ? `${money(sp)} / ${short(limit)}` : money(sp)}</span></div>
      ${limit ? progress(pr, { color: col, h: 8 }) : ''}
      ${limit ? `<small class="${left < 0 ? 'neg' : 'muted'}">${left < 0 ? `${money(-left)} oshib ketdi` : `${money(left)} qoldi · ${pct(Math.min(pr, 9.99))}`}</small>` : `<small class="muted">Limit qo'yilmagan</small>`}</div></button>`;
  };

  const planCard = renderPlan();
  const closeCard = renderClose();
  return `
  <div class="page-head"><div><h1>Byudjet</h1><p class="sub">${monthLabel(key)} · kategoriyalar bo'yicha limitlar</p></div></div>
  ${overview}
  ${closeCard}
  ${planCard}
  ${withB.length ? card('Limitli kategoriyalar', `<div class="rows">${withB.map((c) => row(c, state.budgets[c.id])).join('')}</div>`) : empty('🎯', "Byudjet hali yo'q", "Har bir kategoriya uchun oylik limit qo'ying yoki «Avto-reja» tugmasi bilan 50/30/20 qoidasi bo'yicha tayyor reja oling.", `<button class="btn primary" data-act="budget:auto">${icon('sparkles', 16)} Avto-reja yaratish</button>`)}
  ${noB.length ? card('Limitsiz xarajatlar', `<div class="rows">${noB.map((c) => row(c, 0)).join('')}</div>`) : ''}
  <section class="card tip"><h3>${icon('sparkles', 18)} 50 / 30 / 20 qoidasi</h3><div class="rule"><div style="--w:50%;--c:#60a5fa"><b>50%</b><span>Zarur (uy, oziq-ovqat, transport)</span></div><div style="--w:30%;--c:#c084fc"><b>30%</b><span>Xohish (kafe, ko'ngil ochar)</span></div><div style="--w:20%;--c:#34d399"><b>20%</b><span>Jamg'arma va investitsiya</span></div></div></section>`;
}

/* ---------- monthly plan: give every so'm a job ---------- */
export const plannedIncome = () => state.settings.plannedIncome || Math.round(baseline().income) || 0;
const goalsPlan = () => sum(state.goals.filter((g) => (g.saved || 0) < g.target), (g) => g.monthly || 0);

function renderPlan() {
  const inc = plannedIncome();
  const bud = budgetTotal();
  const gp = goalsPlan();
  const free = inc - bud - gp;
  const base = Math.max(inc, bud + gp, 1);
  const seg = (v, c) => `<i style="width:${(Math.max(0, v) / base) * 100}%;background:${c}"></i>`;
  const msg = inc <= 0 ? "Kutilayotgan oylik daromadni kiriting — shunda har so'mingizga vazifa berish osonlashadi."
    : free > 0 ? `Hali <b>${money(free)}</b> vazifasiz turibdi. Uni byudjetga, maqsadga yoki zaxiraga yo'naltiring.`
    : free === 0 ? "Reja to'liq: har bir so'mga vazifa berilgan ✅"
    : `Reja daromaddan <b class="neg">${money(-free)}</b> ga oshib ketgan. Limitlarni kamaytiring.`;
  return `<section class="card plan">
    <div class="card-h"><h3>${icon('wallet', 18)} Oylik reja — har so'mga vazifa</h3><button class="btn ghost sm" data-act="plan:income">${icon('edit', 14)} Daromad</button></div>
    <div class="plan-bar">${seg(bud, '#60a5fa')}${seg(gp, '#34d399')}${free > 0 ? seg(free, 'var(--track)') : ''}</div>
    <div class="plan-legend">
      <div><i style="background:var(--text)"></i><span>Kutilayotgan daromad</span><b>${inc ? money(inc) : '—'}</b></div>
      <div><i style="background:#60a5fa"></i><span>Byudjet (xarajatlar)</span><b>${money(bud)}</b></div>
      <div><i style="background:#34d399"></i><span>Maqsadlarga hissa</span><b>${money(gp)}</b></div>
      <div class="free ${free < 0 ? 'neg' : free === 0 && inc ? 'pos' : ''}"><i style="background:var(--track)"></i><span>Vazifasiz qolgan</span><b>${inc ? money(free) : '—'}</b></div>
    </div>
    <p class="muted small">${msg}</p></section>`;
}
actions['plan:income'] = () =>
  sheet({
    title: 'Kutilayotgan oylik daromad',
    body: `${fAmount('Oyiga qancha daromad kutasiz?', 'income', { value: plannedIncome(), big: true, focus: true })}<p class="muted small">Bo'sh qoldirsangiz, o'tgan oylar o'rtachasi (${money(baseline().income)}) ishlatiladi. Maqsadlarga oylik hissani «Maqsadlar» bo'limida belgilaysiz.</p>`,
    onSubmit(d) {
      state.settings.plannedIncome = amt(d.income);
      commit();
      toast('Saqlandi', { type: 'ok' });
    },
  });

/* ---------- close the month ---------- */
export const unclosedMonth = () => {
  const k = addMonths(curKey(), -1);
  return stats(k).count > 0 && !state.closings?.[k] ? k : null;
};
function streak() {
  const keys = Object.keys(state.closings || {}).sort().reverse();
  let n = 0;
  for (const k of keys) {
    const c = state.closings[k];
    if (c.over === 0 && c.net >= 0) n++;
    else break;
  }
  return n;
}
function renderClose() {
  const k = unclosedMonth();
  const hist = Object.entries(state.closings || {}).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 6);
  const st = streak();
  return `${k ? `<section class="card close-card"><div class="cc"><span class="cc-ico">🧾</span><div><b>${monthLabel(k)} oyini yoping</b><p class="muted small">Natijani ko'ring, tejagan pulingizni maqsadlarga taqsimlang va keyingi oyni toza boshlang.</p></div><button class="btn primary" data-act="close:month" data-key="${k}">Oyni yopish</button></div></section>` : ''}
  ${hist.length ? `<section class="card"><div class="card-h"><h3>${icon('check', 18)} Yopilgan oylar</h3>${st >= 2 ? `<span class="pill pos">🔥 ${st} oy ketma-ket</span>` : ''}</div><div class="rows">${hist.map(([key, c]) => `<div class="row static"><span class="row-ico" style="--c:${c.over === 0 && c.net >= 0 ? '#34d399' : '#fbbf24'}">${c.over === 0 && c.net >= 0 ? '✅' : '⚠️'}</span><span class="row-main"><b>${monthLabel(key)}</b><small>${c.over ? `${c.over} ta limit oshgan · ` : "Limitlar me'yorda · "}${c.allocated ? `maqsadlarga ${short(c.allocated)}` : 'taqsimlanmadi'}</small></span><span class="amount ${c.net >= 0 ? 'pos' : 'neg'}">${money(c.net, { sign: true })}</span></div>`).join('')}</div></section>` : ''}`;
}

actions['close:month'] = (el) => {
  const key = el.dataset.key || unclosedMonth();
  if (!key) return;
  const st = stats(key);
  const lim = Object.entries(state.budgets).filter(([, v]) => v > 0).map(([id, v]) => ({ id, limit: v, spent: st.byCat[id] || 0 }));
  const over = lim.filter((x) => x.spent > x.limit);
  const underSum = sum(lim.filter((x) => x.spent <= x.limit), (x) => x.limit - x.spent);
  const net = st.net;
  const avail = Math.max(0, net);
  const goals = state.goals.filter((g) => (g.saved || 0) < g.target);
  let left = avail;
  const pre = {};
  for (const g of goals) {
    const a = Math.min(left, g.monthly || 0, g.target - (g.saved || 0));
    pre[g.id] = Math.round(a);
    left -= pre[g.id];
  }
  sheet({
    title: `${monthLabel(key)} — natija`,
    submit: 'Oyni yopish',
    wide: true,
    body: `<div class="calc-rows">
        <div class="cr"><span>Daromad</span><b class="pos">${money(st.income)}</b></div>
        <div class="cr"><span>Xarajat</span><b class="neg">${money(st.expense)}</b></div>
        <div class="cr ${net >= 0 ? 'big' : 'neg'}"><span>Sof natija</span><b>${money(net, { sign: true })}</b></div>
      </div>
      ${lim.length ? `<p class="muted small">Byudjet: <b>${lim.length - over.length}/${lim.length}</b> kategoriya limit ichida${over.length ? `. Oshgan: ${over.slice(0, 4).map((x) => `${catOf(x.id).icon} ${esc(catOf(x.id).name)} (+${short(x.spent - x.limit)})`).join(', ')}` : ' ✅'}. Limitlardan tejalgan: <b>${money(underSum)}</b>.</p>` : ''}
      ${avail > 0 && goals.length ? `<h4 class="sub-h">Tejalgan ${money(avail)} ni taqsimlang</h4>
        <div class="alloc-rows">${goals.map((g) => `<div class="lim"><span class="row-ico" style="--c:${g.color}">${g.icon}</span><div class="lim-n"><b>${esc(g.name)}</b><small class="muted">${money(g.saved || 0)} / ${short(g.target)}${g.monthly ? ` · reja ${short(g.monthly)}` : ''}</small></div><input class="input amt" inputmode="numeric" name="g_${g.id}" value="${pre[g.id] ? String(pre[g.id]).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0') : ''}" placeholder="0"></div>`).join('')}</div>
        <div class="total-line"><span>Erkin mablag'da qoladi</span><b id="allocLeft">—</b></div>`
        : avail > 0 ? `<p class="muted small">Tejalgan ${money(avail)} bor, lekin faol maqsad yo'q. «Maqsadlar» bo'limida maqsad yarating.</p>` : `<p class="muted small">Bu oy tejam yo'q — hechqisi yo'q, keyingi oy yaxshiroq bo'ladi. Oyni yopib, yangi oyni boshlang.</p>`}`,
    onMount(form) {
      const upd = () => {
        const used = sum([...form.querySelectorAll('.alloc-rows input')], (i) => amt(i.value));
        const el = form.querySelector('#allocLeft');
        if (el) {
          el.textContent = money(avail - used, { force: true });
          el.className = avail - used < 0 ? 'neg' : '';
        }
      };
      form.addEventListener('input', upd);
      upd();
    },
    onSubmit(d) {
      const rows = goals.map((g) => ({ g, a: amt(d['g_' + g.id]) })).filter((x) => x.a > 0);
      const used = sum(rows, (x) => x.a);
      if (used > avail + 0.5) return toast(`Tejalgan summadan (${money(avail, { force: true })}) ko'p taqsimlab bo'lmaydi`, { type: 'warn' }), false;
      rows.forEach(({ g, a }) => (g.saved = (g.saved || 0) + a));
      state.closings[key] = { at: new Date().toISOString(), income: st.income, expense: st.expense, net, over: over.length, allocated: used, goals: rows.map((x) => ({ id: x.g.id, name: x.g.name, amount: x.a })) };
      commit();
      const n = streak();
      toast(n >= 2 ? `✅ Oy yopildi — ${n} oy ketma-ket! 🔥` : '✅ Oy yopildi', { type: 'ok' });
    },
  });
};

function limitsSheet(prefill, title = "Byudjetni sozlash") {
  const exp = cats('expense');
  const st = stats(curKey());
  const b = baseline();
  sheet({
    title,
    wide: true,
    body: `<p class="muted small">Oylik limitni kiriting. Bo'sh qoldirsangiz — limit yo'q. Pastdagi kichik raqam — o'tgan oylar o'rtachasi.</p>
    <div class="limits">${exp.map((c) => {
      const avgPrev = avgCat(c.id);
      return `<div class="lim"><span class="row-ico" style="--c:${c.color}">${c.icon}</span><div class="lim-n"><b>${esc(c.name)}</b><small class="muted">O'rtacha: ${avgPrev ? short(avgPrev) : '—'}</small></div><input class="input amt" inputmode="numeric" name="b_${c.id}" value="${prefill[c.id] ? Math.round(prefill[c.id]).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''}" placeholder="0"></div>`;
    }).join('')}</div>
    <div class="total-line"><span>Jami</span><b id="limTotal">—</b></div>`,
    onMount(form) {
      const upd = () => {
        const t = [...form.querySelectorAll('input.amt')].reduce((a, i) => a + amt(i.value), 0);
        form.querySelector('#limTotal').textContent = money(t, { force: true });
      };
      form.addEventListener('input', upd);
      upd();
    },
    onSubmit(d) {
      const next = {};
      for (const c of exp) {
        const v = amt(d['b_' + c.id]);
        if (v > 0) next[c.id] = v;
      }
      state.budgets = next;
      commit();
      toast('Byudjet saqlandi', { type: 'ok' });
    },
  });
}
function avgCat(id) {
  const ms = monthsBack(4).slice(0, 3).map(stats).filter((s) => s.count > 0);
  return ms.length ? sum(ms, (s) => s.byCat[id] || 0) / ms.length : 0;
}

actions['budget:edit'] = () => limitsSheet(state.budgets);
actions['budget:clear'] = async () => {
  if (!(await confirmBox("Barcha kategoriyalar limiti o'chadi (tranzaksiyalar saqlanadi). Davom etasizmi?", { ok: "Ha, o'chirish" }))) return;
  state.budgets = {};
  commit();
  toast("Byudjet o'chirildi", { type: 'ok' });
};
actions['budget:cat'] = (el) => {
  const c = catOf(el.dataset.id);
  const has = state.budgets[c.id] > 0;
  sheet({
    title: `${c.icon} ${esc(c.name)}`,
    body: `${fAmount('Oylik limit', 'limit', { value: state.budgets[c.id] || 0, focus: true, big: true })}<p class="muted small">O'tgan oylar o'rtachasi: <b>${money(avgCat(c.id))}</b>.</p>
      <button type="button" class="btn ghost sm" data-editcat>${icon('edit', 16)} Kategoriyani tahrirlash / o'chirish</button>`,
    onMount(form) {
      form.querySelector('[data-editcat]').addEventListener('click', () => {
        closeSheet();
        setTimeout(() => openCatSheet(c), 300);
      });
    },
    danger: has ? { label: "Limitni o'chirish", confirm: `«${c.name}» limiti o'chirilsinmi?`, fn: () => (delete state.budgets[c.id], commit(), toast("Limit o'chirildi", { type: 'ok' })) } : null,
    onSubmit(d) {
      const v = amt(d.limit);
      if (v > 0) state.budgets[c.id] = v;
      else delete state.budgets[c.id];
      commit();
      toast('Saqlandi', { type: 'ok' });
    },
  });
};

actions['budget:auto'] = () => {
  const b = baseline();
  const defInc = Math.round(b.income || 0);
  sheet({
    title: 'Avto-reja (50/30/20)',
    submit: "Rejani qo'llash",
    body: `${fAmount('Oylik daromadingiz', 'income', { value: defInc, big: true, focus: true })}
    <p class="muted small">Daromadning 50% i zarur xarajatlarga, 30% i xohishlarga, 20% i jamg'armaga. Taqsimot o'tgan oylardagi xarajat tuzilmangizga qarab aqlli tarzda tuziladi.</p>
    <div id="autoPrev" class="auto-prev"></div>`,
    onMount(form) {
      const run = () => {
        const inc = amt(form.income.value);
        const plan = autoPlan(inc);
        form.querySelector('#autoPrev').innerHTML = inc > 0
          ? `<div class="rows">${cats('expense').filter((c) => plan[c.id]).map((c) => `<div class="row static"><span class="row-ico" style="--c:${c.color}">${c.icon}</span><span class="row-main"><b>${esc(c.name)}</b></span><span class="amount">${money(plan[c.id], { force: true })}</span></div>`).join('')}</div><div class="total-line"><span>Jamg'arma (20%)</span><b class="pos">${money(inc * 0.2, { force: true })}</b></div>`
          : '';
        form._plan = plan;
      };
      form.addEventListener('input', run);
      run();
    },
    async onSubmit(d, form) {
      const inc = amt(d.income);
      if (!(inc > 0)) return toast('Daromadni kiriting', { type: 'warn' }), false;
      if (Object.keys(state.budgets).length && !(await confirmBox('Mavjud byudjetingiz yangi reja bilan almashtiriladi. Davom etasizmi?', { ok: 'Almashtirish' }))) return false;
      state.budgets = autoPlan(inc);
      commit();
      toast('Byudjet tuzildi ✨', { type: 'ok' });
    },
  });
};

export function autoPlan(income) {
  const plan = {};
  if (!(income > 0)) return plan;
  const groups = { need: income * 0.5, want: income * 0.3 };
  const round = (n) => Math.max(1000, Math.round(n / 1000) * 1000);
  for (const grp of ['need', 'want']) {
    const list = cats('expense').filter((c) => c.grp === grp);
    const hist = list.map((c) => avgCat(c.id));
    const totalHist = sum(hist);
    const dflt = { c_food: 5, c_home: 5, c_transport: 2, c_phone: 1, c_health: 1, c_edu: 1, c_family: 1, c_debt: 0, c_cafe: 3, c_shop: 3, c_fun: 2, c_gift: 1, c_subs: 1, c_other: 1 };
    const weights = list.map((c, i) => (totalHist > 0 ? hist[i] || totalHist * 0.02 : dflt[c.id] ?? 1));
    const tw = sum(weights);
    list.forEach((c, i) => {
      if (weights[i] > 0) plan[c.id] = round((groups[grp] * weights[i]) / tw);
    });
  }
  return plan;
}
