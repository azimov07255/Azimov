import { esc } from '../utils.js';
import { icon } from '../icons.js';
import { sync, getClient } from '../sync.js';
import { actions, sheet, toast, card, confirmBox } from '../ui.js';
import { buildContext } from '../advisor-context.js';
import { state } from '../store.js';
import { stats, curKey, healthScore } from '../insights.js';
import { short } from '../fmt.js';

const KEY = 'azimov.advisor.v1';
const MAX_MSGS = 60;
const MAX_Q = 500;
const SUGGEST = [
  { e: '📊', t: 'Xarajat tahlili', q: "Nega bu oy ko'p sarfladim?" },
  { e: '💰', t: "Tejash yo'llari", q: "Qayerdan tejasam bo'ladi?" },
  { e: '🩺', t: 'Moliyaviy salomatlik', q: 'Moliyaviy holatimni baholab ber' },
  { e: '🧾', t: 'Qarzni tez yopish', q: 'Qarzlarimni qanday tezroq yopaman?' },
  { e: '🚀', t: 'Biznesga tayyormanmi?', q: 'Biznes boshlashga tayyormanmi?' },
  { e: '🎯', t: 'Keyingi oy rejasi', q: 'Keyingi oy uchun byudjet rejasi tuzib ber' },
];
const FOLLOW = ['Batafsilroq tushuntir', 'Rejaga aylantir', 'Qisqartirib ber'];
const STATUS = ["Ma'lumotlaringizni o'qiyapman…", 'Tahlil qilyapman…', 'Javob yozyapman…'];

const utcDay = () => new Date().toISOString().slice(0, 10);
const load = () => {
  try {
    return { names: false, msgs: [], quota: null, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { names: false, msgs: [], quota: null };
  }
};
let data = load();
const persist = () => {
  data.msgs = data.msgs.slice(-MAX_MSGS);
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {}
};
let busy = false;
let freshAt = 0; // timestamp of the answer that just arrived (it fades in block by block)
let statusTimer = null;
const quotaNow = () => (data.quota && data.quota.day === utcDay() ? data.quota : null);

/* ---------- small safe markdown (everything is escaped first, so no HTML from the model can ever run) ---------- */
const inline = (s) =>
  s
    .replace(/`([^`]+?)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>');

