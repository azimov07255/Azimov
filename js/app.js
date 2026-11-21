import { state, commit, onChange, addTx } from './store.js';
import { $, esc, today } from './utils.js';
import { icon } from './icons.js';
import { money, isHidden } from './fmt.js';
import { actions, bindFormEnhancements, animateCounters, toast, closeSheet } from './ui.js';
import { renderDashboard, bindQuick } from './views/dashboard.js';
import { renderTransactions, afterTransactions, openTxSheet } from './views/tx.js';
import { renderBudgets } from './views/budgets.js';
import { renderGoals } from './views/goals.js';
import { renderDebts } from './views/debts.js';
import { renderSubs } from './views/subs.js';
import { renderBusiness, renderBusinessDetail } from './views/business.js';
import { renderTools } from './views/tools.js';
import { renderSettings, afterSettings } from './views/settings.js';
import { renderMore } from './views/more.js';
import { loadDemo } from './views/demo.js';
import { renderImport, afterImport, setImportText } from './views/import.js';
import { renderRoundup, afterRoundup, renderWhatIf, afterWhatIf, renderPayoff, afterPayoff } from './views/savings.js';
import { renderZakat, afterZakat } from './views/zakat.js';
import { renderDaily } from './views/daily.js';
import { renderReminders, afterReminders } from './views/reminders.js';
import { initUpdate } from './update.js';
import { initLock } from './lock.js';
import { refreshRates } from './rates.js';
import { initNotify, activeReminders } from './notify.js';
import { renderScan, afterScan } from './views/scan.js';
import { renderReports, afterReports } from './views/reports.js';
import { initSync, onSyncChange, sync } from './sync.js';
import { openAuthSheet } from './views/settings.js';

const NAV = [
  ['dashboard', 'Bosh sahifa', 'home'],
  ['transactions', 'Tranzaksiyalar', 'list'],
  ['daily', 'Kunlik daromad', 'calendar'],
  ['budgets', 'Byudjet', 'pie'],
  ['goals', 'Maqsadlar', 'target'],
  ['debts', 'Qarzlar', 'users'],
  ['subs', "Takroriy to'lovlar", 'repeat'],
  ['business', 'Biznes', 'briefcase'],
  ['reminders', 'Eslatmalar', 'bell'],
  ['import', 'Bank xabarlari', 'msg'],
  ['scan', 'Chek skanerlash', 'camera'],
  ['reports', 'Hisobotlar', 'file'],
  ['tools', 'Asboblar', 'sliders'],
  ['settings', 'Sozlamalar', 'gear'],
];
const MORE_ROUTES = ['more', 'zakat', 'roundup', 'whatif', 'payoff', 'daily', 'reminders', 'import', 'scan', 'reports', 'goals', 'debts', 'subs', 'business', 'tools', 'settings'];

const ROUTES = {
  dashboard: { render: renderDashboard, after: (r) => bindQuick(r) },
  transactions: { render: renderTransactions, after: (r) => afterTransactions(r) },
  daily: { render: renderDaily },
  budgets: { render: renderBudgets },
  goals: { render: renderGoals },
  debts: { render: renderDebts },
  subs: { render: renderSubs },
  business: { render: (id) => (id ? renderBusinessDetail(id) : renderBusiness()) },
  import: { render: renderImport, after: (r) => afterImport(r) },
  reminders: { render: renderReminders, after: (r) => afterReminders(r) },
  scan: { render: renderScan, after: (r) => afterScan(r) },
  reports: { render: (p) => renderReports(p), after: (r) => afterReports(r) },
  roundup: { render: renderRoundup, after: (r) => afterRoundup(r) },
  whatif: { render: renderWhatIf, after: (r) => afterWhatIf(r) },
  payoff: { render: renderPayoff, after: (r) => afterPayoff(r) },
  zakat: { render: renderZakat, after: (r) => afterZakat(r) },
  tools: { render: renderTools },
  settings: { render: renderSettings, after: (r) => afterSettings(r) },
  more: { render: renderMore },
};

const app = document.getElementById('app');
let shellBuilt = false;
let lastRoute = '';

/* ---------- theme ---------- */
const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
function applyTheme() {
  const t = state.settings.theme;
  const dark = t === 'auto' ? mq?.matches ?? true : t !== 'light';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0a0c16' : '#f3f4fb');
}
mq?.addEventListener?.('change', applyTheme);

