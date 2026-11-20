import { state, totalBalance, catOf, budgetTotal, subsMonthly, iOwe, debtLeft } from './store.js';
import { today, monthKey, addMonths, daysInMonth, addDays, avg, sum, clamp, WEEKDAYS, parseYmd, diffDays, fmtDate } from './utils.js';
import { money, short, pct, curCode } from './fmt.js';

export const curKey = () => monthKey(today());
export const monthsBack = (n, end = curKey()) => Array.from({ length: n }, (_, i) => addMonths(end, -(n - 1 - i)));

export function stats(key) {
  const s = { key, income: 0, expense: 0, byCat: {}, incByCat: {}, byDay: {}, count: 0 };
  for (const t of state.transactions) {
    if (t.type === 'transfer' || t.date.slice(0, 7) !== key) continue;
    s.count++;
    if (t.type === 'income') {
      s.income += t.amount;
      s.incByCat[t.categoryId] = (s.incByCat[t.categoryId] || 0) + t.amount;
    } else {
      s.expense += t.amount;
      s.byCat[t.categoryId] = (s.byCat[t.categoryId] || 0) + t.amount;
      s.byDay[t.date] = (s.byDay[t.date] || 0) + t.amount;
    }
  }
  s.net = s.income - s.expense;
  s.rate = s.income > 0 ? s.net / s.income : null;
  return s;
}

// typical month: average of up to 3 previous months that have data (falls back to the current month)
export function baseline() {
  const cur = curKey();
  const prevs = monthsBack(4, cur).slice(0, 3).map(stats).filter((s) => s.count > 0);
  if (prevs.length) return { income: avg(prevs.map((s) => s.income)), expense: avg(prevs.map((s) => s.expense)), months: prevs.length };
  const c = stats(cur);
  return { income: c.income, expense: c.expense, months: c.count ? 1 : 0 };
}

export const liquid = () => totalBalance();
export function emergencyMonths() {
  const b = baseline();
  return b.expense > 0 ? Math.max(0, liquid()) / b.expense : 0;
}
export function dataMonths() {
  const keys = new Set(state.transactions.map((t) => t.date.slice(0, 7)));
  return keys.size;
}

/* ---------- forecast & safe to spend ---------- */
function spentThrough(key, day) {
  const o = { total: 0, byCat: {} };
  for (const t of state.transactions) {
    if (t.type !== 'expense' || t.date.slice(0, 7) !== key || Number(t.date.slice(8)) > day) continue;
    o.total += t.amount;
    o.byCat[t.categoryId] = (o.byCat[t.categoryId] || 0) + t.amount;
  }
  return o;
}

export function forecast() {
  const key = curKey();
  const st = stats(key);
  const t = today();
  const d = Number(t.slice(8));
  const dim = daysInMonth(key);
  const bt = budgetTotal();
  const b = baseline();
  const limit = bt > 0 ? bt : Math.max(st.income, b.income);
  const limitKind = bt > 0 ? 'budget' : 'income';
  const rate = d > 0 ? st.expense / d : 0;
  // Bills like rent are front-loaded, so a straight-line extrapolation overshoots.
  // Prefer last month's real shape (what was still spent after this day), scaled by current pace.
  const prevKey = addMonths(key, -1);
  const prevAll = stats(prevKey);
  const prevSo = spentThrough(prevKey, d).total;
  let projected;
  if (prevAll.expense > 0 && prevSo > 0) {
    const ratio = clamp(st.expense / prevSo, 0.6, 1.6);
    projected = st.expense + Math.max(0, prevAll.expense - prevSo) * ratio;
  } else projected = st.expense + rate * (dim - d);
  const left = dim - d + 1;
  const remaining = limit - st.expense;
  return { key, d, dim, spent: st.expense, income: st.income, limit, limitKind, projected, daysLeft: left, remaining, perDay: left > 0 ? Math.max(0, remaining) / left : 0, over: limit > 0 && projected > limit };
}

/* ---------- balance trend ---------- */
export function balanceSeries(days = 30) {
  const delta = {};
  for (const t of state.transactions) {
    if (t.type === 'income') delta[t.date] = (delta[t.date] || 0) + t.amount;
    else if (t.type === 'expense') delta[t.date] = (delta[t.date] || 0) - t.amount;
  }
  let bal = totalBalance();
  let cur = today();
  const out = [];
  for (let i = 0; i < days; i++) {
    out.unshift(bal);
    bal -= delta[cur] || 0;
    cur = addDays(cur, -1);
  }
  return out;
}

