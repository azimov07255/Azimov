/**
 * App lock: PIN (PBKDF2-hashed, device-local) + optional biometrics via WebAuthn (Face ID / fingerprint is verified by the phone itself).
 *
 * Honest scope: this keeps other people out of the app on your unlocked phone. It is a UI lock, not disk encryption -
 * someone with full access to the browser's storage could still read the data, so keep the phone's own passcode on too.
 * The lock record lives outside the synced state, so it never leaves this device.
 */
import { state, resetAll } from './store.js';
import { sync, signOut } from './sync.js';
import { disablePush } from './push.js';
import { closeSheet, toast } from './ui.js';
import { icon } from './icons.js';

const KEY = 'azimov.lock.v1';
const ITER = 100000;
export const AUTO_OPTIONS = [[0, 'Darhol'], [30, '30 soniya'], [60, '1 daqiqa'], [300, '5 daqiqa'], [900, '15 daqiqa']];
const WAITS = [30, 60, 300, 900, 3600]; // seconds, after every 5th consecutive wrong PIN

/* ---------- storage ---------- */
const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
};
const write = (r) => {
  try {
    r ? localStorage.setItem(KEY, JSON.stringify(r)) : localStorage.removeItem(KEY);
  } catch {}
};
export const lockRecord = () => read();
export const lockEnabled = () => !!read()?.hash;
export const updateLock = (patch) => {
  const r = read();
  if (r) write({ ...r, ...patch });
};

/* ---------- crypto helpers ---------- */
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64u = (buf) => b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

async function pbkdf2(pin, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER }, key, 256));
}
const timingSafeEq = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

/* ---------- PIN management ---------- */
export async function setPin(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const old = read() || {};
  write({ salt: b64(salt), hash: await pbkdf2(pin, salt), len: pin.length, bio: old.bio || null, auto: old.auto ?? 30, shield: old.shield ?? true, fails: 0, until: 0 });
}
export async function checkPin(pin) {
  const r = read();
  if (!r) return { ok: true };
  const now = Date.now();
  if (r.until > now) return { ok: false, wait: Math.ceil((r.until - now) / 1000) };
  const ok = timingSafeEq(await pbkdf2(pin, unb64(r.salt)), r.hash);
  if (ok) {
    write({ ...r, fails: 0, until: 0 });
    return { ok: true };
  }
  const fails = (r.fails || 0) + 1;
  let wait = 0;
  if (fails % 5 === 0) wait = WAITS[Math.min(Math.floor(fails / 5) - 1, WAITS.length - 1)];
  write({ ...r, fails, until: wait ? now + wait * 1000 : 0 });
  return { ok: false, wait, left: wait ? 0 : 5 - (fails % 5) };
}
export function removeLock() {
  write(null);
  document.getElementById('lock')?.remove();
  const app = document.getElementById('app');
  if (app) app.inert = false;
}

/* ---------- biometrics (WebAuthn platform authenticator) ---------- */
export async function biometricAvailable() {
  try {
    return !!(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()));
  } catch {
    return false;
  }
}
export async function enrollBiometric() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Azimov' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'azimov', displayName: 'Azimov' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    },
  });
  updateLock({ bio: b64u(cred.rawId) });
}
export const disableBiometric = () => updateLock({ bio: null });
async function biometricUnlock() {
  const r = read();
  if (!r?.bio) return false;
  try {
    await navigator.credentials.get({
      publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: 'public-key', id: unb64u(r.bio), transports: ['internal', 'hybrid'] }], userVerification: 'required', timeout: 60000 },
    });
    return true; // the OS verified the person (face / fingerprint / device passcode)
  } catch {
    return false;
  }
}

/* ---------- lock screen ---------- */
let locked = false;
let pin = '';
let ticker = null;
export const isLocked = () => locked;

function dotsHtml(len, filled) {
  return Array.from({ length: len }, (_, i) => `<i class="${i < filled ? 'on' : ''}"></i>`).join('');
}
function paint(msg, kind = '') {
  const el = document.getElementById('lock');
  if (!el) return;
  const r = read();
  el.querySelector('.dots').innerHTML = dotsHtml(r?.len || 4, pin.length);
  const m = el.querySelector('#lockMsg');
  if (msg != null) {
    m.textContent = msg || 'PIN kodni kiriting';
    m.className = kind;
  }
}
function countdown() {
  clearInterval(ticker);
  const tick = () => {
    const r = read();
    const left = r ? Math.ceil((r.until - Date.now()) / 1000) : 0;
    if (left > 0) {
      paint(`Juda ko'p urinish. ${left >= 60 ? Math.ceil(left / 60) + ' daqiqadan' : left + ' soniyadan'} keyin urining`, 'bad');
      document.getElementById('lock')?.classList.add('frozen');
    } else {
      clearInterval(ticker);
      document.getElementById('lock')?.classList.remove('frozen');
      paint('PIN kodni kiriting', '');
    }
  };
  tick();
  ticker = setInterval(tick, 1000);
}

