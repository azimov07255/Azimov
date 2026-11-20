/**
 * Cloud sync (Supabase). One JSON snapshot per user in public.azimov_user_data,
 * optimistic-locked with a `rev` counter that a DB trigger bumps on every update.
 *
 *  - local edits  -> debounced push (update ... where rev = <last synced rev>)
 *  - 0 rows hit   -> someone else pushed first -> conflict dialog (cloud / device / merge)
 *  - startup, tab focus, back online, every 90 s -> cheap `rev` check, pull if newer
 * The app works fully offline; sync is purely additive.
 */
import { state, onChange, replaceState } from './store.js';
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_LIB, AUTH_STORAGE_KEY } from './config.js';
import { sheet, closeSheet, toast } from './ui.js';
import { esc } from './utils.js';

const TABLE = 'azimov_user_data';
const META_KEY = 'azimov.sync.v1';

export const sync = { status: 'off', user: null, error: '', lastSync: null };
// status: off | idle | syncing | offline | error | conflict
const subs = new Set();
export const onSyncChange = (fn) => subs.add(fn);
function set(status, error = '') {
  sync.status = status;
  sync.error = error;
  subs.forEach((f) => f());
}

let meta = loadMeta();
function loadMeta() {
  try {
    return { rev: null, dirty: false, ...JSON.parse(localStorage.getItem(META_KEY) || '{}') };
  } catch {
    return { rev: null, dirty: false };
  }
}
const saveMeta = () => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {}
};

let sb = null;
let applying = false;
let blocked = false; // conflict dialog open
let changeSeq = 0;
let timer = null;
let running = false;
let again = false;

async function client() {
  if (sb) return sb;
  const mod = await import(/* @vite-ignore */ SUPABASE_LIB);
  sb = mod.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: AUTH_STORAGE_KEY },
  });
  sb.auth.onAuthStateChange((ev, session) => {
    sync.user = session?.user || null;
    if (ev === 'SIGNED_OUT') {
      meta = { rev: null, dirty: false };
      saveMeta();
      set('off');
    }
  });
  return sb;
}

export function deviceName() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Qurilma';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '';
  return `${os}${br ? ' · ' + br : ''}`;
}
const snapshot = () => JSON.parse(JSON.stringify(state));
export const hasLocalData = () => ['transactions', 'goals', 'debts', 'subs', 'businesses'].some((k) => (state[k] || []).length > 0);
const counts = (s) => `${(s.transactions || []).length} tranzaksiya · ${(s.goals || []).length} maqsad · ${(s.debts || []).length} qarz · ${(s.businesses || []).length} biznes`;

/* ---------- local change tracking ---------- */
onChange(() => {
  if (applying) return;
  changeSeq++;
  meta.dirty = true;
  saveMeta();
  if (sync.user && !blocked) schedule(2500);
});
function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(() => syncNow().catch(() => {}), ms);
}

/* ---------- public API ---------- */
export async function initSync() {
  let has = false;
  try {
    has = !!localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {}
  if (!has) return;
  try {
    const c = await client();
    const { data } = await c.auth.getSession();
    sync.user = data.session?.user || null;
    if (sync.user) await syncNow();
  } catch (e) {
    set(navigator.onLine ? 'error' : 'offline', e.message);
  }
}

export async function signIn(email, password) {
  const c = await client();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  sync.user = data.user;
  syncNow().catch(() => {});
  return data;
}
export async function signUp(email, password) {
  const c = await client();
  const { data, error } = await c.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
  if (data.session) {
    sync.user = data.user;
    syncNow().catch(() => {});
  }
  return data;
}
export async function resetPassword(email) {
  const c = await client();
  const { error } = await c.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  if (error) throw error;
}
export async function signOut() {
  const c = await client();
  await c.auth.signOut();
  sync.user = null;
  meta = { rev: null, dirty: false };
  saveMeta();
  set('off');
}

export async function syncNow() {
  if (!sync.user || blocked) return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    set('syncing');
    await reconcile();
  } catch (e) {
    console.warn('sync', e);
    set(!navigator.onLine || /fetch|network/i.test(e.message || '') ? 'offline' : 'error', e.message || String(e));
  } finally {
    running = false;
    if (again) {
      again = false;
      schedule(500);
    }
  }
}

