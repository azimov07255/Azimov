import { state, commit, goalsAllocated, totalBalance } from '../store.js';
import { esc, uid, today, diffDays, fmtDate, sum } from '../utils.js';
import { money, pct, short } from '../fmt.js';
import { icon } from '../icons.js';
import { baseline } from '../insights.js';
import { ring } from '../charts.js';
import { actions, sheet, fText, fAmount, fDate, fEmoji, fColor, card, empty, toast, amt, confirmBox } from '../ui.js';
import { COLORS } from '../data.js';

const TEMPLATES = [
  { icon: '🛡️', name: 'Avariya fondi', note: '3 oylik xarajat', kind: 'emergency' },
  { icon: '🚀', name: 'Biznes kapitali', note: 'O\'z ishingiz uchun', kind: 'biz' },
  { icon: '🏠', name: 'Uy / kvartira', note: 'Boshlang\'ich to\'lov', kind: 'home' },
  { icon: '🚗', name: 'Mashina', note: 'Orzuingizdagi avto', kind: 'car' },
  { icon: '✈️', name: 'Sayohat', note: 'Dam olish', kind: 'trip' },
  { icon: '🎓', name: "Ta'lim", note: "Kurs yoki o'qish", kind: 'edu' },
];

export function renderGoals() {
  const alloc = goalsAllocated();
  const free = totalBalance() - alloc;
  const b = baseline();
  const total = sum(state.goals, (g) => g.target);
  const t = today();

  const cardG = (g) => {
    const p = g.target ? Math.min(1, (g.saved || 0) / g.target) : 0;
    const done = p >= 1;
    const left = Math.max(0, g.target - (g.saved || 0));
    let hint = '';
    if (done) hint = '🎉 Maqsadga erishildi!';
    else if (g.deadline) {
      const days = diffDays(g.deadline, t);
      const months = Math.max(1, Math.ceil(days / 30));
      hint = days < 0 ? `<span class="neg">Muddat o'tgan (${fmtDate(g.deadline, true)})</span>` : `${fmtDate(g.deadline, true)} gacha · oyiga <b>${money(left / months)}</b>`;
    } else if (b.income > 0) {
      const monthly = Math.max(0, b.income - b.expense);
      hint = monthly > 0 ? `Hozirgi tempda ~${Math.ceil(left / monthly)} oy` : 'Muddat belgilang';
    }
    return `<article class="goal ${done ? 'done' : ''}" style="--c:${g.color}">
      <div class="goal-top">
        ${ring(p, { size: 92, thick: 9, colors: [g.color, g.color], center: `<span class="goal-emoji">${g.icon}</span>` })}
        <div class="goal-info"><h4>${esc(g.name)}</h4><div class="goal-amt"><b>${money(g.saved || 0)}</b><span class="muted"> / ${money(g.target)}</span></div><div class="pill" style="--c:${g.color}">${pct(p)}</div></div>
      </div>
      <p class="goal-hint">${hint}</p>
      <div class="goal-actions"><button class="btn primary sm" data-act="goal:add" data-id="${g.id}">${icon('plus', 16)} Qo'shish</button><button class="btn ghost sm" data-act="goal:edit" data-id="${g.id}">${icon('edit', 16)}</button></div>
    </article>`;
  };

  const used = new Set(state.goals.map((g) => g.name));
  const tpl = TEMPLATES.filter((x) => !used.has(x.name));

  return `
  <div class="page-head"><div><h1>Maqsadlar</h1><p class="sub">Orzularingizni raqamga aylantiring</p></div><button class="btn primary" data-act="goal:new">${icon('plus', 18)} <span class="hide-m">Yangi maqsad</span></button></div>
  <div class="grid">
    <div class="c4 card stat-card"><span class="eyebrow">Ajratilgan</span><b class="big">${money(alloc)}</b><small class="muted">${state.goals.length} ta maqsad · jami ${money(total)}</small></div>
    <div class="c4 card stat-card"><span class="eyebrow">Erkin mablag'</span><b class="big ${free < 0 ? 'neg' : ''}">${money(free)}</b><small class="muted">Hisoblardagi pul − maqsadlarga ajratilgan</small></div>
    <div class="c4 card stat-card"><span class="eyebrow">Tavsiya etilgan avariya fondi</span><b class="big">${b.expense > 0 ? money(b.expense * 3) : '—'}</b><small class="muted">3 oylik o'rtacha xarajat</small></div>
  </div>
  ${state.goals.length ? `<div class="goals-grid">${state.goals.map(cardG).join('')}</div>` : empty('🎯', "Maqsad yo'q", "Pul maqsadsiz tez tugaydi. Quyidagi shablonlardan birini tanlang.")}
  ${tpl.length ? card('Tezkor shablonlar', `<div class="tpl">${tpl.map((x) => `<button class="tpl-i" data-act="goal:tpl" data-kind="${x.kind}"><span>${x.icon}</span><b>${x.name}</b><small>${x.note}</small></button>`).join('')}</div>`) : ''}`;
}

