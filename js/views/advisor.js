import { esc } from '../utils.js';
import { icon } from '../icons.js';
import { sync, getClient } from '../sync.js';
import { actions, sheet, toast, card, confirmBox } from '../ui.js';
import { buildContext } from '../advisor-context.js';

const KEY = 'azimov.advisor.v1';
const MAX_MSGS = 40;
const SUGGEST = ['Nega bu oy ko\'p sarfladim?', 'Qayerdan tejasam bo\'ladi?', "Moliyaviy holatimni baholab ber", 'Qarzlarimni qanday tezroq yopaman?', "Biznes boshlashga tayyormanmi?"];

const load = () => {
  try {
    return { names: false, msgs: [], ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { names: false, msgs: [] };
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
let quota = null; // {used, limit}

/* ---------- tiny safe markdown: **bold**, lists, line breaks (everything is escaped first) ---------- */
export function md(text) {
  const lines = esc(text).split('\n');
  let html = '';
  let list = null;
  const close = () => {
    if (list) html += `</${list}>`;
    list = null;
  };
  for (const raw of lines) {
    const line = raw.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, '$1<i>$2</i>');
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      const tag = ul ? 'ul' : 'ol';
      if (list !== tag) {
        close();
        html += `<${tag}>`;
        list = tag;
      }
      html += `<li>${(ul || ol)[1]}</li>`;
    } else {
      close();
      html += line.trim() ? `<p>${line}</p>` : '';
    }
  }
  close();
  return html;
}

const bubble = (m) =>
  m.r === 'u'
    ? `<div class="msg u"><div class="bub">${esc(m.t)}</div></div>`
    : `<div class="msg a ${m.r === 'e' ? 'err' : ''}"><span class="av">${m.r === 'e' ? '⚠️' : '🤖'}</span><div class="bub">${m.r === 'e' ? esc(m.t) : md(m.t)}</div></div>`;

function msgsHtml() {
  if (!data.msgs.length && !busy)
    return `<div class="adv-empty"><div class="adv-ico">🤖</div><b>Moliyaviy maslahatchi</b><p class="muted small">Ma'lumotlaringiz asosida savolingizga javob beradi: xarajat, tejash, qarz, biznes.</p>
      <div class="adv-sug">${SUGGEST.map((s) => `<button type="button" class="hint" data-act="adv:ask" data-q="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`;
  return data.msgs.map(bubble).join('') + (busy ? `<div class="msg a"><span class="av">🤖</span><div class="bub typing"><i></i><i></i><i></i></div></div>` : '');
}
function paint() {
  const box = document.getElementById('advMsgs');
  if (!box) return;
  box.innerHTML = msgsHtml();
  box.scrollTop = box.scrollHeight;
  const send = document.getElementById('advSend');
  if (send) send.disabled = busy;
  const q = document.getElementById('advQuota');
  if (q) q.textContent = quota ? `Bugun: ${quota.used}/${quota.limit}` : '';
}

export function renderAdvisor() {
  const head = `<div class="page-head"><div class="back-row"><a class="icon-btn" href="#/tools" aria-label="Orqaga">${icon('chevL', 20)}</a><div><h1>Maslahatchi 🤖</h1><p class="sub">Gemini yordamida: ma'lumotlaringiz bo'yicha savol bering</p></div></div></div>`;
  if (!sync.user)
    return `${head}${card('', `<div class="adv-empty"><div class="adv-ico">🔐</div><b>Akkaunt kerak</b><p class="muted small">Maslahatchi serverga ulanadi, shuning uchun avval akkauntga kiring (bu suiiste'moldan himoya qiladi).</p><button class="btn primary" data-act="cloud:login">Kirish / Ro'yxatdan o'tish</button></div>`)}`;
  return `${head}
  <div class="adv">
    <section class="card adv-priv">
      <div class="split"><b>${icon('shield', 16)} Maxfiylik</b><button class="link-btn" style="margin:0" data-act="adv:preview">Nima yuboriladi?</button></div>
      <p class="muted small">Faqat <b>umumlashtirilgan raqamlar</b> yuboriladi. Ism, email, izoh, do'kon va hisob nomlari, qarz bergan kishilarning ismlari yuborilmaydi.</p>
      <label class="switch-row" style="border:0;padding:6px 0 0"><span><b>Maqsad / obuna / biznes nomlarini ham yuborish</b><small class="muted">O'chiq bo'lsa «Maqsad 1», «Biznes 1» deb yuboriladi</small></span><input type="checkbox" id="advNames" ${data.names ? 'checked' : ''}></label>
    </section>
    <section class="card adv-chat">
      <div id="advMsgs" class="adv-msgs">${msgsHtml()}</div>
      <form id="advForm" class="adv-form" autocomplete="off">
        <textarea id="advIn" class="input" rows="1" maxlength="500" placeholder="Savolingizni yozing..." enterkeyhint="send"></textarea>
        <button id="advSend" class="btn primary" type="submit" aria-label="Yuborish">${icon('send', 18)}</button>
      </form>
      <div class="split adv-foot"><span class="muted small">AI xato qilishi mumkin — bu moliyaviy, huquqiy yoki diniy maslahat emas.</span><span class="muted small" id="advQuota"></span></div>
      ${data.msgs.length ? `<button class="link-btn" style="margin:6px 0 0" data-act="adv:clear">Suhbatni tozalash</button>` : ''}
    </section>
  </div>`;
}

export function afterAdvisor(root) {
  const form = root.querySelector('#advForm');
  const input = root.querySelector('#advIn');
  root.querySelector('#advNames')?.addEventListener('change', (e) => {
    data.names = e.target.checked;
    persist();
  });
  if (!form) return;
  const grow = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  };
  input.addEventListener('input', grow);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value;
    input.value = '';
    grow();
    ask(q);
  });
  paint();
}