/* ---------- shell ---------- */
function buildShell() {
  app.innerHTML = `
  <div class="shell">
    <aside class="side">
      <a class="brand" href="#/dashboard"><span class="logo"></span><b>Azimov</b></a>
      <nav class="side-nav">${NAV.map(([id, label, ic]) => `<a href="#/${id}" data-nav="${id}">${icon(ic, 20)}<span>${label}</span></a>`).join('')}</nav>
      <div class="side-foot"><a class="sync-chip" href="#/settings" id="syncChip" hidden></a><button class="btn primary block" data-act="tx:new">${icon('plus', 18)} Tranzaksiya</button><button class="btn ghost block" data-act="hide:toggle"><span id="hideLbl"></span></button></div>
    </aside>
    <div class="content">
      <header class="topbar">
        <a class="brand sm" href="#/dashboard"><span class="logo"></span><b>Azimov</b></a>
        <div class="topbar-r"><a class="icon-btn bell" href="#/reminders" id="bellBtn" aria-label="Eslatmalar">${icon('bell', 20)}<em id="bellN" hidden></em></a><a class="icon-btn sync-dot" href="#/settings" id="syncDotM" hidden aria-label="Bulut holati"></a><button class="icon-btn" data-act="hide:toggle" id="hideBtn" aria-label="Summalarni yashirish"></button><a class="icon-btn" href="#/settings" aria-label="Sozlamalar">${icon('gear', 20)}</a></div>
      </header>
      <main id="view" class="page" tabindex="-1"></main>
    </div>
    <nav class="bottom-nav">
      <a href="#/dashboard" data-nav="dashboard">${icon('home', 22)}<span>Bosh</span></a>
      <a href="#/transactions" data-nav="transactions">${icon('list', 22)}<span>Tranzaksiya</span></a>
      <button class="fab" data-act="tx:new" aria-label="Qo'shish">${icon('plus', 26)}</button>
      <a href="#/budgets" data-nav="budgets">${icon('pie', 22)}<span>Byudjet</span></a>
      <a href="#/more" data-nav="more">${icon('grid', 22)}<span>Ko'proq</span></a>
    </nav>
  </div>`;
  shellBuilt = true;
}

// Bank message arriving from Android "share" (?text=) or an iOS Shortcut / automation (#/import?text=)
function consumeIncoming() {
  const sp = new URLSearchParams(location.search);
  let t = sp.get('text') || sp.get('title') || '';
  const q = location.hash.split('?')[1];
  if (q) t = new URLSearchParams(q).get('text') || t;
  if (!t.trim()) return;
  setImportText(t);
  history.replaceState(null, '', location.pathname + '#/import');
}

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  const [name = 'dashboard', param] = h.split('/');
  return [ROUTES[name] ? name : 'dashboard', param];
}

function updateNav(name) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const id = a.dataset.nav;
    a.classList.toggle('active', id === name || (id === 'more' && MORE_ROUTES.includes(name) && !document.querySelector('.side-nav [data-nav].active')));
  });
  // bottom nav: highlight "more" for secondary routes
  document.querySelectorAll('.bottom-nav [data-nav]').forEach((a) => {
    const id = a.dataset.nav;
    a.classList.toggle('active', id === name || (id === 'more' && MORE_ROUTES.includes(name)));
  });
  document.querySelectorAll('.side-nav [data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === name));
  const lbl = isHidden() ? 'Summalarni ko\'rsatish' : 'Summalarni yashirish';
  const hl = document.getElementById('hideLbl');
  if (hl) hl.innerHTML = `${icon(isHidden() ? 'eyeOff' : 'eye', 16)} ${lbl}`;
  const hb = document.getElementById('hideBtn');
  if (hb) hb.innerHTML = icon(isHidden() ? 'eyeOff' : 'eye', 20);
}

export function render() {
  applyTheme();
  if (!state.settings.onboarded) return renderOnboarding();
  if (!shellBuilt) buildShell();
  const [name, param] = parseHash();
  const key = name + (param ? '/' + param : '');
  const view = document.getElementById('view');
  const sy = lastRoute === key ? window.scrollY : 0;
  const route = ROUTES[name];
  let html;
  try {
    html = `<div class="view-in">${route.render(param)}</div>`;
  } catch (e) {
    console.error(e);
    html = `<div class="card"><h3>Xatolik</h3><p class="muted">${esc(e.message)}</p></div>`;
  }
  try {
    view.innerHTML = html;
  } catch (e) {
    // Re-rendering from inside a text field's blur/change handler can make the browser throw while it
    // removes the focused node. Nothing is lost: run the same render right after the event finishes.
    if (e?.name === 'NotFoundError') {
      setTimeout(render, 0);
      return;
    }
    throw e;
  }
  try {
    route.after?.(view);
  } catch (e) {
    console.error(e);
  }
  updateNav(name);
  updateSyncUI();
  updateBell();
  if (lastRoute !== key) {
    animateCounters(view, (v) => money(v));
    window.scrollTo(0, 0);
    view.querySelector('.view-in')?.classList.add('anim');
  } else {
    window.scrollTo(0, sy);
  }
  lastRoute = key;
}