function unlock() {
  locked = false;
  pin = '';
  clearInterval(ticker);
  const el = document.getElementById('lock');
  el?.classList.add('out');
  setTimeout(() => el?.remove(), 250);
  const app = document.getElementById('app');
  if (app) app.inert = false;
  document.body.classList.remove('shielded');
}

async function submit() {
  const r = await checkPin(pin);
  if (r.ok) return unlock();
  const el = document.getElementById('lock');
  el?.classList.remove('shake');
  void el?.offsetWidth;
  el?.classList.add('shake');
  pin = '';
  if (r.wait) countdown();
  else paint(`Noto'g'ri PIN. Yana ${r.left} ta urinish`, 'bad');
  if (!r.wait) setTimeout(() => paint(null), 0);
}
async function press(k) {
  const r = read();
  if (!r || (r.until || 0) > Date.now()) return;
  if (k === 'del') pin = pin.slice(0, -1);
  else if (/^\d$/.test(k) && pin.length < r.len) pin += k;
  paint(pin.length ? '' : null);
  if (pin.length === r.len) await submit();
}

export function showLock({ autoBio = true } = {}) {
  const r = read();
  if (!r || document.getElementById('lock')) return;
  closeSheet();
  locked = true;
  pin = '';
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" class="key" data-k="${n}">${n}</button>`).join('');
  const el = document.createElement('div');
  el.id = 'lock';
  el.className = 'lock';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Ilova qulflangan');
  el.innerHTML = `<div class="lock-in">
    <span class="logo lg"></span><h2>Azimov</h2><p id="lockMsg">PIN kodni kiriting</p>
    <div class="dots" aria-hidden="true"></div>
    <div class="keypad">${keys}<button type="button" class="key bio" data-k="bio" ${r.bio ? '' : 'hidden'} aria-label="Barmoq izi yoki Face ID">${icon('shield', 24)}</button><button type="button" class="key" data-k="0">0</button><button type="button" class="key del" data-k="del" aria-label="O'chirish">⌫</button></div>
    <button type="button" class="link-btn" data-k="forgot">PIN'ni unutdingizmi?</button></div>`;
  document.body.appendChild(el);
  const app = document.getElementById('app');
  if (app) app.inert = true;
  paint('PIN kodni kiriting');
  el.addEventListener('click', async (e) => {
    const k = e.target.closest('[data-k]')?.dataset.k;
    if (!k) return;
    if (k === 'bio') {
      if (await biometricUnlock()) unlock();
      else paint('Tasdiqlanmadi. PIN kiriting', 'bad');
    } else if (k === 'forgot') forgot();
    else press(k);
  });
  if ((r.until || 0) > Date.now()) countdown();
  else if (r.bio && autoBio) biometricUnlock().then((ok) => ok && unlock());
}
export function lockNow() {
  if (lockEnabled()) showLock({ autoBio: false });
}

async function forgot() {
  const { confirmBox } = await import('./ui.js');
  const msg = sync.user
    ? "PIN'ni tiklab bo'lmaydi. Davom etsangiz shu qurilmadagi ma'lumotlar o'chadi va akkauntdan chiqiladi. Qayta kirsangiz, bulutdagi nusxa yuklanadi."
    : "PIN'ni tiklab bo'lmaydi. Davom etsangiz shu qurilmadagi BARCHA ma'lumotlar o'chadi (bulutga ulanmagansiz — qaytarib bo'lmaydi).";
  if (!(await confirmBox(msg, { ok: "Ha, o'chirish" }))) return;
  if (sync.user) {
    await disablePush().catch(() => {});
    await signOut().catch(() => {}); // sign out first: the wipe must NOT be pushed over the cloud copy
  }
  removeLock();
  resetAll();
  toast("Qulf olib tashlandi, ma'lumotlar tozalandi", { type: 'ok' });
  location.hash = '#/dashboard';
}

/* ---------- auto-lock + privacy shield ---------- */
let hiddenAt = 0;
export function initLock() {
  if (lockEnabled()) showLock();
  // desktop keyboard: digits and Backspace work on the lock screen too
  document.addEventListener('keydown', (e) => {
    if (!locked) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('del');
  });
  document.addEventListener('visibilitychange', () => {
    const r = read();
    if (!r) return;
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      if (r.shield !== false) document.body.classList.add('shielded'); // app-switcher thumbnail shows the logo, not your money
    } else {
      if (!locked && hiddenAt && Date.now() - hiddenAt >= (r.auto ?? 30) * 1000) showLock({ autoBio: true });
      if (!locked) document.body.classList.remove('shielded');
      hiddenAt = 0;
    }
  });
}