/* ---------- financial health score ---------- */
export function healthScore() {
  const key = curKey();
  const b = baseline();
  const st = stats(key);
  const parts = [];

  // 1. saving rate (35)
  const inc = b.income || st.income;
  const exp = b.expense || st.expense;
  const rate = inc > 0 ? (inc - exp) / inc : null;
  const p1 = rate === null ? 0 : clamp(rate / 0.2, 0, 1) * 35;
  parts.push({ key: 'save', label: "Jamg'arma darajasi", pts: p1, max: 35, note: rate === null ? "Daromad kiriting" : `${pct(Math.max(0, rate))} (maqsad 20%)` });

  // 2. budgets (20)
  const lim = Object.entries(state.budgets).filter(([, v]) => v > 0);
  let p2 = 0;
  let n2 = 'Byudjet belgilang';
  if (lim.length) {
    const ok = lim.filter(([id, v]) => (st.byCat[id] || 0) <= v).length;
    p2 = (ok / lim.length) * 20;
    n2 = `${ok}/${lim.length} kategoriya me'yorda`;
  }
  parts.push({ key: 'budget', label: 'Byudjetga rioya', pts: p2, max: 20, note: n2 });

  // 3. emergency fund (25)
  const em = emergencyMonths();
  const p3 = clamp(em / 3, 0, 1) * 25;
  parts.push({ key: 'fund', label: 'Avariya fondi', pts: p3, max: 25, note: b.expense > 0 ? `${em.toFixed(1)} oylik xarajat (maqsad 3)` : "Ma'lumot yetarli emas" });

  // 4. debt load (10)
  const owe = iOwe();
  const ref = (inc || 0) * 3;
  const ratio = owe <= 0 ? 0 : ref > 0 ? owe / ref : 1;
  const p4 = (1 - clamp(ratio, 0, 1)) * 10;
  parts.push({ key: 'debt', label: 'Qarz yuki', pts: p4, max: 10, note: owe <= 0 ? "Qarz yo'q 🎉" : `${money(owe)} qarz` });

  // 5. tracking consistency (10)
  const t = today();
  const days = new Set(state.transactions.filter((x) => x.date <= t && x.date > addDays(t, -14)).map((x) => x.date)).size;
  const p5 = clamp(days / 10, 0, 1) * 10;
  parts.push({ key: 'track', label: 'Hisob yuritish', pts: p5, max: 10, note: `So'nggi 14 kunda ${days} kun yozildi` });

  const score = Math.round(sum(parts, (p) => p.pts));
  const label = score >= 80 ? 'Ajoyib' : score >= 60 ? 'Yaxshi' : score >= 40 ? "O'rtacha" : 'Yaxshilash kerak';
  const tone = score >= 80 ? 'pos' : score >= 60 ? 'info' : score >= 40 ? 'warn' : 'neg';
  return { score, label, tone, parts };
}

