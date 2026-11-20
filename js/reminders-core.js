/**
 * Reminder rules. PURE module: no imports, no DOM, no Date.now() - so the exact same file runs in the browser
 * (in-app list + local notifications) and in the Supabase edge function (push while the app is closed).
 *
 *   computeReminders(snapshot, now)  -> [{id, kind, when, level, icon, title, body, href}]
 *   shouldDeliver(reminder, now, prefs) -> boolean   (time-of-day rules)
 * `now` = { date: 'YYYY-MM-DD', hour: 0-23 } in the USER's local time.
 */
export const DEFAULT_NOTIFY = { subs: true, debts: true, budget: true, evening: false, close: true, hour: 9, eveningHour: 21, daysBefore: 1 };
export const notifyPrefs = (snap) => ({ ...DEFAULT_NOTIFY, ...(snap?.settings?.notify || {}) });

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
const utc = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const diff = (a, b) => Math.round((utc(a) - utc(b)) / 864e5);
const addDaysStr = (s, n) => new Date(utc(s) + n * 864e5).toISOString().slice(0, 10);
const prevMonthKey = (key) => {
  let y = +key.slice(0, 4);
  let m = +key.slice(5, 7) - 1;
  if (m < 1) {
    y -= 1;
    m = 12;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
};
const CUR = { UZS: ["so'm", false], USD: ['$', true], EUR: ['€', true], RUB: ['₽', false] };
export function money(n, cur = 'UZS') {
  const [sym, pre] = CUR[cur] || CUR.UZS;
  const dec = cur === 'UZS' || cur === 'RUB' ? 0 : 2;
  const s = Math.abs(n).toFixed(dec).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return pre ? sym + s : `${s} ${sym}`;
}
const left = (d) => Math.max(0, d.amount - (d.payments || []).reduce((a, p) => a + p.amount, 0));

export function computeReminders(snap, now) {
  const P = notifyPrefs(snap);
  const cur = snap.settings?.currency || 'UZS';
  const M = (n) => money(n, cur);
  const today = now.date;
  const key = today.slice(0, 7);
  const out = [];

  if (P.subs) {
    for (const s of snap.subs || []) {
      if (s.active === false) continue;
      const dd = diff(s.nextDate, today);
      if (dd > P.daysBefore) continue;
      out.push({
        id: `sub:${s.id}:${s.nextDate}`, kind: 'sub', when: 'digest', level: dd < 0 ? 'bad' : 'warn', icon: s.icon || '🔁', href: '#/subs', order: dd,
        title: dd < 0 ? `${s.name}: to'lov muddati o'tgan` : dd === 0 ? `${s.name}: bugun to'lov` : `${s.name}: ${dd === 1 ? 'ertaga' : dd + ' kundan keyin'} to'lov`,
        body: `${M(s.amount)}${dd < 0 ? ` · ${-dd} kun kechikkan` : ''}`,
      });
    }
  }

  if (P.debts) {
    for (const d of snap.debts || []) {
      if (!d.due || left(d) <= 0) continue;
      const dd = diff(d.due, today);
      if (dd > 3) continue;
      const when = dd < 0 ? `${-dd} kun kechikkan` : dd === 0 ? 'bugun' : `${dd} kundan keyin`;
      out.push({
        id: `debt:${d.id}:${d.due}`, kind: 'debt', when: 'digest', level: dd < 0 ? 'bad' : 'warn', icon: d.type === 'borrowed' ? '📤' : '📥', href: '#/debts', order: dd,
        title: d.type === 'borrowed' ? `${d.person}ga qarz muddati: ${when}` : `${d.person} qarzni qaytarishi kerak: ${when}`,
        body: M(left(d)),
      });
    }
  }

  if (P.budget) {
    const spent = {};
    for (const t of snap.transactions || []) if (t.type === 'expense' && t.date.slice(0, 7) === key) spent[t.categoryId] = (spent[t.categoryId] || 0) + t.amount;
    const cats = new Map((snap.categories || []).map((c) => [c.id, c]));
    for (const [id, lim] of Object.entries(snap.budgets || {})) {
      if (!(lim > 0) || !cats.has(id)) continue;
      const r = (spent[id] || 0) / lim;
      if (r < 0.8) continue;
      const c = cats.get(id);
      const over = r >= 1;
      out.push({
        id: `bud:${id}:${key}:${over ? 100 : 80}`, kind: 'budget', when: 'now', level: over ? 'bad' : 'warn', icon: c.icon, href: '#/budgets', order: over ? -2 : -1,
        title: over ? `${c.name}: byudjet oshdi` : `${c.name}: byudjetning ${Math.round(r * 100)}% i ishlatildi`,
        body: `${M(spent[id])} / ${M(lim)}${over ? ` · ${M(spent[id] - lim)} oshgan` : ` · ${M(lim - spent[id])} qoldi`}`,
      });
    }
  }

  if (P.close) {
    const pk = prevMonthKey(key);
    const day = +today.slice(8, 10);
    const had = (snap.transactions || []).some((t) => t.type !== 'transfer' && t.date.slice(0, 7) === pk);
    if (day <= 10 && had && !snap.closings?.[pk]) {
      out.push({ id: `close:${pk}`, kind: 'close', when: 'digest', level: 'info', icon: '🧾', href: '#/budgets', order: 5, title: `${MONTHS[+pk.slice(5, 7) - 1]} oyini yoping`, body: "Natijani ko'ring va tejagan pulingizni maqsadlarga taqsimlang" });
    }
  }

  if (P.evening && now.hour >= P.eveningHour) {
    const txs = snap.transactions || [];
    const hasToday = txs.some((t) => t.date === today);
    const recent = txs.some((t) => t.date < today && t.date >= addDaysStr(today, -7));
    if (!hasToday && recent) out.push({ id: `ev:${today}`, kind: 'evening', when: 'evening', level: 'info', icon: '📝', href: '#/dashboard', order: 9, title: 'Bugungi xarajatlaringizni yozdingizmi?', body: "1 daqiqa vaqt oling: «taksi 25 ming» deb yozing" });
  }
  return out.sort((a, b) => a.order - b.order);
}

export function shouldDeliver(r, now, P) {
  if (r.when === 'digest') return now.hour >= P.hour && now.hour < 22;
  if (r.when === 'evening') return now.hour >= P.eveningHour && now.hour < 23;
  return now.hour >= 8 && now.hour < 22; // 'now' alerts respect quiet hours
}
