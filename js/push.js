import { PUSH_FN_URL } from './config.js';
import { getClient, sync } from './sync.js';
import { supported } from './notify.js';

const TABLE = 'azimov_push_subs';
export const pushSupported = () => supported() && 'serviceWorker' in navigator && 'PushManager' in window;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

const b64 = (s) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

let vapidKey = null;
async function getVapidKey() {
  if (vapidKey) return vapidKey;
  try {
    vapidKey = localStorage.getItem('azimov.vapid');
  } catch {}
  if (!vapidKey) {
    const r = await fetch(PUSH_FN_URL + '?pubkey');
    if (!r.ok) throw new Error('Push serveri javob bermadi');
    vapidKey = (await r.json()).key;
    try {
      localStorage.setItem('azimov.vapid', vapidKey);
    } catch {}
  }
  return vapidKey;
}

export async function currentSub() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) || null;
}

/** Ask permission; if signed in also register this device for server push. */
export async function enableNotifications() {
  if (!supported()) throw new Error('Brauzer bildirishnomalarni qo\'llamaydi');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error("Ruxsat berilmadi. Brauzer sozlamalaridan yoqing");
  const out = { local: true, push: false, needLogin: false };
  if (!pushSupported()) return out;
  if (!sync.user) return { ...out, needLogin: true };
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(await getVapidKey()) }));
  const j = sub.toJSON();
  const c = await getClient();
  const { error } = await c.from(TABLE).upsert({
    endpoint: j.endpoint,
    user_id: sync.user.id,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    ua: navigator.userAgent.slice(0, 120),
  });
  if (error) throw error;
  return { ...out, push: true };
}

export async function disablePush() {
  const sub = await currentSub();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  if (sync.user) {
    const c = await getClient();
    await c.from(TABLE).delete().eq('endpoint', endpoint);
  }
}
