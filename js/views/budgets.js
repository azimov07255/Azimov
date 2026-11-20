import { state, catOf, cats, commit, budgetTotal } from '../store.js';
import { esc, sum, clamp } from '../utils.js';
import { money, short, pct } from '../fmt.js';
import { icon } from '../icons.js';
import { stats, curKey, forecast, baseline, monthsBack } from '../insights.js';
import { ring } from '../charts.js';
import { actions, sheet, fAmount, progress, card, toast, amt, empty, fText } from '../ui.js';
import { monthLabel } from '../utils.js';

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
      <div class="ov-actions"><button class="btn primary sm" data-act="budget:edit">${icon('edit', 16)} Byudjetni sozlash</button><button class="btn ghost sm" data-act="budget:auto">${icon('sparkles', 16)} Avto-reja</button></div>
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

  return `
  <div class="page-head"><div><h1>Byudjet</h1><p class="sub">${monthLabel(key)} · kategoriyalar bo'yicha limitlar</p></div></div>
  ${overview}
  ${withB.length ? card('Limitli kategoriyalar', `<div class="rows">${withB.map((c) => row(c, state.budgets[c.id])).join('')}</div>`) : empty('🎯', "Byudjet hali yo'q", "Har bir kategoriya uchun oylik limit qo'ying yoki «Avto-reja» tugmasi bilan 50/30/20 qoidasi bo'yicha tayyor reja oling.", `<button class="btn primary" data-act="budget:auto">${icon('sparkles', 16)} Avto-reja yaratish</button>`)}
  ${noB.length ? card('Limitsiz xarajatlar', `<div class="rows">${noB.map((c) => row(c, 0)).join('')}</div>`) : ''}
  <section class="card tip"><h3>${icon('sparkles', 18)} 50 / 30 / 20 qoidasi</h3><div class="rule"><div style="--w:50%;--c:#60a5fa"><b>50%</b><span>Zarur (uy, oziq-ovqat, transport)</span></div><div style="--w:30%;--c:#c084fc"><b>30%</b><span>Xohish (kafe, ko'ngil ochar)</span></div><div style="--w:20%;--c:#34d399"><b>20%</b><span>Jamg'arma va investitsiya</span></div></div></section>`;
}

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
actions['budget:cat'] = (el) => {
  const c = catOf(el.dataset.id);
  sheet({
    title: `${c.icon} ${esc(c.name)}`,
    body: `${fAmount('Oylik limit', 'limit', { value: state.budgets[c.id] || 0, focus: true, big: true })}<p class="muted small">O'tgan oylar o'rtachasi: <b>${money(avgCat(c.id))}</b>. Limitni 0 qoldirsangiz o'chiriladi.</p>`,
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
    onSubmit(d, form) {
      const inc = amt(d.income);
      if (!(inc > 0)) return toast('Daromadni kiriting', { type: 'warn' }), false;
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
