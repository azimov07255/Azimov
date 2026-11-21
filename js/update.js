/**
 * "A new version is available" prompt.
 * Every release ships version.json {hash, version, notes}. The running app knows the hash it was loaded with
 * (js/version.js); when the server's hash differs it shows a bar with "Yangilash" and a "what's new" list.
 */
import { APP_HASH, APP_VERSION, APP_DATE } from './version.js';
import { actions, sheet, toast } from './ui.js';
import { esc, fmtDate } from './utils.js';
import { icon } from './icons.js';

export { APP_VERSION, APP_DATE, APP_HASH };
export const updateState = { available: false, info: null, lastCheck: 0 };

const LATER = 'azimov.upd.later';
const TRIES = 'azimov.upd.tries';
const ss = {
  get: (k) => {
    try {
      return sessionStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v);
    } catch {}
  },
};
const listeners = new Set();
export const onUpdateChange = (f) => listeners.add(f);
const emit = () => listeners.forEach((f) => f());

function bar() {
  let el = document.getElementById('updBar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'updBar';
    el.className = 'upd';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  return el;
}
function showBar() {
  const i = updateState.info;
  const el = bar();
  el.innerHTML = `<span class="upd-ico">🎉</span><div class="upd-m"><b>Yangi versiya tayyor</b><small>v${esc(i.version)}${i.released ? ' · ' + esc(fmtDate(i.released, true)) : ''}</small></div>
    <button class="btn primary sm" data-act="upd:apply">Yangilash</button>
    <button class="upd-x" data-act="upd:more" aria-label="Nima yangi?">${icon('sparkles', 18)}</button>
    <button class="upd-x" data-act="upd:later" aria-label="Keyinroq">${icon('x', 18)}</button>`;
  requestAnimationFrame(() => el.classList.add('in'));
}
function hideBar() {
  const el = document.getElementById('updBar');
  if (!el) return;
  el.classList.remove('in');
  setTimeout(() => el.remove(), 300);
}

export async function checkForUpdate({ manual = false } = {}) {
  try {
    const r = await fetch('version.json?' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    updateState.lastCheck = Date.now();
    if (j.hash && j.hash !== APP_HASH) {
      updateState.available = true;
      updateState.info = j;
      if (ss.get(LATER) !== j.hash || manual) showBar();
    } else {
      updateState.available = false;
      updateState.info = j;
      hideBar();
      if (manual) toast(`Siz eng so'nggi versiyadasiz (v${APP_VERSION}) ✅`, { type: 'ok' });
    }
    emit();
    return updateState.available;
  } catch (e) {
    if (manual) toast(navigator.onLine ? "Tekshirib bo'lmadi, keyinroq urining" : "Internet yo'q", { type: 'warn' });
    return false;
  }
}

export async function applyUpdate() {
  const tries = Number(ss.get(TRIES) || 0) + 1;
  ss.set(TRIES, String(tries));
  const el = document.getElementById('updBar');
  if (el) el.querySelector('.btn')?.setAttribute('disabled', '');
  try {
    // drop caches so the reload cannot be served an old copy, then reload
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
    await Promise.all(regs.map((r) => r.update().catch(() => {})));
    if (self.caches) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch {}
  location.reload();
}

export function releaseNotes() {
  const i = updateState.info;
  const list = i?.history?.length ? i.history : [{ version: APP_VERSION, date: APP_DATE, notes: [] }];
  sheet({
    title: 'Nima yangi?',
    footer: false,
    body: `${list.map((h, idx) => `<div class="rn ${idx === 0 ? 'cur' : ''}"><div class="split"><b>v${esc(h.version)}</b><small class="muted">${esc(fmtDate(h.date, true))}</small></div><ul>${h.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>`).join('')}
      ${updateState.available ? `<button class="btn primary block" data-act="upd:apply">Yangilash</button>` : ''}`,
  });
}

actions['upd:apply'] = applyUpdate;
actions['upd:later'] = () => {
  if (updateState.info) ss.set(LATER, updateState.info.hash);
  hideBar();
};
actions['upd:more'] = releaseNotes;
actions['upd:check'] = () => checkForUpdate({ manual: true });

export function initUpdate() {
  const justUpdated = Number(ss.get(TRIES) || 0) > 0;
  const run = async () => {
    const outdated = await checkForUpdate();
    if (justUpdated) {
      if (!outdated) toast(`Yangilandi ✅ v${APP_VERSION}`, { type: 'ok' });
      else if (Number(ss.get(TRIES)) >= 3) toast("Server hali yangilanmagan — birozdan keyin urinib ko'ring", { type: 'warn', ms: 7000 });
      if (!outdated) ss.set(TRIES, null);
    }
  };
  setTimeout(run, 3500);
  const soon = () => document.visibilityState === 'visible' && Date.now() - updateState.lastCheck > 2 * 60000 && checkForUpdate();
  document.addEventListener('visibilitychange', soon);
  window.addEventListener('online', soon);
  setInterval(soon, 20 * 60000);
}