/* ---------- core ---------- */
async function reconcile() {
  const c = await client();
  const uid = sync.user.id;
  const head = await c.from(TABLE).select('rev').eq('user_id', uid).maybeSingle();
  if (head.error) throw head.error;
  const remoteRev = head.data?.rev ?? null;

  if (remoteRev === null) return pushInsert();
  if (meta.rev === null) {
    // first contact between this device and an existing cloud copy
    if (!hasLocalData()) return pull();
    return askConflict(await fetchRow());
  }
  if (remoteRev > meta.rev) return meta.dirty ? askConflict(await fetchRow()) : pull();
  if (remoteRev < meta.rev) return meta.dirty ? pushInsert(true) : done();
  return meta.dirty ? push() : done();
}
const done = () => {
  sync.lastSync = new Date().toISOString();
  meta.lastSync = sync.lastSync;
  saveMeta();
  set('idle');
};
async function fetchRow() {
  const c = await client();
  const { data, error } = await c.from(TABLE).select('rev,data,updated_at,device').eq('user_id', sync.user.id).maybeSingle();
  if (error) throw error;
  return data;
}
async function pull() {
  applyRemote(await fetchRow());
}
function applyRemote(row) {
  applying = true;
  try {
    replaceState(row.data);
  } finally {
    applying = false;
  }
  meta = { rev: row.rev, dirty: false, lastSync: new Date().toISOString() };
  saveMeta();
  done();
  toast("Bulutdagi ma'lumotlar yuklandi ☁️", { type: 'ok' });
}
async function pushInsert(upsertOverwrite = false) {
  const c = await client();
  const seq = changeSeq;
  const row = { user_id: sync.user.id, data: snapshot(), device: deviceName() };
  const res = upsertOverwrite ? await c.from(TABLE).upsert(row).select('rev') : await c.from(TABLE).insert(row).select('rev');
  if (res.error) {
    if (res.error.code === '23505') return reconcile(); // raced with another device
    throw res.error;
  }
  meta.rev = res.data?.[0]?.rev ?? 1;
  meta.dirty = changeSeq !== seq;
  saveMeta();
  done();
  if (meta.dirty) schedule(800);
}
async function push() {
  const c = await client();
  const seq = changeSeq;
  const res = await c.from(TABLE).update({ data: snapshot(), device: deviceName() }).eq('user_id', sync.user.id).eq('rev', meta.rev).select('rev');
  if (res.error) throw res.error;
  if (!res.data?.length) return askConflict(await fetchRow()); // rev moved on: somebody pushed first
  meta.rev = res.data[0].rev;
  meta.dirty = changeSeq !== seq;
  saveMeta();
  done();
  if (meta.dirty) schedule(800);
}