/* ---------- onboarding ---------- */
function renderOnboarding() {
  shellBuilt = false;
  app.innerHTML = `
  <div class="onb">
    <div class="onb-card">
      <div class="onb-logo"><span class="logo lg"></span></div>
      <h1>Azimov</h1>
      <p class="onb-sub">Pulingizni to'g'ri sarflang, ko'proq tejang va kelajakdagi biznesingiz uchun poydevor quring.</p>
      <ul class="onb-feat"><li>${icon('zap', 16)} «taksi 25 ming» deb yozing — qolganini o'zim bajaraman</li><li>${icon('shield', 16)} Har kuni qancha sarflash xavfsizligini ko'rsataman</li><li>${icon('briefcase', 16)} Biznesga tayyorligingizni baholayman</li></ul>
      <form id="onbForm" autocomplete="off">
        <label class="field"><span>Ismingiz</span><input class="input" name="name" placeholder="Masalan: Azimov" data-autofocus></label>
        <label class="field"><span>Hozir qo'lingizdagi pul (ixtiyoriy)</span><div class="amt-wrap"><input class="input amt" inputmode="numeric" name="cash" placeholder="0"><i>so'm</i></div></label>
        <button class="btn primary block lg" type="submit">Boshlash</button>
      </form>
      <button class="btn ghost block" id="onbLogin">${icon('cloud', 16)} Akkauntim bor — kirish</button>
      <button class="btn ghost block" id="onbDemo">${icon('sparkles', 16)} Demo ma'lumot bilan ko'rish</button>
    </div>
  </div>`;
  document.getElementById('onbForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    state.settings.name = f.name.value.trim();
    const cash = Number(String(f.cash.value).replace(/[^\d]/g, '')) || 0;
    const a = state.accounts.find((x) => x.id === 'a_cash');
    if (a) a.initial = cash;
    state.settings.onboarded = true;
    location.hash = '#/dashboard';
    commit();
  });
  document.getElementById('onbLogin').addEventListener('click', () => openAuthSheet());
  document.getElementById('onbDemo').addEventListener('click', () => {
    loadDemo();
    location.hash = '#/dashboard';
  });
}

/* ---------- global events ---------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) {
    e.preventDefault();
    fn(el, e);
  }
});
actions['hide:toggle'] = () => {
  state.settings.hide = !state.settings.hide;
  commit();
};
actions._render = render;
bindFormEnhancements(document);
window.addEventListener('hashchange', () => {
  consumeIncoming();
  closeSheet();
  render();
});
onChange((o) => !o?.quiet && render()); // commit({quiet:true}) = save + sync without re-rendering

const SYNC_LABEL = { idle: 'Sinxronlangan', syncing: 'Sinxronlanmoqda…', offline: 'Oflayn', error: 'Sinxron xatosi', conflict: 'Farq bor' };
function updateBell() {
  const n = state.settings.onboarded ? activeReminders().length : 0;
  const b = document.getElementById('bellN');
  if (b) {
    b.hidden = !n;
    b.textContent = n > 9 ? '9+' : n;
  }
  document.querySelectorAll('[data-nav="reminders"]').forEach((a) => a.setAttribute('data-badge', n || ''));
}

function updateSyncUI() {
  const on = !!sync.user;
  const label = SYNC_LABEL[sync.status] || '';
  for (const id of ['syncDotM', 'syncChip']) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.hidden = !on;
    el.className = (id === 'syncChip' ? 'sync-chip' : 'icon-btn sync-dot') + ' s-' + sync.status;
    el.title = label;
    el.innerHTML = icon('cloud', id === 'syncChip' ? 16 : 20) + (id === 'syncChip' ? `<span>${label}</span>` : '<i></i>');
  }
}
// a sheet that was open while sync state changed may have skipped a refresh: redo it once it is gone
document.addEventListener('sheetclosed', () => shellBuilt && parseHash()[0] === 'settings' && render());
onSyncChange(() => {
  updateSyncUI();
  // settings shows live status; the rest of the app re-renders through store changes
  if (shellBuilt && parseHash()[0] === 'settings' && !document.querySelector('.sheet-root.open')) render();
  if (!state.settings.onboarded && sync.user && sync.status === 'idle') render();
});

consumeIncoming();
render();
initLock(); // after the first render so there is an #app to make inert
initSync();
initNotify();
initUpdate();
setTimeout(() => state.settings.onboarded && refreshRates(), 2500);

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && location.hostname !== 'localhost-nosw') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
