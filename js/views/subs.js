import { state, commit, addTx, CYCLES, monthlyEq, subsMonthly } from '../store.js';
import { esc, uid, today, diffDays, fmtDate, addDays, addMonthsToDate, sum } from '../utils.js';
import { money, pct } from '../fmt.js';
import { icon } from '../icons.js';
import { baseline } from '../insights.js';
import { actions, sheet, fText, fAmount, fDate, fSelect, fEmoji, card, empty, toast, amt } from '../ui.js';
import { cats } from '../store.js';

export const overdueSubs = () => state.subs.filter((s) => s.active !== false && diffDays(s.nextDate, today()) <= 0);

function advance(s) {
  s.nextDate = s.cycle === 'weekly' ? addDays(s.nextDate, 7) : addMonthsToDate(s.nextDate, s.cycle === 'yearly' ? 12 : 1);
}
function pay(s) {
  const acc = s.accountId && state.accounts.find((a) => a.id === s.accountId) ? s.accountId : state.accounts[0]?.id;
  if (!acc) return;
  addTx({ type: 'expense', amount: s.amount, accountId: acc, categoryId: s.categoryId || 'c_subs', date: today(), note: s.name });
  advance(s);
}

export function renderSubs() {
  const t = today();
  const list = [...state.subs].sort((a, b) => (b.active !== false) - (a.active !== false) || a.nextDate.localeCompare(b.nextDate));
  const monthly = subsMonthly();
  const inc = baseline().income;
  const od = overdueSubs();
  return `
  <div class="page-head"><div><h1>Takroriy to'lovlar</h1><p class="sub">Obunalar, ijara, kreditlar — hech biri esdan chiqmasin</p></div><button class="btn primary" data-act="sub:new">${icon('plus', 18)} <span class="hide-m">Qo'shish</span></button></div>
  <div class="grid">
    <div class="c4 card stat-card"><span class="eyebrow">Oyiga</span><b class="big">${money(monthly)}</b><small class="muted">${inc > 0 ? `Daromadning ${pct(monthly / inc, 1)} i` : `${state.subs.filter((s) => s.active !== false).length} ta faol`}</small></div>
    <div class="c4 card stat-card"><span class="eyebrow">Yiliga</span><b class="big">${money(monthly * 12)}</b><small class="muted">Agar hech narsani o'zgartirmasangiz</small></div>
    <div class="c4 card stat-card ${od.length ? 'warn-card' : ''}"><span class="eyebrow">Muddati kelgan</span><b class="big">${od.length}</b>${od.length ? `<button class="btn primary sm" data-act="sub:payall">Hammasini to'landi deb belgilash</button>` : '<small class="muted">Hammasi vaqtida 👍</small>'}</div>
  </div>
  ${list.length ? `<div class="rows card">${list.map((s) => {
    const dd = diffDays(s.nextDate, t);
    const status = s.active === false ? '<span class="pill">Pauza</span>' : dd < 0 ? `<span class="pill neg">${-dd} kun kechikkan</span>` : dd === 0 ? '<span class="pill warn">Bugun</span>' : dd <= 7 ? `<span class="pill warn">${dd} kun qoldi</span>` : `<span class="pill">${fmtDate(s.nextDate)}</span>`;
    return `<div class="row static sub ${s.active === false ? 'off' : ''}"><span class="row-ico" style="--c:#818cf8">${s.icon || '🔁'}</span>
      <span class="row-main"><b>${esc(s.name)}</b><small>${CYCLES[s.cycle]} · ${esc(money(monthlyEq(s)))}/oy ekv.</small></span>
      <span class="sub-r">${status}<b>${money(s.amount)}</b></span>
      <span class="sub-btns">${s.active !== false && dd <= 3 ? `<button class="btn primary sm" data-act="sub:pay" data-id="${s.id}">To'landi</button>` : ''}<button class="icon-btn" data-act="sub:edit" data-id="${s.id}" aria-label="Tahrirlash">${icon('edit', 16)}</button></span></div>`;
  }).join('')}</div>` : empty('🔁', "Takroriy to'lov yo'q", "Internet, ijara, obuna, kredit — qo'shib qo'ying, vaqti kelganda eslataman.")}
  ${monthly > 0 ? `<section class="card tip"><h3>${icon('sparkles', 18)} Tejash imkoniyati</h3><p class="muted">Eng qimmat 1 ta obunani bekor qilsangiz, yiliga <b>${money(Math.max(...state.subs.filter((s) => s.active !== false).map((s) => monthlyEq(s))) * 12)}</b> tejaladi. Oxirgi marta qachon ishlatdingiz?</p></section>` : ''}`;
}

function subSheet(s = null) {
  const v = s || { name: '', amount: 0, cycle: 'monthly', nextDate: today(), categoryId: 'c_subs', accountId: state.accounts[0]?.id, icon: '🔁', active: true };
  sheet({
    title: s ? "To'lovni tahrirlash" : "Yangi takroriy to'lov",
    body: `${fText('Nomi', 'name', { value: v.name, placeholder: 'Masalan: Internet, Netflix, Ijara', focus: !s })}
      ${fAmount('Summa', 'amount', { value: v.amount, big: true })}
      <div class="grid-2">${fSelect('Davriyligi', 'cycle', Object.entries(CYCLES), v.cycle)}${fDate('Keyingi to\'lov', 'nextDate', v.nextDate)}</div>
      <div class="grid-2">${fSelect('Kategoriya', 'categoryId', cats('expense').map((c) => [c.id, `${c.icon} ${c.name}`]), v.categoryId)}${fSelect('Hisob', 'accountId', state.accounts.map((a) => [a.id, `${a.icon} ${a.name}`]), v.accountId)}</div>
      ${fEmoji('icon', v.icon, ['🔁', '🌐', '📺', '🎵', '🏠', '💳', '📱', '🎓', '🏋️', '☁️', '🚗', '🛡️'])}
      ${s ? `<label class="check"><input type="checkbox" name="active" ${s.active !== false ? 'checked' : ''}><span>Faol (o'chirsangiz — pauza)</span></label>` : ''}`,
    danger: s ? { label: "O'chirish", fn: () => ((state.subs = state.subs.filter((x) => x.id !== s.id)), commit(), toast("O'chirildi", { type: 'ok' })) } : null,
    onSubmit(d) {
      const amount = amt(d.amount);
      if (!d.name.trim() || !(amount > 0)) return toast('Nom va summani kiriting', { type: 'warn' }), false;
      const data = { name: d.name.trim(), amount, cycle: d.cycle, nextDate: d.nextDate, categoryId: d.categoryId, accountId: d.accountId, icon: d.icon, active: s ? d.active === 'on' : true };
      if (s) Object.assign(s, data);
      else state.subs.push({ id: uid(), ...data });
      commit();
      toast('Saqlandi', { type: 'ok' });
    },
  });
}
actions['sub:new'] = () => subSheet();
actions['sub:edit'] = (el) => subSheet(state.subs.find((s) => s.id === el.dataset.id));
actions['sub:pay'] = (el) => {
  const s = state.subs.find((x) => x.id === el.dataset.id);
  pay(s);
  toast(`${s.name}: to'landi, keyingisi ${fmtDate(s.nextDate)}`, { type: 'ok' });
};
actions['sub:payall'] = () => {
  const od = overdueSubs();
  od.forEach((s) => {
    let guard = 0;
    while (diffDays(s.nextDate, today()) <= 0 && guard++ < 1) pay(s);
  });
  toast(`${od.length} ta to'lov yozildi`, { type: 'ok' });
};
