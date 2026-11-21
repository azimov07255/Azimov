import { state, commit, acctOf } from '../store.js';
import { esc, uid, today, addDays, monthKey, fmtDate, sum } from '../utils.js';
import { money, short, amtText, curCode, isHidden } from '../fmt.js';
import { icon } from '../icons.js';
import { bars } from '../charts.js';
import { COLORS } from '../data.js';
import { actions, sheet, fText, fAmount, fDate, fSelect, fEmoji, fColor, fSeg, card, empty, toast, amt, progress } from '../ui.js';
import {
  DOW_SHORT, DOW_LONG, WEEK_ORDER, weekStart, dowOf, getEntry, activeStreams, streamById, typical, isScheduled, suggestAmount, applyEntry,
  unpaidDates, unpaidSum, totalUnpaid, settle, net, weekModel, missedDays, monthTotals, incomeCats, dayStatus,
} from '../streams.js';

let viewWeek = null; // Monday (YYYY-MM-DD) of the week being looked at
const curWeek = () => weekStart(today());
const dayLabel = (d) => `${DOW_LONG[dowOf(d)]}, ${fmtDate(d)}`;
// compact amount for the narrow day tiles: 65k, 77.5k
const tileAmt = (v) => (isHidden() ? '••' : curCode() === 'UZS' && v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : short(v));
const amountText = (st) => (st.mode === 'range' ? `${short(st.min)}–${short(st.max)}` : money(st.amount));
const daysText = (st) => {
  const d = WEEK_ORDER.filter((x) => st.days.includes(x));
  if (d.length === 7) return 'Har kuni';
  if (d.join() === '1,2,3,4,5') return 'Dush–Jum';
  if (d.join() === '1,2,3,4,5,6') return 'Dush–Shan';
  return d.map((x) => DOW_SHORT[x]).join(', ');
};
const payText = (st) => (st.payMode === 'weekly' ? `haftalik jamlanadi (${DOW_LONG[st.payDay ?? 6]})` : 'har kuni olinadi');

/* ---------- small renderers ---------- */
function entryPill(e) {
  if (!e) return '';
  if (e.s === 'paid') return `<span class="pill pos">✅ Oldim ${money(e.a)}</span>`;
  if (e.s === 'earned' && e.lunch) return `<span class="pill warn">🕒 Ishladim ${money(e.a)} · 🍽️ tushlik −${money(e.lunch)} · qoldi ${money(net(e))}</span>`;
  if (e.s === 'earned') return `<span class="pill warn">🕒 Ishladim ${money(e.a)} · olinmagan</span>`;
  return `<span class="pill">🚫 Dam${e.note ? ' · ' + esc(e.note) : ''}</span>`;
}

function todayRow(st) {
  const t = today();
  const e = getEntry(st.id, t);
  const sch = isScheduled(st, t);
  const primary = st.payMode === 'weekly' ? 'earned' : 'paid';
  let right;
  if (e) right = `<button class="dq-done" data-act="daily:day" data-sid="${st.id}" data-date="${t}">${entryPill(e)}<span class="muted small">o'zgartirish</span></button>`;
  else if (!sch) right = `<div class="dq"><span class="muted small">Dam olish kuni</span><button class="dq-b earned" data-act="daily:quick" data-sid="${st.id}" data-date="${t}" data-s="earned">+ Ishladim</button></div>`;
  else
    right = `<div class="dq">
      <button class="dq-b paid ${primary === 'paid' ? 'main' : ''}" data-act="daily:quick" data-sid="${st.id}" data-date="${t}" data-s="paid">✅ Oldim</button>
      <button class="dq-b earned ${primary === 'earned' ? 'main' : ''}" data-act="daily:quick" data-sid="${st.id}" data-date="${t}" data-s="earned">🕒 Ishladim</button>
      <button class="dq-b off" data-act="daily:quick" data-sid="${st.id}" data-date="${t}" data-s="off">🚫 Dam</button></div>`;
  return `<div class="trow" style="--c:${st.color}">
    <div class="trow-top"><span class="row-ico">${st.icon}</span>
    <div class="trow-m"><b>${esc(st.name)}</b><small class="muted">${sch ? amountText(st) + ' · ' + payText(st) : 'Bugun ish kuni emas'}</small></div></div>${right}</div>`;
}

