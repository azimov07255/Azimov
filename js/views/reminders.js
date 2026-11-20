import { state, commit } from '../store.js';
import { esc } from '../utils.js';
import { icon } from '../icons.js';
import { actions, toast, card, empty } from '../ui.js';
import { activeReminders, dismiss, permission, prefs, showSystem, supported } from '../notify.js';
import { enableNotifications, disablePush, currentSub, pushSupported, isIOS, isStandalone } from '../push.js';
import { sync } from '../sync.js';
import { DEFAULT_NOTIFY } from '../reminders-core.js';

let subscribed = false;
let checked = false;

export function renderReminders() {
  if (!checked) {
    checked = true;
    currentSub().then((s) => {
      subscribed = !!s;
      actions._render();
    });
  }
  const list = activeReminders();
  const P = prefs();
  const perm = permission();
  const row = (r) => `<div class="rem ${r.level}"><span class="ins-ico">${r.icon}</span><div class="rem-m"><b>${esc(r.title)}</b><p>${esc(r.body)}</p></div><a class="btn ghost sm" href="${r.href}">Ochish</a><button class="icon-btn" data-act="rem:dismiss" data-id="${esc(r.id)}" aria-label="Yopish">${icon('x', 16)}</button></div>`;

  let status;
  if (perm === 'unsupported') status = `<div class="banner warn">${icon('bell', 18)}<span>Bu brauzer bildirishnomalarni qo'llab-quvvatlamaydi.</span></div>`;
  else if (perm === 'denied') status = `<div class="banner warn">${icon('bell', 18)}<span>Bildirishnomalar bloklangan. Brauzer/telefon sozlamalaridan ruxsat bering.</span></div>`;
  else if (perm === 'granted')
    status = `<div class="rem-status"><span class="pill pos">🔔 Yoqilgan</span>${pushSupported() ? (subscribed ? `<span class="pill pos">📲 Ilova yopiq bo'lsa ham keladi</span>` : sync.user ? `<span class="pill warn">Yopiq ilova uchun «Yoqish» ni bosing</span>` : `<span class="pill warn">Yopiq ilova uchun akkaunt kerak</span>`) : ''}</div>`;
  else status = '';

  const iosNote = isIOS() && !isStandalone() ? `<div class="banner info">${icon('bell', 18)}<span><b>iPhone:</b> bildirishnoma faqat <b>bosh ekranga qo'shilgan</b> ilovada ishlaydi (iOS 16.4+). Safari → Ulashish → «Bosh ekranga qo'shish».</span></div>` : '';
  const sw = (key, label, sub = '') => `<label class="switch-row"><span><b>${label}</b>${sub ? `<small class="muted">${sub}</small>` : ''}</span><input type="checkbox" data-pref="${key}" ${P[key] ? 'checked' : ''}></label>`;
  const hours = (key, label) => `<label class="field inline"><span>${label}</span><select class="input sm" data-pref="${key}">${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${P[key] === h ? 'selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('')}</select></label>`;

  return `
  <div class="page-head"><div><h1>Eslatmalar</h1><p class="sub">To'lov, qarz, byudjet va oy yopish — hech narsa esdan chiqmasin</p></div></div>
  <div class="grid">
    ${card(`${icon('bell', 18)} Hozirgi eslatmalar ${list.length ? `<span class="pill warn">${list.length}</span>` : ''}`, list.length ? `<div class="rems">${list.map(row).join('')}</div>` : empty('🎉', "Hozircha eslatma yo'q", "Yaqin to'lov, qarz muddati yoki byudjet ogohlantirishi bo'lganda shu yerda chiqadi."), { cls: 'c6' })}
    <div class="c6 stack">
      ${card(`${icon('zap', 18)} Bildirishnomalar`, `${iosNote}${status}
        <div class="btn-col" style="margin:10px 0 4px">
          ${perm !== 'granted' || (pushSupported() && !subscribed && sync.user) ? `<button class="btn primary" data-act="rem:enable">${icon('bell', 16)} Bildirishnomalarni yoqish</button>` : ''}
          ${perm === 'granted' ? `<button class="btn ghost" data-act="rem:test">Sinov bildirishnomasi</button>` : ''}
          ${subscribed ? `<button class="btn danger-ghost" data-act="rem:off">Yopiq ilova bildirishnomasini o'chirish</button>` : ''}
          ${perm === 'granted' && pushSupported() && !sync.user ? `<button class="btn ghost" data-act="cloud:login">Akkauntga kirish (yopiq ilova uchun)</button>` : ''}
        </div>
        <p class="muted small">Ilova ochiq paytda bildirishnoma kelaveradi. <b>Ilova yopiq</b> bo'lganda ham kelishi uchun akkaunt (bulut) kerak — server vaqti-vaqti bilan tekshirib yuboradi.</p>`, {})}
      ${card('Nimalar haqida eslatilsin', `
        ${sw('subs', "Takroriy to'lovlar", 'Obuna, ijara, kredit')}
        ${sw('debts', 'Qarz muddati', "3 kun qolganda va kechikkanda")}
        ${sw('budget', 'Byudjet ogohlantirishi', "80% va 100% da")}
        ${sw('close', 'Oyni yopish', "Oy boshida")}
        ${sw('evening', "Kechki eslatma", "Bugun yozmagan bo'lsangiz")}
        <div class="grid-2" style="margin-top:12px">${hours('hour', "Kunlik eslatma vaqti")}${hours('eveningHour', 'Kechki eslatma vaqti')}</div>
        <label class="field inline"><span>To'lovdan necha kun oldin</span><select class="input sm" data-pref="daysBefore">${[0, 1, 2, 3, 5, 7].map((d) => `<option value="${d}" ${P.daysBefore === d ? 'selected' : ''}>${d === 0 ? 'Shu kuni' : d + ' kun'}</option>`).join('')}</select></label>`, {})}
    </div>
  </div>`;
}

export function afterReminders(root) {
  root.addEventListener('change', (e) => {
    const k = e.target.dataset?.pref;
    if (!k) return;
    state.settings.notify = { ...DEFAULT_NOTIFY, ...(state.settings.notify || {}), [k]: e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value) };
    commit();
  });
}

actions['rem:dismiss'] = (el) => {
  dismiss(el.dataset.id);
  commit();
};
actions['rem:enable'] = async () => {
  try {
    const r = await enableNotifications();
    subscribed = r.push;
    toast(r.push ? "Yoqildi: ilova yopiq bo'lsa ham eslatma keladi 🔔" : r.needLogin ? "Yoqildi (ilova ochiq paytda). Yopiq ilova uchun akkauntga kiring" : 'Bildirishnomalar yoqildi 🔔', { type: 'ok', ms: 6000 });
  } catch (e) {
    toast(e.message || 'Yoqib bo\'lmadi', { type: 'bad' });
  }
  actions._render();
};
actions['rem:off'] = async () => {
  await disablePush();
  subscribed = false;
  toast("Yopiq ilova bildirishnomasi o'chirildi", { type: 'ok' });
  actions._render();
};
actions['rem:test'] = async () => {
  await showSystem({ id: 'test:' + Date.now(), title: 'Azimov: sinov 🔔', body: "Bildirishnomalar ishlayapti!", href: '#/reminders' });
};