const ERRORS = {
  login_required: "Avval akkauntga kiring",
  not_configured: "Maslahatchi hali sozlanmagan (server tomonida Gemini kaliti kiritilmagan)",
  rate_limited: "Bugungi savollar limiti tugadi. Ertaga davom eting",
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

export async function ask(question) {
  const q = String(question || '').trim().slice(0, 500);
  if (!q || busy) return;
  data.msgs.push({ r: 'u', t: q, at: Date.now() });
  busy = true;
  persist();
  paint();
  try {
    const history = data.msgs
      .slice(0, -1)
      .filter((m) => m.r === 'u' || m.r === 'a')
      .slice(-6)
      .map((m) => ({ role: m.r === 'u' ? 'user' : 'model', text: m.t }));
    const sb = await getClient();
    const { data: res, error } = await sb.functions.invoke('azimov-advisor', { body: { question: q, context: buildContext({ names: data.names }), history } });
    if (error) data.msgs.push({ r: 'e', t: await errorText(error), at: Date.now() });
    else {
      data.msgs.push({ r: 'a', t: res.answer, at: Date.now() });
      quota = { used: res.used, limit: res.limit };
    }
  } catch (e) {
    data.msgs.push({ r: 'e', t: navigator.onLine ? "Maslahatchiga ulanib bo'lmadi, keyinroq urinib ko'ring" : "Internet yo'q", at: Date.now() });
  }
  busy = false;
  persist();
  paint();
}

actions['adv:ask'] = (el) => ask(el.dataset.q);
actions['adv:clear'] = async () => {
  if (!(await confirmBox("Suhbat tarixi shu qurilmadan o'chadi. Davom etasizmi?", { ok: "Tozalash" }))) return;
  data.msgs = [];
  persist();
  actions._render();
};
actions['adv:preview'] = () => {
  const ctx = buildContext({ names: data.names });
  sheet({
    title: 'Gemini ga nima yuboriladi',
    footer: false,
    wide: true,
    body: `<p class="muted small">Har savol bilan aynan shu qisqa xulosa yuboriladi (shuningdek savolingiz va oxirgi 6 ta xabar). Boshqa hech narsa ketmaydi.</p><pre class="raw-pre" style="max-height:50vh">${esc(JSON.stringify(ctx, null, 2))}</pre>`,
  });
};