function tile(st, d) {
  const e = d.entry;
  const label = { paid: '✅', earned: '🕒', off: '🚫', missed: '❓', pending: '●', planned: '·', rest: '' }[d.status];
  const val = e ? (e.s === 'off' ? 'dam' : tileAmt(e.s === 'earned' ? net(e) : e.a)) : d.status === 'planned' || d.status === 'pending' ? tileAmt(typical(st)) : '';
  return `<button class="dtile ${d.status} ${d.isToday ? 'today' : ''}" data-act="daily:day" data-sid="${st.id}" data-date="${d.date}" aria-label="${esc(dayLabel(d.date))}">
    <span class="dw">${DOW_SHORT[d.dow]}</span><span class="dn">${Number(d.date.slice(8))}</span><span class="di">${label}</span><b>${val}</b></button>`;
}

function streamCard(st, ws) {
  const w = weekModel(st, ws);
  const un = unpaidSum(st);
  const ud = unpaidDates(st).length;
  return `<section class="card stream ${st.active === false ? 'paused' : ''}" style="--c:${st.color}">
    <div class="st-h"><span class="row-ico">${st.icon}</span>
      <div class="grow"><b>${esc(st.name)}${st.active === false ? ' <span class="pill">Pauza</span>' : ''}</b><small class="muted">${daysText(st)} · ${amountText(st)} · ${payText(st)}</small></div>
      <button class="icon-btn" data-act="daily:edit" data-sid="${st.id}" aria-label="Tahrirlash">${icon('edit', 16)}</button></div>
    <div class="dweek">${w.days.map((d) => tile(st, d)).join('')}</div>
    <div class="st-sum">
      <div><small>Olindi</small><b class="pos">${money(w.paid)}</b></div>
      <div><small>Olinmagan</small><b class="${w.earned ? 'warn' : ''}">${money(w.earned)}</b></div>
      <div><small>Kutilmoqda</small><b>${money(w.expected)}</b></div>
      <div><small>Ishladi / dam</small><b>${w.worked} / ${w.off}</b></div>
    </div>
    ${un > 0 ? `<button class="btn primary block" data-act="daily:settle" data-sid="${st.id}">💰 Hisob-kitob: ${money(un)} oldim <small>(${ud} kun)</small></button>` : ''}
  </section>`;
}