/* ---------- smart insights ---------- */
export function insights() {
  const out = [];
  const key = curKey();
  const st = stats(key);
  const prev = stats(addMonths(key, -1));
  const b = baseline();
  const f = forecast();
  const push = (tone, icon, title, text) => out.push({ tone, icon, title, text });

  if (state.transactions.length === 0) {
    push('info', '✨', 'Boshlaymiz!', "Birinchi xarajat yoki daromadni qo'shing — ilova sizga shaxsiy maslahatlar bera boshlaydi.");
    return out;
  }

  // forecast
  if (f.limit > 0 && f.d >= 3) {
    if (f.over) {
      const diff = f.projected - f.limit;
      push('bad', '🚨', 'Oy oxirigacha limitdan oshib ketasiz', `Hozirgi sur'atda oy oxirigacha ~${money(f.projected)} sarflaysiz — ${f.limitKind === 'budget' ? 'byudjetdan' : 'daromaddan'} ${money(diff)} ko'p. Kunlik sarfni ${money(f.perDay)} ga tushiring.`);
    } else if (f.spent > 0) {
      push('good', '✅', "Sur'atingiz yaxshi", `Oy oxirigacha taxminan ${money(f.projected)} sarflaysiz. Taxminan ${money(Math.max(0, f.limit - f.projected))} tejab qolishingiz mumkin.`);
    }
  }

  // saving rate this month
  if (st.income > 0 && f.d >= 5) {
    const r = st.rate;
    if (r < 0) push('bad', '📉', "Xarajat daromaddan oshib ketdi", `Bu oy ${money(-st.net)} ga ortiq sarfladingiz. Ixtiyoriy xarajatlarni (kafe, xaridlar) qisqartiring.`);
    else if (r >= 0.2) push('good', '🏆', `Jamg'arma darajasi ${pct(r)}`, "20% dan yuqori — bu a'lo natija! Ortiqcha mablag'ni maqsad yoki investitsiyaga yo'naltiring.");
    else if (r < 0.1) push('warn', '💡', `Jamg'arma darajasi atigi ${pct(r)}`, `Maqsad — 20%. Oyiga yana ${money(Math.max(0, st.income * 0.2 - st.net))} tejash kerak.`);
  } else if (st.income === 0 && f.d >= 5 && st.expense > 0) {
    push('info', '💰', "Bu oy daromad kiritilmagan", "Aniq tahlil uchun maosh va boshqa daromadlaringizni yozib qo'ying.");
  }

  // category jumps vs same period last month
  const prevSoFar = spentThrough(prev.key, f.d).byCat;
  const jumps = Object.entries(st.byCat)
    .map(([id, v]) => ({ id, v, base: prevSoFar[id] || 0 }))
    .filter((x) => x.base > 0 && x.v > x.base * 1.3 && x.v - x.base > (b.expense || st.expense) * 0.03)
    .sort((a, c) => c.v - c.base - (a.v - a.base));
  if (jumps[0] && f.d >= 7) {
    const j = jumps[0];
    push('warn', catOf(j.id).icon, `${catOf(j.id).name}: +${Math.round((j.v / j.base - 1) * 100)}%`, `O'tgan oyning shu davriga nisbatan ${money(j.v - j.base)} ko'p sarfladingiz.`);
  }

  // budgets exceeded
  const over = Object.entries(state.budgets).filter(([id, v]) => v > 0 && (st.byCat[id] || 0) > v);
  if (over.length) {
    const [id, v] = over.sort((a, c) => (st.byCat[c[0]] || 0) - c[1] - ((st.byCat[a[0]] || 0) - a[1]))[0];
    push('bad', '⛔', `${catOf(id).name} byudjeti oshdi`, `Limit ${money(v)}, sarflandi ${money(st.byCat[id])}.${over.length > 1 ? ` Yana ${over.length - 1} ta kategoriyada ham oshgan.` : ''}`);
  } else if (!Object.values(state.budgets).some((v) => v > 0)) {
    push('info', '🎯', 'Byudjet belgilang', "Kategoriyalar bo'yicha limit qo'ysangiz, ilova har kuni qancha sarflash xavfsizligini ko'rsatadi. «Byudjet» bo'limida avto-reja bor.");
  }

  // small repeated spending ("latte factor")
  const t = today();
  const recent = state.transactions.filter((x) => x.type === 'expense' && x.date > addDays(t, -30));
  const smallLim = b.income > 0 ? b.income * 0.02 : curCode() === 'UZS' ? 50000 : 5;
  const smallBy = {};
  recent.filter((x) => x.amount <= smallLim && catOf(x.categoryId).grp === 'want').forEach((x) => (smallBy[x.categoryId] = [...(smallBy[x.categoryId] || []), x.amount]));
  const lat = Object.entries(smallBy).filter(([, a]) => a.length >= 8).sort((a, c) => sum(c[1]) - sum(a[1]))[0];
  if (lat) {
    const [id, arr] = lat;
    const yr = sum(arr) * 12;
    push('info', '☕', `"Kichik xarajatlar" tuzog'i: ${catOf(id).name}`, `Oxirgi 30 kunda ${arr.length} marta, jami ${money(sum(arr))}. Bu yiliga ~${money(yr)}. Yarmini tejasangiz va investitsiya qilsangiz, 5 yilda ~${money(futureValue(yr / 24, 0.15, 5))} bo'ladi.`);
  }

  // weekday pattern
  const wk = Array(7).fill(0);
  const wkN = Array(7).fill(0);
  state.transactions.filter((x) => x.type === 'expense' && x.date > addDays(t, -90)).forEach((x) => {
    const w = parseYmd(x.date).getDay();
    wk[w] += x.amount;
  });
  for (let i = 0; i < 90; i++) wkN[parseYmd(addDays(t, -i)).getDay()]++;
  const per = wk.map((v, i) => v / (wkN[i] || 1));
  const tot = sum(per);
  if (tot > 0) {
    const mx = per.indexOf(Math.max(...per));
    if (per[mx] > (tot / 7) * 1.4) push('info', '📆', `Eng qimmat kun — ${WEEKDAYS[mx].toLowerCase()}`, `Bu kuni o'rtacha ${money(per[mx])} sarflanadi (boshqa kunlarga nisbatan ${Math.round((per[mx] / (tot / 7) - 1) * 100)}% ko'p). Shu kun uchun oldindan limit qo'ying.`);
  }

  // subscriptions
  const sm = subsMonthly();
  if (sm > 0) {
    if (b.income > 0 && sm / b.income > 0.08) push('warn', '🔁', 'Obunalar og\'irlashib bormoqda', `Obunalar daromadingizning ${pct(sm / b.income)} ini oladi (${money(sm)}/oy, yiliga ${money(sm * 12)}). Ishlatmayotganlarini o'chiring.`);
  }

  // emergency fund
  if (b.expense > 0) {
    const em = emergencyMonths();
    if (em < 1) push('bad', '🛟', "Avariya fondi juda kichik", `Hozirgi mablag' atigi ${em.toFixed(1)} oylik xarajatni qoplaydi. Birinchi maqsad — 3 oylik (${money(b.expense * 3)}) zaxira.`);
    else if (em < 3) push('warn', '🛟', 'Avariya fondini to\'ldiring', `${em.toFixed(1)} oylik zaxira bor, tavsiya — kamida 3 oy (${money(b.expense * 3)}).`);
    else if (em >= 6) push('good', '🛡️', 'Zaxira mustahkam', `${em.toFixed(1)} oylik xarajatga yetadigan zaxira bor. Biznes yoki investitsiyaga tayyor poydevor!`);
  }

  // goals
  const g = state.goals.filter((x) => x.deadline && (x.saved || 0) < x.target).sort((a, c) => (a.deadline < c.deadline ? -1 : 1))[0];
  if (g) {
    const months = Math.max(1, Math.ceil(diffDays(g.deadline, t) / 30));
    push('info', g.icon || '🎯', `${g.name}: oyiga ${short(Math.max(0, g.target - g.saved) / months)}`, `${fmtDate(g.deadline, true)} gacha ${money(g.target - (g.saved || 0))} yetishmaydi. Har oy ${money((g.target - (g.saved || 0)) / months)} ajrating.`);
  }

  // debts due
  const dueDebts = state.debts.filter((d) => d.due && debtLeft(d) > 0 && diffDays(d.due, t) <= 7);
  if (dueDebts.length) {
    const d = dueDebts.sort((a, c) => (a.due < c.due ? -1 : 1))[0];
    const dd = diffDays(d.due, t);
    push(dd < 0 ? 'bad' : 'warn', '⏰', dd < 0 ? "Qarz muddati o'tgan" : 'Qarz muddati yaqin', `${d.person}: ${money(debtLeft(d))} — ${dd < 0 ? `${-dd} kun kechikkan` : dd === 0 ? 'bugun' : `${dd} kundan keyin`}.`);
  }

  const order = { bad: 0, warn: 1, info: 2, good: 3 };
  return out.sort((a, c) => order[a.tone] - order[c.tone]).slice(0, 6);
}

