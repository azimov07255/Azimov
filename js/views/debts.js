import { state, commit, debtPaid, debtLeft, iOwe, owedToMe, addTx, balanceOf } from '../store.js';
import { esc, uid, today, diffDays, fmtDate, sum } from '../utils.js';
import { money, pct } from '../fmt.js';
import { icon } from '../icons.js';
import { actions, sheet, fText, fAmount, fDate, fSeg, fSelect, progress, card, empty, toast, amt } from '../ui.js';

export function renderDebts() {
  const t = today();
  const borrowed = state.debts.filter((d) => d.type === 'borrowed');
  const lent = state.debts.filter((d) => d.type === 'lent');
  const item = (d) => {
    const left = debtLeft(d);
    const p = d.amount ? debtPaid(d) / d.amount : 0;
    const dd = d.due ? diffDays(d.due, t) : null;
    const status = left <= 0 ? '<span class="pill pos">✓ Yopilgan</span>' : dd === null ? '' : dd < 0 ? `<span class="pill neg">${-dd} kun kechikkan</span>` : dd <= 7 ? `<span class="pill warn">${dd === 0 ? 'Bugun' : dd + ' kun qoldi'}</span>` : `<span class="pill">${fmtDate(d.due)}</span>`;
    return `<article class="debt ${left <= 0 ? 'closed' : ''}">
      <div class="debt-top"><span class="row-ico" style="--c:${d.type === 'borrowed' ? '#fb7185' : '#34d399'}">${d.type === 'borrowed' ? '📤' : '📥'}</span>
        <div class="debt-main"><b>${esc(d.person)}</b><small class="muted">${esc(d.note || '')} ${d.date ? '· ' + fmtDate(d.date) : ''}</small></div>
        <div class="debt-amt"><b class="${d.type === 'borrowed' ? 'neg' : 'pos'}">${money(left)}</b><small class="muted">/ ${money(d.amount)}</small></div></div>
      ${progress(p, { color: d.type === 'borrowed' ? 'var(--neg)' : 'var(--pos)', h: 6 })}
      <div class="debt-foot">${status}<span class="grow"></span>
        ${left > 0 ? `<button class="btn primary sm" data-act="debt:pay" data-id="${d.id}">${d.type === 'borrowed' ? "To'lash" : 'Qaytardi'}</button>` : ''}
        <button class="btn ghost sm" data-act="debt:edit" data-id="${d.id}">${icon('edit', 16)}</button></div>
    </article>`;
  };
  const sortFn = (a, b) => (debtLeft(a) <= 0) - (debtLeft(b) <= 0) || (a.due || '9') .localeCompare(b.due || '9');
  const small = borrowed.filter((d) => debtLeft(d) > 0).sort((a, b) => debtLeft(a) - debtLeft(b))[0];
  return `
  <div class="page-head"><div><h1>Qarzlar</h1><p class="sub">Kim kimga qancha qarz — hammasi nazoratda</p></div><button class="btn primary" data-act="debt:new">${icon('plus', 18)} <span class="hide-m">Yangi qarz</span></button></div>
  <div class="grid">
    <div class="c4 card stat-card"><span class="eyebrow">Men qarzdorman</span><b class="big neg">${money(iOwe())}</b><small class="muted">${borrowed.filter((d) => debtLeft(d) > 0).length} ta faol</small></div>
    <div class="c4 card stat-card"><span class="eyebrow">Menga qarzdor</span><b class="big pos">${money(owedToMe())}</b><small class="muted">${lent.filter((d) => debtLeft(d) > 0).length} ta faol</small></div>
    <div class="c4 card stat-card"><span class="eyebrow">Sof holat</span><b class="big ${owedToMe() - iOwe() >= 0 ? 'pos' : 'neg'}">${money(owedToMe() - iOwe(), { sign: true })}</b><small class="muted">${small ? `💡 Avval «${esc(small.person)}» qarzini yoping (eng kichigi — "qor ko'chkisi" usuli)` : 'Qarz yuki yo\'q'}</small></div>
  </div>
  ${borrowed.length ? `<h3 class="sec">📤 Men qarzdorman</h3><div class="debts">${borrowed.sort(sortFn).map(item).join('')}</div>` : ''}
  ${lent.length ? `<h3 class="sec">📥 Menga qarzdor</h3><div class="debts">${lent.sort(sortFn).map(item).join('')}</div>` : ''}
  ${!state.debts.length ? empty('🤝', "Qarz yozuvlari yo'q", "Qarz olgan yoki bergan bo'lsangiz yozib qo'ying — muddat yaqinlashganda eslatib turaman.") : ''}`;
}

