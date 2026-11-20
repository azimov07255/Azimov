import { replaceState, state } from '../store.js';
import { DEFAULT_CATS } from '../data.js';
import { ymd, addDays, today, rng, parseYmd, uid } from '../utils.js';
import { weekStart } from '../streams.js';

// Deterministic demo dataset covering ~4 months so every screen looks alive.
export function loadDemo() {
  const r = rng(20241120);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const between = (a, b) => a + r() * (b - a);
  const round = (n, s = 1000) => Math.round(n / s) * s;
  const T = today();
  const tx = [];
  const add = (type, amount, categoryId, accountId, date, note) => tx.push({ id: uid(), ts: parseYmd(date).getTime() + tx.length, type, amount: round(amount), categoryId, accountId, date, note: note || '' });

  const DAYS = 125;
  for (let i = DAYS; i >= 0; i--) {
    const date = addDays(T, -i);
    const d = parseYmd(date);
    const dom = d.getDate();
    const dow = d.getDay();
    if (dom === 5) add('income', 7800000, 'i_salary', 'a_card', date, 'Oylik maosh');
    if (dom === 20) add('income', 1500000 + round(r() * 1500000, 50000), 'i_free', 'a_card', date, 'Frilans loyiha');
    if (dom === 6) tx.push({ id: uid(), ts: parseYmd(date).getTime() + 5, type: 'transfer', amount: 2200000, accountId: 'a_card', toAccountId: 'a_cash', categoryId: null, date, note: 'Bankomatdan naqd pul' });
    if (dom === 1) add('expense', 1800000, 'c_home', 'a_card', date, 'Ijara');
    if (dom === 3) add('expense', round(between(280000, 420000), 5000), 'c_home', 'a_card', date, 'Kommunal');
    if (dom === 8) add('expense', 129000, 'c_phone', 'a_card', date, 'Internet');
    if (dom === 12) add('expense', 55000, 'c_phone', 'a_cash', date, 'Mobil aloqa');
    if (r() < 0.85) add('expense', between(25000, 95000), 'c_food', pick(['a_cash', 'a_card']), date, pick(['Korzinka', 'Bozor', 'Makro', 'Non va sut']));
    if (r() < 0.7) add('expense', between(9000, 30000), 'c_transport', 'a_cash', date, pick(['Taksi', 'Metro', 'Yandex Go']));
    if (r() < (dow === 5 || dow === 6 ? 0.85 : 0.5)) add('expense', between(15000, dow === 5 || dow === 6 ? 160000 : 45000), 'c_cafe', pick(['a_cash', 'a_card']), date, pick(['Kofe', 'Tushlik', 'Lavash', 'Kafe', 'Choyxona']));
    if (r() < 0.07) add('expense', between(60000, 450000), 'c_shop', 'a_card', date, pick(['Kiyim', 'Krossovka', 'Aksessuar']));
    if (r() < 0.05) add('expense', between(40000, 220000), 'c_health', 'a_cash', date, pick(['Dorixona', 'Shifokor']));
    if (r() < 0.06) add('expense', between(50000, 200000), 'c_fun', 'a_card', date, pick(['Kino', 'Konsert', 'O\'yin']));
    if (r() < 0.03) add('expense', between(100000, 350000), 'c_gift', 'a_cash', date, 'Sovg\'a');
    if (dom === 15) add('expense', 350000, 'c_edu', 'a_card', date, 'Ingliz tili kursi');
    if (dom === 10 && i < 90) add('expense', 99000, 'c_subs', 'a_card', date, 'Netflix');
  }
  // some transfers into savings
  [90, 60, 30, 2].forEach((i) => tx.push({ id: uid(), ts: Date.now() - i, type: 'transfer', amount: 1000000, accountId: 'a_card', toAccountId: 'a_save', categoryId: null, date: addDays(T, -i), note: "Jamg'armaga" }));

  const mk = (m) => ymd(new Date(new Date().getFullYear(), new Date().getMonth() + m, Math.min(28, new Date().getDate())));
  const biz = {
    id: 'biz1', name: 'Kofe kiosk', icon: '☕', color: '#f59e0b', capital: 18000000, startDate: addDays(T, -95),
    fixed: [{ id: uid(), name: 'Ijara', amount: 1200000 }, { id: uid(), name: 'Sotuvchi maoshi', amount: 1500000 }, { id: uid(), name: 'Internet va boshqa', amount: 150000 }],
    entries: [],
  };
  for (let i = 95; i >= 0; i--) {
    const date = addDays(T, -i);
    const dow = parseYmd(date).getDay();
    const trend = 1 + (95 - i) / 95 * 0.6;
    biz.entries.push({ id: uid(), ts: parseYmd(date).getTime(), type: 'income', amount: round(between(180000, 360000) * trend * (dow === 0 ? 0.7 : 1), 5000), date, note: 'Kunlik savdo' });
    if (i % 7 === 0) biz.entries.push({ id: uid(), ts: parseYmd(date).getTime() + 1, type: 'expense', amount: round(between(900000, 1300000) * trend, 10000), date, note: 'Xom ashyo (kofe, sut, stakan)' });
  }

  // daily income sources: Dad (70k Mon-Fri, daily) and Brother (75-80k Mon-Sat, collected weekly on Saturday)
  const streams = [
    { id: 'st1', name: 'Dadam', icon: '👨', color: '#7c5cff', days: [1, 2, 3, 4, 5], mode: 'fixed', amount: 70000, min: 0, max: 0, payMode: 'daily', payDay: 6, accountId: 'a_cash', categoryId: 'i_gift', start: addDays(T, -35), active: true },
    { id: 'st2', name: 'Akam (ish haqi)', icon: '🧔', color: '#22d3ee', days: [1, 2, 3, 4, 5, 6], mode: 'range', amount: 0, min: 75000, max: 80000, payMode: 'weekly', payDay: 6, accountId: 'a_cash', categoryId: 'i_salary', start: addDays(T, -35), active: true },
  ];
  const dayLog = { st1: {}, st2: {} };
  const thisWeek = weekStart(T);
  const lumps = {};
  for (let i = 35; i >= 0; i--) {
    const date = addDays(T, -i);
    if (date > T) continue;
    const dw = parseYmd(date).getDay();
    if (streams[0].days.includes(dw)) {
      if (r() < 0.08) dayLog.st1[date] = { s: 'off', a: 0, note: 'Dam oldi' };
      else {
        const id = uid();
        tx.push({ id, ts: parseYmd(date).getTime() + 7, type: 'income', amount: 70000, date, note: 'Dadam', accountId: 'a_cash', categoryId: 'i_gift', streamId: 'st1', day: date });
        dayLog.st1[date] = { s: 'paid', a: 70000, tx: id };
      }
    }
    if (streams[1].days.includes(dw)) {
      if (r() < 0.1) { dayLog.st2[date] = { s: 'off', a: 0, note: 'Bormadim' }; continue; }
      const a = round(between(75000, 80000), 1000);
      const ws = weekStart(date);
      if (ws < thisWeek) {
        // past weeks were paid out in one go on the Saturday of that week
        const pay = addDays(ws, 5);
        const l = (lumps[ws] ||= { id: uid(), amount: 0, date: pay });
        l.amount += a;
        dayLog.st2[date] = { s: 'paid', a, tx: l.id };
      } else dayLog.st2[date] = { s: 'earned', a };
    }
  }
  Object.values(lumps).forEach((l) => tx.push({ id: l.id, ts: parseYmd(l.date).getTime() + 9, type: 'income', amount: l.amount, date: l.date, note: 'Akam (ish haqi): haftalik ish haqi', accountId: 'a_cash', categoryId: 'i_salary', streamId: 'st2' }));

  replaceState({
    settings: { name: 'Azimov', currency: 'UZS', usdRate: 12700, theme: state.settings.theme || 'dark', hide: false, onboarded: true, demo: true },
    accounts: [
      { id: 'a_cash', name: 'Naqd pul', type: 'cash', icon: '💵', color: '#34d399', initial: 600000 },
      { id: 'a_card', name: 'Humo karta', type: 'card', icon: '💳', color: '#7c5cff', initial: 2500000 },
      { id: 'a_save', name: "Jamg'arma", type: 'savings', icon: '🏦', color: '#22d3ee', initial: 4000000 },
    ],
    categories: structuredClone(DEFAULT_CATS),
    transactions: tx,
    budgets: { c_food: 1800000, c_home: 2300000, c_transport: 600000, c_phone: 250000, c_health: 300000, c_edu: 350000, c_cafe: 1100000, c_shop: 600000, c_fun: 400000, c_gift: 300000, c_subs: 150000 },
    goals: [
      { id: 'g1', name: 'Avariya fondi', icon: '🛡️', color: '#34d399', target: 18000000, saved: 6500000, deadline: mk(8) },
      { id: 'g2', name: 'Biznes kapitali', icon: '🚀', color: '#7c5cff', target: 40000000, saved: 4000000, deadline: mk(14) },
      { id: 'g3', name: 'Sayohat', icon: '✈️', color: '#22d3ee', target: 12000000, saved: 2000000, deadline: '' },
    ],
    debts: [
      { id: 'd1', type: 'borrowed', person: 'Akmal aka', amount: 3000000, date: addDays(T, -40), due: addDays(T, 6), note: 'Telefon uchun', payments: [{ id: uid(), amount: 1000000, date: addDays(T, -12) }] },
      { id: 'd2', type: 'lent', person: "Do'stim Jasur", amount: 1500000, date: addDays(T, -25), due: addDays(T, 20), note: '', payments: [] },
    ],
    subs: [
      { id: 's1', name: 'Netflix', amount: 99000, cycle: 'monthly', nextDate: addDays(T, 2), categoryId: 'c_subs', accountId: 'a_card', icon: '📺', active: true },
      { id: 's2', name: 'Internet', amount: 129000, cycle: 'monthly', nextDate: addDays(T, 9), categoryId: 'c_phone', accountId: 'a_card', icon: '🌐', active: true },
      { id: 's3', name: 'Sport zal', amount: 250000, cycle: 'monthly', nextDate: addDays(T, -1), categoryId: 'c_fun', accountId: 'a_cash', icon: '🏋️', active: true },
      { id: 's4', name: 'iCloud 200GB', amount: 15000, cycle: 'monthly', nextDate: addDays(T, 14), categoryId: 'c_subs', accountId: 'a_card', icon: '☁️', active: true },
    ],
    businesses: [biz],
    streams,
    dayLog,
    challenge: { base: 1000, done: [1, 2, 3, 4, 5, 6, 7, 8] },
  });
}