function goalSheet(g = null, preset = {}) {
  const v = g || { icon: '🎯', name: '', target: 0, saved: 0, deadline: '', color: COLORS[state.goals.length % COLORS.length], ...preset };
  sheet({
    title: g ? 'Maqsadni tahrirlash' : 'Yangi maqsad',
    body: `${fText('Nomi', 'name', { value: v.name, placeholder: 'Masalan: Biznes kapitali', focus: !g })}
      ${fAmount('Maqsad summasi', 'target', { value: v.target, big: true })}
      ${fAmount("Hozirgacha yig'ilgan", 'saved', { value: v.saved })}
      ${fDate('Muddat (ixtiyoriy)', 'deadline', v.deadline, { clearable: true })}
      ${fEmoji('icon', v.icon, ['🎯', '🛡️', '🚀', '🏠', '🚗', '✈️', '🎓', '💍', '📱', '💻', '🏪', '🌴', '🕋', '👶', '🐄', '📈'])}
      ${fColor('color', v.color)}`,
    danger: g ? { label: "O'chirish", fn: () => ((state.goals = state.goals.filter((x) => x.id !== g.id)), commit(), toast("O'chirildi", { type: 'ok' })) } : null,
    onSubmit(d) {
      const target = amt(d.target);
      if (!d.name.trim() || !(target > 0)) return toast('Nom va summani kiriting', { type: 'warn' }), false;
      const data = { name: d.name.trim(), target, saved: amt(d.saved), deadline: d.deadline || '', icon: d.icon, color: d.color };
      if (g) Object.assign(g, data);
      else state.goals.push({ id: uid(), ...data });
      commit();
      toast('Saqlandi', { type: 'ok' });
    },
  });
}
actions['goal:new'] = () => goalSheet();
actions['goal:edit'] = (el) => goalSheet(state.goals.find((g) => g.id === el.dataset.id));
actions['goal:tpl'] = (el) => {
  const x = TEMPLATES.find((t) => t.kind === el.dataset.kind);
  const b = baseline();
  const preset = { icon: x.icon, name: x.name };
  if (x.kind === 'emergency' && b.expense > 0) preset.target = Math.round((b.expense * 3) / 1000) * 1000;
  goalSheet(null, preset);
};
actions['goal:add'] = (el) => {
  const g = state.goals.find((x) => x.id === el.dataset.id);
  const left = Math.max(0, g.target - (g.saved || 0));
  sheet({
    title: `${g.icon} ${esc(g.name)}`,
    submit: 'Tasdiqlash',
    body: `<p class="muted small">Hozir <b>${money(g.saved || 0)}</b> / ${money(g.target)} · yetishmaydi <b>${money(left)}</b></p>
      <div class="seg"><label class="pos"><input type="radio" name="dir" value="in" checked><span>Qo'shish</span></label><label class="neg"><input type="radio" name="dir" value="out"><span>Yechish</span></label></div>
      ${fAmount('Summa', 'amount', { big: true, focus: true })}
      <div class="quick-amts">${[0.1, 0.25, 0.5, 1].map((p) => `<button type="button" class="hint" data-fill="${Math.round(left * p)}">${p === 1 ? 'Hammasi' : p * 100 + '%'}</button>`).join('')}</div>`,
    onMount(form) {
      form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-fill]');
        if (b) {
          form.amount.value = Number(b.dataset.fill).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        }
      });
    },
    onSubmit(d) {
      const a = amt(d.amount);
      if (!(a > 0)) return toast('Summani kiriting', { type: 'warn' }), false;
      g.saved = Math.max(0, (g.saved || 0) + (d.dir === 'in' ? a : -a));
      commit();
      toast(g.saved >= g.target ? '🎉 Maqsadga erishdingiz!' : d.dir === 'in' ? 'Qo\'shildi' : 'Yechildi', { type: 'ok' });
    },
  });
};