const accOpts = (withNone = true) => [...(withNone ? [['', "Hisobga ta'sir qilmasin"]] : []), ...state.accounts.map((a) => [a.id, `${a.icon} ${a.name}`])];

function debtSheet(d = null) {
  const v = d || { type: 'borrowed', person: '', amount: 0, date: today(), due: '', note: '' };
  sheet({
    title: d ? 'Qarzni tahrirlash' : 'Yangi qarz',
    body: `${fSeg('type', [['borrowed', 'Men qarz oldim', 'neg'], ['lent', 'Men qarz berdim', 'pos']], v.type)}
      ${fText('Kim bilan', 'person', { value: v.person, placeholder: 'Ism', focus: !d })}
      ${fAmount('Summa', 'amount', { value: v.amount, big: true })}
      <div class="grid-2">${fDate('Sana', 'date', v.date)}${fDate('Qaytarish muddati', 'due', v.due, { clearable: true })}</div>
      ${fText('Izoh', 'note', { value: v.note, placeholder: 'Ixtiyoriy' })}
      ${d ? '' : fSelect('Hisobga yozish', 'accountId', accOpts(), '')}`,
    danger: d ? { label: "O'chirish", fn: () => ((state.debts = state.debts.filter((x) => x.id !== d.id)), commit(), toast("O'chirildi", { type: 'ok' })) } : null,
    onSubmit(f) {
      const amount = amt(f.amount);
      if (!f.person.trim() || !(amount > 0)) return toast('Ism va summani kiriting', { type: 'warn' }), false;
      const data = { type: f.type, person: f.person.trim(), amount, date: f.date, due: f.due || '', note: f.note.trim() };
      if (d) Object.assign(d, data);
      else {
        state.debts.push({ id: uid(), payments: [], ...data });
        if (f.accountId) addTx({ type: f.type === 'borrowed' ? 'income' : 'expense', amount, accountId: f.accountId, categoryId: f.type === 'borrowed' ? 'i_other' : 'c_other', date: f.date, note: f.type === 'borrowed' ? `Qarz: ${data.person}` : `Qarz berildi: ${data.person}` });
      }
      commit();
      toast('Saqlandi', { type: 'ok' });
    },
  });
}
actions['debt:new'] = () => debtSheet();
actions['debt:edit'] = (el) => debtSheet(state.debts.find((d) => d.id === el.dataset.id));
actions['debt:pay'] = (el) => {
  const d = state.debts.find((x) => x.id === el.dataset.id);
  const left = debtLeft(d);
  sheet({
    title: d.type === 'borrowed' ? `${esc(d.person)}ga to'lov` : `${esc(d.person)} qaytardi`,
    submit: 'Tasdiqlash',
    body: `<p class="muted small">Qoldiq: <b>${money(left)}</b></p>${fAmount('Summa', 'amount', { value: left, big: true, focus: true })}${fDate('Sana', 'date', today())}${fSelect('Hisobga yozish', 'accountId', accOpts(), state.accounts[0]?.id || '')}`,
    onSubmit(f) {
      const a = Math.min(amt(f.amount), left);
      if (!(a > 0)) return toast('Summani kiriting', { type: 'warn' }), false;
      d.payments = [...(d.payments || []), { id: uid(), amount: a, date: f.date }];
      if (f.accountId) addTx({ type: d.type === 'borrowed' ? 'expense' : 'income', amount: a, accountId: f.accountId, categoryId: d.type === 'borrowed' ? 'c_debt' : 'i_other', date: f.date, note: d.type === 'borrowed' ? `Qarz to'lovi: ${d.person}` : `Qaytarildi: ${d.person}` });
      commit();
      toast(debtLeft(d) <= 0 ? '🎉 Qarz yopildi!' : 'Saqlandi', { type: 'ok' });
    },
  });
};