/* ---------- conflict handling ---------- */
function ago(iso) {
  if (!iso) return '';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? 'hozirgina' : m < 60 ? `${m} daqiqa oldin` : m < 1440 ? `${Math.round(m / 60)} soat oldin` : `${Math.round(m / 1440)} kun oldin`;
}
export function mergeStates(local, remote) {
  const union = (a = [], b = []) => {
    const m = new Map();
    a.forEach((x) => m.set(x.id, x));
    b.forEach((x) => m.set(x.id, x)); // same id: device copy wins
    return [...m.values()];
  };
  const out = structuredClone(remote);
  for (const k of ['accounts', 'categories', 'transactions', 'goals', 'debts', 'subs']) out[k] = union(remote[k], local[k]);
  const biz = new Map((remote.businesses || []).map((b) => [b.id, b]));
  for (const b of local.businesses || []) {
    const r = biz.get(b.id);
    biz.set(b.id, r ? { ...r, ...b, entries: union(r.entries, b.entries) } : b);
  }
  out.businesses = [...biz.values()];
  out.budgets = { ...(remote.budgets || {}), ...(local.budgets || {}) };
  out.settings = { ...(remote.settings || {}), ...(local.settings || {}) };
  out.rules = { ...(remote.rules || {}), ...(local.rules || {}) };
  out.imported = [...new Set([...(remote.imported || []), ...(local.imported || [])])];
  out.challenge = { ...(remote.challenge || {}), ...(local.challenge || {}), done: [...new Set([...(remote.challenge?.done || []), ...(local.challenge?.done || [])])] };
  return out;
}

function askConflict(row) {
  blocked = true;
  set('conflict');
  const local = snapshot();
  const finish = () => {
    blocked = false;
    closeSheet();
  };
  sheet({
    title: "Ma'lumotlar farq qilmoqda",
    footer: false,
    body: `<p class="muted small">Bulutdagi nusxa va shu qurilmadagi ma'lumotlar bir-biridan farq qiladi. Qaysi birini saqlaymiz?</p>
      <div class="conf">
        <div class="conf-box"><b>☁️ Bulutda</b><small>${esc(counts(row.data))}</small><small class="muted">${esc(row.device || 'Boshqa qurilma')} · ${esc(ago(row.updated_at))}</small></div>
        <div class="conf-box"><b>📱 Shu qurilmada</b><small>${esc(counts(local))}</small><small class="muted">${esc(deviceName())}</small></div>
      </div>
      <div class="btn-col">
        <button type="button" class="btn primary" data-pick="merge">Birlashtirish (tavsiya etiladi)</button>
        <button type="button" class="btn ghost" data-pick="cloud">Buluttagini olish — qurilmadagi o'zgarishlar yo'qoladi</button>
        <button type="button" class="btn ghost" data-pick="local">Qurilmadagini yuborish — bulutdagi almashtiriladi</button>
      </div>
      <p class="muted small">Birlashtirishda ikkala tomondagi yozuvlar saqlanadi. Bir tomonda o'chirilgan yozuv qaytib paydo bo'lishi mumkin.</p>`,
    onMount(form) {
      form.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-pick]');
        if (!b) return;
        const pick = b.dataset.pick;
        form.querySelectorAll('button').forEach((x) => (x.disabled = true));
        try {
          if (pick === 'cloud') applyRemote(row);
          else {
            if (pick === 'merge') {
              applying = true;
              try {
                replaceState(mergeStates(local, row.data));
              } finally {
                applying = false;
              }
            }
            meta.rev = row.rev;
            meta.dirty = true;
            saveMeta();
            finish();
            await push();
            toast(pick === 'merge' ? "Birlashtirildi va bulutga yuborildi ☁️" : 'Bulutga yuborildi ☁️', { type: 'ok' });
            return;
          }
          finish();
        } catch (err) {
          blocked = false;
          set('error', err.message);
          closeSheet();
        }
      });
    },
  });
  // closing the sheet without choosing = stay conflicted, retry later
  const watcher = setInterval(() => {
    if (!document.querySelector('.sheet-root')) {
      clearInterval(watcher);
      if (blocked) {
        blocked = false;
        set('conflict');
      }
    }
  }, 600);
}

/* ---------- background triggers ---------- */
// a dismissed conflict is only retried manually (Settings -> «Hozir sinxronlash»), never by background triggers
const kick = () => sync.user && sync.status !== 'conflict' && syncNow().catch(() => {});
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && kick());
window.addEventListener('online', kick);
window.addEventListener('offline', () => sync.user && set('offline'));
setInterval(() => document.visibilityState === 'visible' && !meta.dirty && kick(), 90000);