export function futureValue(monthly, annualRate, years, start = 0) {
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return start + monthly * n;
  return start * Math.pow(1 + r, n) + monthly * ((Math.pow(1 + r, n) - 1) / r);
}

/* ---------- business readiness ---------- */
export function businessReadiness() {
  const b = baseline();
  const em = emergencyMonths();
  const inc = b.income;
  const rate = inc > 0 ? (inc - b.expense) / inc : 0;
  const owe = iOwe();
  const debtOk = inc > 0 ? owe <= inc * 1 : owe === 0;
  const bizGoal = state.goals.find((g) => /biznes|startap|kapital|🚀|🏪/i.test(`${g.name} ${g.icon}`));
  const items = [
    { ok: em >= 3, title: "3 oylik avariya fondi", note: b.expense > 0 ? `Hozir: ${em.toFixed(1)} oy` : "Ma'lumot kerak" },
    { ok: rate >= 0.15, title: "Jamg'arma darajasi ≥ 15%", note: inc > 0 ? `Hozir: ${pct(Math.max(0, rate))}` : 'Daromad kiriting' },
    { ok: debtOk, title: 'Qarz yuki past (≤ 1 oylik daromad)', note: owe > 0 ? `Qarz: ${money(owe)}` : "Qarz yo'q" },
    { ok: !!bizGoal && (bizGoal.saved || 0) >= bizGoal.target * 0.5, title: 'Biznes kapitali ≥ 50% yig\'ilgan', note: bizGoal ? `${pct(Math.min(1, (bizGoal.saved || 0) / bizGoal.target))} yig'ildi` : "«Biznes kapitali» maqsadi yarating" },
    { ok: dataMonths() >= 3, title: "Kamida 3 oylik hisob yuritilgan", note: `${dataMonths()} oylik ma'lumot` },
  ];
  return { items, done: items.filter((i) => i.ok).length };
}