export function md(text) {
  const lines = esc(text).split('\n');
  let html = '';
  let list = null;
  const close = () => {
    if (list) html += `</${list}>`;
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // table: consecutive lines that start with "|"
    if (/^\s*\|.*\|\s*$/.test(raw)) {
      close();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const body = rows.filter((r) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r) || !/-/.test(r));
      if (body.length) {
        const [head, ...rest] = body.map(cells);
        html += `<div class="tbl"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rest.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      }
      continue;
    }
    const line = inline(raw);
    const h = raw.match(/^\s*#{1,4}\s+(.*)$/);
    const ul = raw.match(/^\s*[-*•]\s+(.*)$/);
    const ol = raw.match(/^\s*\d+[.)]\s+(.*)$/);
    const bq = raw.match(/^\s*&gt;\s?(.*)$/);
    if (ul || ol) {
      const tag = ul ? 'ul' : 'ol';
      if (list !== tag) {
        close();
        html += `<${tag}>`;
        list = tag;
      }
      html += `<li>${inline((ul || ol)[1])}</li>`;
      continue;
    }
    close();
    if (h) html += `<h4>${inline(h[1])}</h4>`;
    else if (bq) html += `<blockquote>${inline(bq[1])}</blockquote>`;
    else if (/^\s*([-*_])\1{2,}\s*$/.test(raw)) html += '<hr>';
    else if (line.trim()) html += `<p>${line}</p>`;
  }
  close();
  return html;
}

/* ---------- pieces ---------- */
const hm = (t) => {
  const d = new Date(t || Date.now());
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const dayLabel = (t) => {
  const d = new Date(t);
  const n = new Date();
  const diff = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 864e5);
  if (diff === 0) return 'Bugun';
  if (diff === 1) return 'Kecha';
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};
const orb = (cls = '') => `<span class="adv-orb ${cls}"><i></i><b>${icon('sparkles', cls.includes('xl') ? 34 : 17)}</b></span>`;

function bubble(m, i, isLast) {
  if (m.r === 'u') return `<div class="msg u"><div class="col"><div class="bub">${esc(m.t)}</div><time>${hm(m.at)}</time></div></div>`;
  if (m.r === 'e')
    return `<div class="msg a err"><span class="av err">⚠️</span><div class="col"><div class="bub">${esc(m.t)}</div><div class="acts"><button type="button" class="act txt" data-act="adv:retry">${icon('refresh', 14)} Qayta urinish</button></div></div></div>`;
  const fresh = m.at === freshAt;
  return `<div class="msg a" data-i="${i}"><span class="av">${orb()}</span><div class="col"><div class="bub ${fresh ? 'reveal' : ''}">${md(m.t)}</div>
    <div class="acts"><time>${hm(m.at)}</time>
      <button type="button" class="act" data-act="adv:copy" data-i="${i}" aria-label="Nusxalash" title="Nusxalash">${icon('copy', 15)}</button>
      <button type="button" class="act ${m.fb === 'up' ? 'on' : ''}" data-act="adv:fb" data-i="${i}" data-v="up" aria-label="Yaxshi javob" title="Yaxshi javob">${icon('thumbUp', 15)}</button>
      <button type="button" class="act ${m.fb === 'down' ? 'on' : ''}" data-act="adv:fb" data-i="${i}" data-v="down" aria-label="Yomon javob" title="Yomon javob">${icon('thumbDown', 15)}</button>
      ${isLast && !busy ? `<button type="button" class="act txt" data-act="adv:regen">${icon('refresh', 14)} Qayta yozish</button>` : ''}</div></div></div>`;
}

function welcome() {
  const st = stats(curKey());
  const hs = healthScore();
  const name = (state.settings.name || '').trim().split(/\s+/)[0];
  const rate = st.rate === null || st.rate === undefined ? '—' : Math.round(st.rate * 100) + '%';
  return `<div class="adv-hello">
    ${orb('xl')}
    <h2>${name ? `Salom, ${esc(name)}!` : 'Salom!'}</h2>
    <p>Men Azimov AI — pulingiz bo'yicha shaxsiy maslahatchingiz. Xarajat, tejash, qarz va biznes haqida so'rang.</p>
    <div class="adv-stats">
      <div><small>Bu oy xarajat</small><b>${short(st.expense)}</b></div>
      <div><small>Jamg'arma</small><b>${rate}</b></div>
      <div><small>Salomatlik</small><b>${hs.score}<em>/100</em></b></div>
    </div>
    <div class="adv-sug">${SUGGEST.map((s) => `<button type="button" class="sug" data-act="adv:ask" data-q="${esc(s.q)}"><span class="e">${s.e}</span><span><b>${esc(s.t)}</b><small>${esc(s.q)}</small></span></button>`).join('')}</div>
  </div>`;
}

function msgsHtml() {
  if (!data.msgs.length && !busy) return welcome();
  let out = '';
  let lastDay = '';
  data.msgs.forEach((m, i) => {
    const dl = dayLabel(m.at || Date.now());
    if (dl !== lastDay) out += `<div class="day"><span>${dl}</span></div>`;
    lastDay = dl;
    out += bubble(m, i, i === data.msgs.length - 1);
  });
  if (busy) out += `<div class="msg a pending"><span class="av">${orb('spin')}</span><div class="col"><div class="bub typing"><span class="dots"><i></i><i></i><i></i></span><span id="advStatus">${STATUS[0]}</span></div></div></div>`;
  return out;
}

function chipsHtml() {
  const last = data.msgs[data.msgs.length - 1];
  if (busy || !last || last.r !== 'a') return '';
  return FOLLOW.map((s) => `<button type="button" class="chip" data-act="adv:ask" data-q="${esc(s)}">${esc(s)}</button>`).join('');
}

function quotaHtml() {
  const q = quotaNow();
  if (!q) return '';
  const left = Math.max(0, q.limit - q.used);
  return `<span class="qbar" title="Bugungi savollar"><i style="width:${Math.min(100, Math.round((q.used / q.limit) * 100))}%"></i></span>Bugun: ${q.used}/${q.limit}${left <= 5 ? ` · ${left} ta qoldi` : ''}`;
}

function nearBottom(box) {
  return box.scrollHeight - box.scrollTop - box.clientHeight < 90;
}
function paint({ stick = true } = {}) {
  const box = document.getElementById('advMsgs');
  if (!box) return;
  const wasNear = nearBottom(box);
  box.innerHTML = msgsHtml();
  const chips = document.getElementById('advChips');
  if (chips) chips.innerHTML = chipsHtml();
  const send = document.getElementById('advSend');
  if (send) send.disabled = busy;
  const q = document.getElementById('advQuota');
  if (q) q.innerHTML = quotaHtml();
  document.getElementById('advApp')?.classList.toggle('busy', busy);
  const fresh = box.querySelector('.bub.reveal');
  if (!data.msgs.length && !busy) box.scrollTop = 0;
  else if (fresh && stick) box.scrollTop = Math.max(0, fresh.closest('.msg').offsetTop - 12);
  else if (stick || wasNear) box.scrollTop = box.scrollHeight;
  syncDown();
}
function syncDown() {
  const box = document.getElementById('advMsgs');
  const btn = document.getElementById('advDown');
  if (box && btn) btn.hidden = nearBottom(box) || !data.msgs.length;
}

/* ---------- view ---------- */
export function renderAdvisor() {
  if (!sync.user) {
    const head = `<div class="page-head"><div class="back-row"><a class="icon-btn" href="#/tools" aria-label="Orqaga">${icon('chevL', 20)}</a><div><h1>Azimov AI</h1><p class="sub">Shaxsiy moliya maslahatchingiz</p></div></div></div>`;
    return `${head}${card('', `<div class="adv-gate">${orb('xl')}<b>Akkaunt kerak</b><p class="muted small">AI maslahatchi serverga ulanadi, shuning uchun avval akkauntga kiring (bu suiiste'moldan himoya qiladi).</p><button class="btn primary" data-act="cloud:login">Kirish / Ro'yxatdan o'tish</button></div>`)}`;
  }
  return `<div class="adv-app ${busy ? 'busy' : ''}" id="advApp"><div class="adv-shell">
    <header class="adv-head">
      ${orb('md')}
      <div class="adv-title"><b>Azimov AI</b><small><i class="dot"></i>Shaxsiy moliya maslahatchisi</small></div>
      <div class="adv-tools">
        <button type="button" class="icon-btn" data-act="adv:preview" aria-label="Nima yuboriladi?" title="Nima yuboriladi?">${icon('shield', 19)}</button>
        <button type="button" class="icon-btn" data-act="adv:menu" aria-label="Menyu" aria-expanded="false">${icon('menu', 19)}</button>
      </div>
      <div class="adv-menu" id="advMenu" hidden>
        <label class="adv-opt"><span><b>Nomlarni ham yuborish</b><small>Maqsad, obuna va biznes nomlari. O'chiq bo'lsa «Maqsad 1», «Biznes 1» deb ketadi</small></span><input type="checkbox" id="advNames" ${data.names ? 'checked' : ''}></label>
        <p class="adv-priv">${icon('shield', 14)} Ism, email, izoh, do'kon va hisob nomlari hech qachon yuborilmaydi.</p>
        ${data.msgs.length ? `<button type="button" class="adv-clear" data-act="adv:clear">${icon('trash', 15)} Suhbatni tozalash</button>` : ''}
      </div>
    </header>
    <div class="adv-body">
      <div id="advMsgs" class="adv-msgs" aria-live="polite">${msgsHtml()}</div>
      <button type="button" class="adv-down" id="advDown" data-act="adv:bottom" aria-label="Pastga" hidden>${icon('arrowDown', 18)}</button>
    </div>
    <footer class="adv-dock">
      <div class="adv-chips" id="advChips">${chipsHtml()}</div>
      <form id="advForm" class="adv-form" autocomplete="off">
        <textarea id="advIn" rows="1" maxlength="${MAX_Q}" placeholder="Azimov AI dan so'rang…" enterkeyhint="send" aria-label="Savol"></textarea>
        <button id="advSend" class="adv-send" type="submit" aria-label="Yuborish">${icon('send', 19)}</button>
      </form>
      <div class="adv-foot"><span class="adv-warn">AI xato qilishi mumkin. Bu moliyaviy, huquqiy yoki diniy maslahat emas.</span><span class="adv-meta"><span id="advCount"></span><span id="advQuota" class="adv-quota">${quotaHtml()}</span></span></div>
    </footer>
  </div></div>`;
}

let vvBound = false;
function bindViewport() {
  if (vvBound || !window.visualViewport) return;
  vvBound = true;
  const vv = window.visualViewport;
  const upd = () => {
    const app = document.getElementById('advApp');
    const root = document.documentElement;
    if (!app) {
      root.style.removeProperty('--vvh');
      root.style.removeProperty('--vvt');
      document.body.classList.remove('kb-open');
      return;
    }
    const open = window.innerHeight - vv.height > 120;
    root.style.setProperty('--vvh', vv.height + 'px');
    root.style.setProperty('--vvt', vv.offsetTop + 'px');
    document.body.classList.toggle('kb-open', open);
    if (open) {
      const box = document.getElementById('advMsgs');
      if (box) box.scrollTop = box.scrollHeight;
    }
  };
  vv.addEventListener('resize', upd);
  vv.addEventListener('scroll', upd);
  window.addEventListener('hashchange', () => setTimeout(upd, 50));
}

let menuBound = false;
export function afterAdvisor(root) {
  const form = root.querySelector('#advForm');
  if (!menuBound) {
    menuBound = true;
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('advMenu');
      if (menu && !menu.hidden && !e.target.closest('#advMenu') && !e.target.closest('[data-act="adv:menu"]')) closeMenu();
    });
  }
  if (!form) {
    document.body.classList.remove('kb-open');
    return;
  }
  bindViewport();
  root.querySelector('#advNames')?.addEventListener('change', (e) => {
    data.names = e.target.checked;
    persist();
  });
  const input = root.querySelector('#advIn');
  const count = root.querySelector('#advCount');
  const grow = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 150) + 'px';
    const n = input.value.length;
    count.textContent = n >= 350 ? `${n}/${MAX_Q}` : '';
    count.classList.toggle('hot', n >= 470);
    form.classList.toggle('has', !!input.value.trim());
  };
  input.addEventListener('input', grow);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value;
    if (!q.trim() || busy) return;
    input.value = '';
    grow();
    ask(q);
  });
  root.querySelector('#advMsgs').addEventListener('scroll', syncDown, { passive: true });
  paint({ stick: true });
  const box = root.querySelector('#advMsgs');
  box.scrollTop = data.msgs.length || busy ? box.scrollHeight : 0;
  syncDown();
}

function closeMenu() {
  const menu = document.getElementById('advMenu');
  if (!menu) return;
  menu.hidden = true;
  document.querySelector('[data-act="adv:menu"]')?.setAttribute('aria-expanded', 'false');
}

/* ---------- talking to the server ---------- */
const ERRORS = {
  login_required: 'Avval akkauntga kiring',
  not_configured: 'Maslahatchi hali sozlanmagan (server tomonida Gemini kaliti kiritilmagan)',
  rate_limited: 'Bugungi savollar limiti tugadi. Ertaga davom eting',
  quota: "Gemini limiti vaqtincha tugadi. Birozdan keyin urinib ko'ring",
  bad_key: "Gemini kaliti noto'g'ri yoki ruxsat yo'q. Kalitni tekshiring",
  blocked: "Gemini bu savolga javob bermadi (xavfsizlik filtri). Boshqacha so'rab ko'ring",
  empty: "Javob bo'sh keldi, qayta urinib ko'ring",
  upstream: "Gemini hozir javob bermayapti. Birozdan keyin urinib ko'ring",
  bad_request: "Savol juda uzun yoki noto'g'ri",
};
async function errorText(error) {
  try {
    const j = await error.context?.json?.();
    if (j?.error) return ERRORS[j.error] || 'Xatolik: ' + j.error;
  } catch {}
  return navigator.onLine ? "Maslahatchiga ulanib bo'lmadi, keyinroq urinib ko'ring" : "Internet yo'q";
}

const stopStatus = () => {
  clearInterval(statusTimer);
  statusTimer = null;
};
function startStatus() {
  stopStatus();
  let n = 0;
  statusTimer = setInterval(() => {
    const el = document.getElementById('advStatus');
    if (!el) return;
    n = Math.min(n + 1, STATUS.length - 1);
    el.textContent = STATUS[n];
  }, 2200);
}

// the last message in data.msgs is always the user's question when this runs
async function respond() {
  const idx = data.msgs.length - 1;
  const q = data.msgs[idx].t;
  busy = true;
  persist();
  paint();
  startStatus();
  try {
    // errors are never sent back as history; only the last 6 real turns before this question
    const history = data.msgs
      .slice(0, idx)
      .filter((m) => m.r === 'u' || m.r === 'a')
      .slice(-6)
      .map((m) => ({ role: m.r === 'u' ? 'user' : 'model', text: m.t }));
    const sb = await getClient();
    const { data: res, error } = await sb.functions.invoke('azimov-advisor', { body: { question: q, context: buildContext({ names: data.names }), history } });
    if (error) data.msgs.push({ r: 'e', t: await errorText(error), at: Date.now() });
    else {
      freshAt = Date.now();
      data.msgs.push({ r: 'a', t: res.answer, at: freshAt });
      data.quota = { used: res.used, limit: res.limit, day: utcDay() };
    }
  } catch (e) {
    data.msgs.push({ r: 'e', t: navigator.onLine ? "Maslahatchiga ulanib bo'lmadi, keyinroq urinib ko'ring" : "Internet yo'q", at: Date.now() });
  }
  stopStatus();
  busy = false;
  persist();
  paint();
}

export async function ask(question) {
  const q = String(question || '').trim().slice(0, MAX_Q);
  if (!q || busy) return;
  data.msgs.push({ r: 'u', t: q, at: Date.now() });
  await respond();
}

const popTail = () => {
  while (data.msgs.length && data.msgs[data.msgs.length - 1].r !== 'u') data.msgs.pop();
};

actions['adv:ask'] = (el) => ask(el.dataset.q);
actions['adv:retry'] = async () => {
  if (busy) return;
  popTail();
  if (data.msgs.length) await respond();
};
actions['adv:regen'] = async () => {
  if (busy) return;
  popTail(); // drop the answer, keep the question
  if (data.msgs.length) await respond();
};
actions['adv:copy'] = async (el) => {
  const m = data.msgs[Number(el.dataset.i)];
  if (!m) return;
  try {
    await navigator.clipboard.writeText(m.t);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = m.t;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
    } catch {}
    ta.remove();
  }
  toast('Nusxalandi');
};
actions['adv:fb'] = (el) => {
  const m = data.msgs[Number(el.dataset.i)];
  if (!m) return;
  m.fb = m.fb === el.dataset.v ? null : el.dataset.v;
  persist();
  paint({ stick: false });
  if (m.fb) toast(m.fb === 'up' ? 'Rahmat! Yaxshi javob deb belgilandi' : 'Qayd etildi. Savolni boshqacha berib ko\'ring');
};
actions['adv:bottom'] = () => {
  const box = document.getElementById('advMsgs');
  box?.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
};
actions['adv:menu'] = (el) => {
  const menu = document.getElementById('advMenu');
  if (!menu) return;
  menu.hidden = !menu.hidden;
  el.setAttribute('aria-expanded', String(!menu.hidden));
};
actions['adv:clear'] = async () => {
  closeMenu();
  if (!(await confirmBox("Suhbat tarixi shu qurilmadan o'chadi. Davom etasizmi?", { ok: 'Tozalash' }))) return;
  data.msgs = [];
  persist();
  actions._render();
};
actions['adv:preview'] = () => {
  closeMenu();
  const ctx = buildContext({ names: data.names });
  sheet({
    title: 'Gemini ga nima yuboriladi',
    footer: false,
    wide: true,
    body: `<p class="muted small">Har savol bilan aynan shu qisqa xulosa yuboriladi (shuningdek savolingiz va oxirgi 6 ta xabar). Boshqa hech narsa ketmaydi.</p><pre class="raw-pre" style="max-height:50vh">${esc(JSON.stringify(ctx, null, 2))}</pre>`,
  });
};
