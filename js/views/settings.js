import { state, commit, resetAll, replaceState, balanceOf, addTx, sortedTx, catOf, acctOf } from '../store.js';
import { esc, uid, download, today } from '../utils.js';
import { money, currencies, parseAmt } from '../fmt.js';
import { icon } from '../icons.js';
import { ACCOUNT_TYPES, COLORS, EMOJI } from '../data.js';
import { actions, sheet, fText, fAmount, fSelect, fEmoji, fColor, fSeg, toast, confirmBox, amt, card } from '../ui.js';
import { loadDemo } from './demo.js';

export function renderSettings() {
  const S = state.settings;
  const custom = state.categories.filter((c) => c.custom);
  return `
  <div class="page-head"><div><h1>Sozlamalar</h1><p class="sub">Hisoblar, kategoriyalar va ma'lumotlar</p></div></div>
  <div class="grid">
    ${card('Profil va ko\'rinish', `
      <label class="field"><span>Ismingiz</span><input class="input" id="setName" value="${esc(S.name)}" placeholder="Ism"></label>
      <div class="grid-2">
        <label class="field"><span>Valyuta</span><select class="input" id="setCur">${currencies.map((c) => `<option value="${c.code}" ${S.currency === c.code ? 'selected' : ''}>${c.code} — ${c.name}</option>`).join('')}</select></label>
        <label class="field"><span>1 USD = so'm</span><input class="input" type="number" id="setRate" value="${S.usdRate}"></label>
      </div>
      <div class="field"><span>Mavzu</span><div class="seg" id="setTheme">${[['dark', '🌙 Qorong\'i'], ['light', '☀️ Yorug\''], ['auto', '🖥️ Avto']].map(([v, l]) => `<label><input type="radio" name="theme" value="${v}" ${S.theme === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
      <label class="check"><input type="checkbox" id="setHide" ${S.hide ? 'checked' : ''}><span>Summalarni yashirish (maxfiylik rejimi)</span></label>`, { cls: 'c6' })}
    ${card('Hisoblar', `<div class="rows">${state.accounts.map((a) => `<button class="row" data-act="acct:edit" data-id="${a.id}"><span class="row-ico" style="--c:${a.color}">${a.icon}</span><span class="row-main"><b>${esc(a.name)}</b><small>${ACCOUNT_TYPES.find((t) => t[0] === a.type)?.[1] || ''}</small></span><span class="amount">${money(balanceOf(a.id))}</span></button>`).join('')}</div><button class="btn ghost" data-act="acct:new">${icon('plus', 16)} Hisob qo'shish</button>`, { cls: 'c6' })}
    ${card('Kategoriyalar', `${custom.length ? `<div class="rows">${custom.map((c) => `<button class="row" data-act="cat:edit" data-id="${c.id}"><span class="row-ico" style="--c:${c.color}">${c.icon}</span><span class="row-main"><b>${esc(c.name)}</b><small>${c.type === 'income' ? 'Daromad' : 'Xarajat'}</small></span>${icon('chevR', 16)}</button>`).join('')}</div>` : `<p class="muted pad">Standart ${state.categories.length} ta kategoriya mavjud. O'zingizniki qo'shishingiz mumkin.</p>`}<button class="btn ghost" data-act="cat:new">${icon('plus', 16)} Kategoriya qo'shish</button>`, { cls: 'c6' })}
    ${card("Ma'lumotlar", `
      <p class="muted small">Ma'lumotlar faqat shu qurilmada (brauzer xotirasida) saqlanadi. Muntazam zaxira nusxa oling.</p>
      <div class="btn-col">
        <button class="btn ghost" data-act="data:export">${icon('download', 16)} Zaxira nusxa (JSON)</button>
        <button class="btn ghost" data-act="data:csv">${icon('download', 16)} Tranzaksiyalar (CSV)</button>
        <label class="btn ghost file">${icon('upload', 16)} Zaxiradan tiklash<input type="file" id="importFile" accept="application/json,.json" hidden></label>
        <button class="btn ghost" data-act="data:demo">${icon('sparkles', 16)} Demo ma'lumot yuklash</button>
        <button class="btn danger-ghost" data-act="data:reset">${icon('trash', 16)} Hammasini o'chirish</button>
      </div>`, { cls: 'c6' })}
  </div>
  <p class="muted center small foot">Azimov · Pul boshqaruvi · v1.0</p>`;
}

export function afterSettings(root) {
  root.querySelector('#setName')?.addEventListener('change', (e) => ((state.settings.name = e.target.value.trim()), commit()));
  root.querySelector('#setCur')?.addEventListener('change', (e) => ((state.settings.currency = e.target.value), commit()));
  root.querySelector('#setRate')?.addEventListener('change', (e) => ((state.settings.usdRate = Number(e.target.value) || 12700), commit()));
  root.querySelector('#setTheme')?.addEventListener('change', (e) => ((state.settings.theme = e.target.value), commit()));
  root.querySelector('#setHide')?.addEventListener('change', (e) => ((state.settings.hide = e.target.checked), commit()));
  root.querySelector('#importFile')?.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.transactions || !data.accounts) throw new Error('bad');
      if (await confirmBox("Joriy ma'lumotlar almashtiriladi. Davom etasizmi?", { ok: 'Tiklash' })) {
        replaceState(data);
        toast('Tiklandi ✅', { type: 'ok' });
      }
    } catch {
      toast("Fayl noto'g'ri", { type: 'bad' });
    }
  });
}

actions['data:export'] = () => {
  download(`azimov-zaxira-${today()}.json`, JSON.stringify(state, null, 2));
  toast('Zaxira nusxa yuklandi', { type: 'ok' });
};
actions['data:csv'] = () => {
  const esc2 = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const rows = [['Sana', 'Turi', 'Summa', 'Kategoriya', 'Hisob', 'Izoh'].join(',')];
  for (const t of sortedTx()) rows.push([t.date, t.type, t.amount, esc2(t.type === 'transfer' ? "O'tkazma" : catOf(t.categoryId).name), esc2(acctOf(t.accountId)?.name), esc2(t.note)].join(','));
  download(`azimov-tranzaksiyalar-${today()}.csv`, '﻿' + rows.join('\n'), 'text/csv;charset=utf-8');
};
actions['data:demo'] = async () => {
  if (state.transactions.length && !(await confirmBox("Demo ma'lumot joriy ma'lumotlaringizni almashtiradi. Davom etasizmi?", { ok: 'Yuklash' }))) return;
  loadDemo();
  toast("Demo ma'lumot yuklandi ✨", { type: 'ok' });
  location.hash = '#/dashboard';
};
actions['data:reset'] = async () => {
  if (await confirmBox("BARCHA ma'lumotlar o'chadi va qaytarib bo'lmaydi. Davom etasizmi?", { ok: "Ha, o'chirish" })) {
    resetAll();
    location.hash = '#/dashboard';
  }
};

/* ---------- accounts ---------- */
function acctSheet(a = null) {
  const v = a || { name: '', type: 'cash', icon: '💵', color: COLORS[state.accounts.length % COLORS.length], initial: 0 };
  sheet({
    title: a ? 'Hisobni tahrirlash' : 'Yangi hisob',
    body: `${fText('Nomi', 'name', { value: v.name, placeholder: 'Masalan: Uzcard, Naqd, Jamg\'arma', focus: !a })}
      ${fSelect('Turi', 'type', ACCOUNT_TYPES, v.type)}
      ${fAmount("Boshlang'ich qoldiq", 'initial', { value: v.initial })}
      ${fEmoji('icon', v.icon, ['💵', '💳', '🏦', '👛', '💰', '📱', '🏪', '🐖', '🪙', '💎'])}
      ${fColor('color', v.color)}`,
    danger: a && state.accounts.length > 1 ? { label: "O'chirish", confirm: "Hisob va unga bog'liq barcha tranzaksiyalar o'chadi. Davom etasizmi?", fn: () => ((state.transactions = state.transactions.filter((t) => t.accountId !== a.id && t.toAccountId !== a.id)), (state.accounts = state.accounts.filter((x) => x.id !== a.id)), commit(), toast("O'chirildi", { type: 'ok' })) } : null,
    onSubmit(d) {
      if (!d.name.trim()) return toast('Nomini kiriting', { type: 'warn' }), false;
      const data = { name: d.name.trim(), type: d.type, initial: amt(d.initial), icon: d.icon, color: d.color };
      if (a) Object.assign(a, data);
      else state.accounts.push({ id: uid(), ...data });
      commit();
      toast('Saqlandi', { type: 'ok' });
    },
  });
}
actions['acct:new'] = () => acctSheet();
actions['acct:edit'] = (el) => acctSheet(state.accounts.find((a) => a.id === el.dataset.id));

/* ---------- categories ---------- */
function catSheet(c = null) {
  const v = c || { name: '', icon: '🧾', color: COLORS[state.categories.length % COLORS.length], type: 'expense' };
  sheet({
    title: c ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya',
    body: `${c ? '' : fSeg('type', [['expense', 'Xarajat', 'neg'], ['income', 'Daromad', 'pos']], v.type)}
      ${fText('Nomi', 'name', { value: v.name, focus: !c })}
      ${fEmoji('icon', v.icon, EMOJI)}${fColor('color', v.color)}`,
    danger: c ? { label: "O'chirish", confirm: "Kategoriya o'chadi (tranzaksiyalar «Noma'lum» bo'lib qoladi).", fn: () => ((state.categories = state.categories.filter((x) => x.id !== c.id)), commit()) } : null,
    onSubmit(d) {
      if (!d.name.trim()) return toast('Nomini kiriting', { type: 'warn' }), false;
      const data = { name: d.name.trim(), icon: d.icon, color: d.color };
      if (c) Object.assign(c, data);
      else state.categories.push({ id: uid(), type: d.type, custom: true, grp: 'want', ...data });
      commit();
    },
  });
}
actions['cat:new'] = () => catSheet();
actions['cat:edit'] = (el) => catSheet(state.categories.find((c) => c.id === el.dataset.id));