/* ---------- page ---------- */
export function renderDaily() {
  const t = today();
  const ws = viewWeek || curWeek();
  const isCur = ws === curWeek();
  const list = state.streams || [];
  const act = activeStreams();
  const we = addDays(ws, 6);
  const range = `${Number(ws.slice(8))}${ws.slice(5, 7) !== we.slice(5, 7) ? '-' + fmtDate(ws).split('-')[1] : ''}–${fmtDate(we)}`;

  if (!list.length)
    return `<div class="page-head"><div><h1>Kunlik daromad</h1><p class="sub">Dadangiz yoki akangizdan har kuni oladigan pulni shu yerda hisoblang</p></div></div>
    ${card('', empty('🗓️', "Hali manba yo'q", "Masalan: «Dadam — har kuni 70 000» yoki «Akam — kunlik 75–80 ming, haftada bir oladi». Ish kunlarini, summani va qachon olinishini o'zingiz tanlaysiz.", `<button class="btn primary" data-act="daily:new">${icon('plus', 16)} Birinchi manbani qo'shish</button>`))}`;

  const missed = missedDays();
  const weekPaid = sum(act, (s) => weekModel(s, ws).paid);
  const weekEarned = sum(act, (s) => weekModel(s, ws).earned);
  const weekExp = sum(act, (s) => weekModel(s, ws).expected);
  const mt = monthTotals(monthKey(t));

  // last 8 weeks: received vs still-owed
  const weeks = Array.from({ length: 8 }, (_, i) => addDays(curWeek(), -7 * (7 - i)));
  const bars8 = weeks.map((w) => ({ label: String(Number(w.slice(8))), a: sum(act, (s) => weekModel(s, w).paid), b: sum(act, (s) => weekModel(s, w).earned) }));

  return `
  <div class="page-head"><div><h1>Kunlik daromad</h1><p class="sub">Har kuni oldingizmi, ishladingizmi yoki dam oldingizmi — belgilab boring</p></div>
    <button class="btn primary" data-act="daily:new">${icon('plus', 18)} <span class="hide-m">Manba</span></button></div>
  ${missed.length ? `<div class="banner warn" data-act="daily:missed" role="button" style="cursor:pointer">${icon('bell', 18)}<span><b>${missed.length} ta kun belgilanmagan</b> — bosib to'ldiring</span>${icon('chevR', 18)}</div>` : ''}
  ${isCur ? card(`${icon('calendar', 18)} Bugun · ${dayLabel(t)}`, `<div class="trows">${act.map(todayRow).join('') || '<p class="muted">Faol manba yo\'q</p>'}</div>`, { cls: 'today-card' }) : ''}
  <div class="month-nav card">
    <button class="icon-btn" data-act="daily:week" data-d="${addDays(ws, -7)}" aria-label="Oldingi hafta">${icon('chevL', 20)}</button>
    <div class="mn-c"><b>${isCur ? 'Bu hafta' : 'Hafta'} · ${range}</b>
      <div class="mn-sum"><span class="pos">Olindi ${short(weekPaid)}</span><span class="warn">Olinmagan ${short(weekEarned)}</span><span class="muted">Kutilmoqda ${short(weekExp)}</span></div></div>
    <button class="icon-btn" data-act="daily:week" data-d="${addDays(ws, 7)}" aria-label="Keyingi hafta">${icon('chevR', 20)}</button>
  </div>
  ${!isCur ? `<button class="btn ghost sm" style="margin-bottom:12px" data-act="daily:week" data-d="${curWeek()}">Bu haftaga qaytish</button>` : ''}
  <div class="streams">${list.map((s) => streamCard(s, ws)).join('')}</div>
  <div class="grid">
    ${card(`${icon('trending', 18)} Oxirgi 8 hafta`, `<div class="chart-wrap">${bars(bars8, { height: 170, aColor: 'var(--pos)', bColor: 'var(--warn)' })}</div><div class="legend-inline"><span><i style="background:var(--pos)"></i>Olingan</span><span><i style="background:var(--warn)"></i>Olinmagan</span></div>`, { cls: 'c6' })}
    ${card(`${icon('sparkles', 18)} Shu oy`, `<div class="calc-rows"><div class="cr big"><span>Olingan</span><b>${money(mt.paid)}</b></div><div class="cr"><span>Olinmagan (shu oy)</span><b class="warn">${money(mt.earned)}</b></div><div class="cr"><span>Ishlangan kunlar</span><b>${mt.days}</b></div><div class="cr"><span>Dam / bormagan kunlar</span><b>${mt.off}</b></div>${totalUnpaid() > 0 ? `<div class="cr"><span>Jami olinmagan (hammasi)</span><b class="warn">${money(totalUnpaid())}</b></div>` : ''}</div>`, { cls: 'c6' })}
  </div>`;
}

/* ---------- dashboard widget ---------- */
export function dailyWidget() {
  const act = activeStreams();
  if (!(state.streams || []).length)
    return `<a class="card dwidget empty-w" href="#/daily"><span class="row-ico" style="--c:#fbbf24">🗓️</span><div><b>Kunlik daromad</b><small class="muted">Dadam / akamdan kunlik oladigan pulni hisoblang</small></div>${icon('chevR', 18)}</a>`;
  const un = totalUnpaid();
  const ws = curWeek();
  const paid = sum(act, (s) => weekModel(s, ws).paid);
  return card(`${icon('calendar', 18)} Bugun — kunlik daromad`, `<div class="trows">${act.map(todayRow).join('') || ''}</div>
    <div class="split dw-sum"><span>Bu hafta olindi: <b class="pos">${money(paid)}</b></span>${un > 0 ? `<span>Olinmagan: <b class="warn">${money(un)}</b></span>` : ''}</div>`, { cls: 'dwidget', action: `<a class="link" href="#/daily">Hafta</a>` });
}

/* ---------- actions ---------- */
actions['daily:week'] = (el) => {
  viewWeek = el.dataset.d;
  actions._render();
};

actions['daily:quick'] = (el) => {
  const st = streamById(el.dataset.sid);
  const date = el.dataset.date;
  const s = el.dataset.s;
  if (!st) return;
  if (s !== 'off' && st.mode === 'range') return daySheet(st, date, s); // amount varies: ask
  const prev = getEntry(st.id, date);
  applyEntry(st, date, s === 'off' ? { s } : { s, a: typical(st) });
  const msg = s === 'paid' ? `✅ ${st.name}: ${money(typical(st), { force: true })} olindi` : s === 'earned' ? `🕒 ${st.name}: ishladi, hali olinmadi` : `🚫 ${st.name}: dam kuni`;
  toast(msg, { type: 'ok', action: { label: 'Bekor qilish', fn: () => applyEntry(st, date, prev ? { s: prev.s, a: prev.a, lunch: prev.lunch, note: prev.note } : null) } });
};

actions['daily:day'] = (el) => {
  const st = streamById(el.dataset.sid);
  if (st) daySheet(st, el.dataset.date);
};

function daySheet(st, date, preset) {
  const e = getEntry(st.id, date);
  const future = date > today();
  const cur = preset || e?.s || (st.payMode === 'weekly' ? 'earned' : 'paid');
  const start = e?.s === 'off' ? suggestAmount(st) : e?.a || suggestAmount(st);
  const chips = st.mode === 'range' ? [st.min, Math.round((st.min + st.max) / 2 / 500) * 500, st.max] : [];
  const opts = [...(future ? [] : [['paid', '✅ Oldim', 'pos'], ['earned', '🕒 Hali olmadim']]), ['off', '🚫 Dam / bormadim']];
  const accOpts = state.accounts.map((a) => [a.id, `${a.icon} ${a.name}`]);
  sheet({
    title: `${st.icon} ${esc(st.name)}`,
    body: `<p class="muted small" style="margin-top:-4px">${esc(dayLabel(date))}${isScheduled(st, date) ? '' : ' · odatda dam olish kuni'}</p>
      ${fSeg('s', opts, opts.some((o) => o[0] === cur) ? cur : 'off')}
      <div id="dmAmt">${fAmount('Summa (kunlik ish haqi)', 'a', { value: start, big: true })}
        ${chips.length ? `<div class="quick-amts">${chips.map((c) => `<button type="button" class="hint" data-fill="${c}">${money(c, { force: true })}</button>`).join('')}</div>` : ''}
        <div id="dmLunch" class="lunch-box">${fAmount('🍽️ Tushlik puli (shu kuni olganim)', 'lunch', { value: e?.lunch || 0 })}
          <div class="lunch-amts">${[10000, 20000, 30000].map((c) => `<button type="button" class="hint" data-lunch="${c}">${money(c, { force: true })}</button>`).join('')}<button type="button" class="hint" data-lunch="0">Olmadim</button></div>
          <div class="lunch-left" id="dmLeft"></div></div>
        <div id="dmAcc">${fSelect('Qaysi hisobga tushdi', 'accountId', accOpts, e?.tx ? state.transactions.find((t) => t.id === e.tx)?.accountId || st.accountId : st.accountId)}</div></div>
      ${fText('Izoh (ixtiyoriy)', 'note', { value: e?.note || '', placeholder: 'Masalan: kasal edim, bayram, qo\'shimcha ish' })}`,
    danger: e ? { label: 'Belgini olib tashlash', confirm: "Bu kun belgisi (va u yaratgan kirim) o'chiriladi.", fn: () => applyEntry(st, date, null) } : null,
    onMount(form) {
      const upd = () => {
        const s = form.s.value;
        form.querySelector('#dmAmt').hidden = s === 'off';
        form.querySelector('#dmAcc').hidden = s === 'off';
        form.querySelector('#dmLunch').hidden = s !== 'earned';
        left();
      };
      const left = () => {
        const a = amt(form.a.value);
        const l = Math.min(amt(form.lunch.value), a);
        const box = form.querySelector('#dmLeft');
        box.hidden = !(l > 0);
        box.innerHTML = `Tushlikdan keyin qoladi: <b>${money(Math.max(0, a - l), { force: true })}</b> <small>(hali olinmagan)</small>`;
      };
      form.addEventListener('change', upd);
      form.addEventListener('input', left);
      form.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-fill]');
        if (b) form.a.value = amtText(Number(b.dataset.fill));
        const l = ev.target.closest('[data-lunch]');
        if (l) form.lunch.value = Number(l.dataset.lunch) ? amtText(Number(l.dataset.lunch)) : '';
        left();
      });
      upd();
    },
    onSubmit(d) {
      if (d.s === 'off') return applyEntry(st, date, { s: 'off', note: d.note.trim() }), toast('Dam kuni belgilandi', { type: 'ok' });
      const a = amt(d.a);
      if (!(a > 0)) return toast('Summani kiriting', { type: 'warn' }), false;
      const lunch = d.s === 'earned' ? Math.min(amt(d.lunch), a) : 0;
      applyEntry(st, date, { s: d.s, a, lunch, note: d.note.trim(), accountId: d.accountId });
      toast(d.s === 'paid' ? `✅ ${money(a, { force: true })} olindi` : lunch > 0 ? `🕒 Ishladi · tushlik ${money(lunch, { force: true })} olindi, ${money(a - lunch, { force: true })} qoldi` : '🕒 Ishladi deb belgilandi', { type: 'ok' });
    },
  });
}

/* ---------- weekly pay-out ("Hisob-kitob") ---------- */
actions['daily:settle'] = (el) => {
  const st = streamById(el.dataset.sid);
  if (!st) return;
  const log = state.dayLog[st.id] || {};
  const dates = unpaidDates(st);
  sheet({
    title: `💰 ${esc(st.name)}: hisob-kitob`,
    submit: 'Oldim — kirim yozilsin',
    body: `<p class="muted small">Olingan kunlarni belgilang. Hammasi bitta kirim sifatida yoziladi.</p>
      <div class="settle-rows">${dates.map((d) => `<label class="settle-row"><input type="checkbox" name="d_${d}" checked><span>${esc(dayLabel(d))}${log[d].lunch ? `<small class="muted"> · ${money(log[d].a)} − tushlik ${money(log[d].lunch)}</small>` : ''}</span><b>${money(net(log[d]))}</b></label>`).join('')}</div>
      <div class="total-line"><span>Jami</span><b id="stTotal">—</b></div>
      <div class="grid-2">${fSelect('Hisob', 'accountId', state.accounts.map((a) => [a.id, `${a.icon} ${a.name}`]), st.accountId)}${fDate('Olingan sana', 'date', today())}</div>`,
    onMount(form) {
      const upd = () => {
        const s = sum(dates.filter((d) => form['d_' + d]?.checked), (d) => net(log[d]));
        form.querySelector('#stTotal').textContent = money(s, { force: true });
      };
      form.addEventListener('change', upd);
      upd();
    },
    onSubmit(d, form) {
      const use = dates.filter((x) => form['d_' + x]?.checked);
      if (!use.length) return toast('Kamida bitta kunni belgilang', { type: 'warn' }), false;
      const total = settle(st, use, { accountId: d.accountId, date: d.date });
      toast(`💰 ${money(total, { force: true })} olindi va kirim yozildi`, { type: 'ok' });
    },
  });
};

/* ---------- fill in days that were never marked ---------- */
actions['daily:missed'] = () => {
  const items = missedDays();
  if (!items.length) return;
  const def = (st) => (st.payMode === 'weekly' ? 'earned' : 'paid');
  sheet({
    title: 'Belgilanmagan kunlar',
    wide: true,
    submit: 'Saqlash',
    body: `<p class="muted small">Har bir kun uchun nima bo'lganini tanlang. Hozircha tegilmasa, kun belgilanmay qoladi.</p>
      <div class="all-row"><button type="button" class="hint" data-all="paid">Hammasi: ✅ Oldim</button><button type="button" class="hint" data-all="earned">Hammasi: 🕒 Ishladim</button><button type="button" class="hint" data-all="off">Hammasi: 🚫 Dam</button><button type="button" class="hint" data-all="skip">Tegilmasin</button></div>
      <div class="miss-rows">${items.map(({ st, date }, i) => `<div class="miss" style="--c:${st.color}">
        <div class="miss-h"><span>${st.icon} <b>${esc(st.name)}</b></span><small class="muted">${esc(dayLabel(date))}</small></div>
        <div class="miss-b"><select class="input sm" name="s_${i}"><option value="skip">Tegilmasin</option><option value="paid" ${def(st) === 'paid' ? 'selected' : ''}>✅ Oldim</option><option value="earned" ${def(st) === 'earned' ? 'selected' : ''}>🕒 Ishladim</option><option value="off">🚫 Dam</option></select>
        <input class="input amt" inputmode="numeric" name="a_${i}" value="${amtText(suggestAmount(st))}"></div></div>`).join('')}</div>`,
    onMount(form) {
      form.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-all]');
        if (b) items.forEach((_, i) => (form['s_' + i].value = b.dataset.all));
      });
    },
    onSubmit(d) {
      let n = 0;
      items.forEach(({ st, date }, i) => {
        const s = d['s_' + i];
        if (s === 'skip') return;
        const a = amt(d['a_' + i]);
        if (s === 'off') applyEntry(st, date, { s });
        else if (a > 0) applyEntry(st, date, { s, a });
        else return;
        n++;
      });
      toast(`${n} ta kun belgilandi ✅`, { type: 'ok' });
    },
  });
};

/* ---------- manage sources ---------- */
actions['daily:new'] = () => streamSheet();
actions['daily:edit'] = (el) => streamSheet(streamById(el.dataset.sid));

function streamSheet(st = null) {
  const v = st || { name: '', icon: '💵', color: COLORS[(state.streams || []).length % COLORS.length], days: [1, 2, 3, 4, 5], mode: 'fixed', amount: 0, min: 0, max: 0, payMode: 'daily', payDay: 6, accountId: state.accounts[0]?.id, categoryId: 'i_salary', start: today(), active: true };
  const ic = incomeCats();
  sheet({
    title: st ? 'Manbani tahrirlash' : 'Yangi daromad manbasi',
    wide: true,
    body: `${fText('Kimdan / nima?', 'name', { value: v.name, placeholder: 'Masalan: Dadam, Akam (ish haqi)', focus: !st })}
      <div class="field"><span>Summa turi</span>${fSeg('mode', [['fixed', "Qat'iy summa"], ['range', 'Oraliq (min–max)']], v.mode)}</div>
      <div id="fxBox">${fAmount('Kunlik summa', 'amount', { value: v.amount })}</div>
      <div id="rgBox" class="grid-2">${fAmount('Eng kam', 'min', { value: v.min })}${fAmount('Eng ko\'p', 'max', { value: v.max })}</div>
      <div class="field"><span>Ish kunlari</span><div class="chips">${WEEK_ORDER.map((d) => `<label class="chip-opt" style="--c:var(--accent)"><input type="checkbox" name="days" value="${d}" ${v.days.includes(d) ? 'checked' : ''}><span>${DOW_SHORT[d]}</span></label>`).join('')}</div></div>
      <div class="field"><span>Pul qanday olinadi?</span>${fSeg('payMode', [['daily', 'Har kuni qo\'limga tegadi'], ['weekly', 'Haftalik jamlab olaman']], v.payMode)}</div>
      <div id="pdBox">${fSelect("Haftalik pulni qaysi kuni olaman", 'payDay', WEEK_ORDER.map((d) => [d, DOW_LONG[d]]), v.payDay ?? 6)}</div>
      <div class="grid-2">${fSelect('Hisob', 'accountId', state.accounts.map((a) => [a.id, `${a.icon} ${a.name}`]), v.accountId)}${fSelect('Daromad kategoriyasi', 'categoryId', ic.map((c) => [c.id, `${c.icon} ${c.name}`]), v.categoryId)}</div>
      ${fDate('Boshlangan sana', 'start', v.start)}
      ${fEmoji('icon', v.icon, ['💵', '👨', '👨‍🦱', '🧔', '👩', '🏪', '🛠️', '🚚', '💼', '🧑‍🍳', '🌾', '📦'])}${fColor('color', v.color)}
      ${st ? `<label class="check"><input type="checkbox" name="active" ${st.active !== false ? 'checked' : ''}><span>Faol (o'chirsangiz — pauza)</span></label>` : ''}`,
    danger: st ? { label: "O'chirish", confirm: "Manba va uning kunlik belgilari o'chadi. Yaratilgan kirimlar (tranzaksiyalar) saqlanib qoladi.", fn: () => ((state.streams = state.streams.filter((x) => x.id !== st.id)), delete state.dayLog[st.id], commit(), toast("O'chirildi", { type: 'ok' })) } : null,
    onMount(form) {
      const upd = () => {
        form.querySelector('#fxBox').hidden = form.mode.value !== 'fixed';
        form.querySelector('#rgBox').hidden = form.mode.value !== 'range';
        form.querySelector('#pdBox').hidden = form.payMode.value !== 'weekly';
      };
      form.addEventListener('change', upd);
      upd();
    },
    onSubmit(d, form) {
      const days = [...form.querySelectorAll('[name=days]:checked')].map((i) => Number(i.value));
      const data = { name: d.name.trim(), mode: d.mode, amount: amt(d.amount), min: amt(d.min), max: amt(d.max), days, payMode: d.payMode, payDay: Number(d.payDay), accountId: d.accountId, categoryId: d.categoryId, start: d.start, icon: d.icon, color: d.color };
      if (!data.name) return toast('Nomini kiriting', { type: 'warn' }), false;
      if (!days.length) return toast('Kamida bitta ish kunini tanlang', { type: 'warn' }), false;
      if (data.mode === 'fixed' && !(data.amount > 0)) return toast('Kunlik summani kiriting', { type: 'warn' }), false;
      if (data.mode === 'range' && !(data.min > 0 && data.max >= data.min)) return toast("Eng kam va eng ko'p summani to'g'ri kiriting", { type: 'warn' }), false;
      if (st) Object.assign(st, data, { active: d.active === 'on' });
      else (state.streams ||= []).push({ id: uid(), active: true, ...data });
      commit();
      toast('Saqlandi', { type: 'ok' });
    },
  });
}
