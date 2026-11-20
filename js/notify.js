import { state, onChange, save } from './store.js';
import { ymd } from './utils.js';
import { computeReminders, shouldDeliver, notifyPrefs } from './reminders-core.js';

const SEEN_KEY = 'azimov.notified.v1';
export const supported = () => 'Notification' in window;
export const permission = () => (supported() ? Notification.permission : 'unsupported');
export const nowLocal = () => {
  const d = new Date();
  return { date: ymd(d), hour: d.getHours() };
};
export const activeReminders = () => computeReminders(state, nowLocal()).filter((r) => !state.dismissed?.[r.id]);
export const prefs = () => notifyPrefs(state);

export function dismiss(id) {
  (state.dismissed ||= {})[id] = Date.now();
  // forget old dismissals so the map doesn't grow forever
  const cutoff = Date.now() - 60 * 864e5;
  for (const k of Object.keys(state.dismissed)) if (state.dismissed[k] < cutoff) delete state.dismissed[k];
}

const loadSeen = () => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
  } catch {
    return {};
  }
};
export async function showSystem(r) {
  const opts = { body: r.body, tag: r.id, icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', data: { href: r.href } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) return reg.showNotification(r.title, opts);
  } catch {}
  new Notification(r.title, opts);
}

// Notifications while the app is open (a closed app is covered by server push, see push.js / supabase/functions).
let running = false;
export async function runLocal() {
  if (running || permission() !== 'granted' || !state.settings.onboarded) return;
  running = true;
  try {
    const now = nowLocal();
    const P = prefs();
    const seen = loadSeen();
    let changed = false;
    for (const r of activeReminders()) {
      if (seen[r.id] || !shouldDeliver(r, now, P)) continue;
      await showSystem(r);
      seen[r.id] = Date.now();
      changed = true;
    }
    if (changed) {
      const cutoff = Date.now() - 60 * 864e5;
      for (const k of Object.keys(seen)) if (seen[k] < cutoff) delete seen[k];
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    }
  } finally {
    running = false;
  }
}

let t;
export function initNotify() {
  const kick = () => {
    clearTimeout(t);
    t = setTimeout(runLocal, 800);
  };
  onChange(kick);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && kick());
  setInterval(() => document.visibilityState === 'visible' && runLocal(), 60000);
  kick();
}
