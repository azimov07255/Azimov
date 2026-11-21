/**
 * Builds the ONLY thing the AI advisor ever sees: a small, aggregated summary.
 *
 * Never included: your name, e-mail, transaction notes, merchants, account names, the names of people you owe or who owe you,
 * individual transactions beyond the 5 biggest (category + amount + day of month, no text).
 * Names of goals / subscriptions / businesses / custom categories are sent only when the user switches "names" on.
 */
import { state, catOf, totalBalance, subsMonthly, iOwe, owedToMe, debtLeft, budgetTotal } from './store.js';
import { stats, curKey, monthsBack, baseline, healthScore, emergencyMonths, avgCategory } from './insights.js';
import { today, diffDays, daysInMonth, MONTHS } from './utils.js';
import { bizMonth, bizSummary } from './views/business.js';
import { curCode } from './fmt.js';

const r = Math.round;
const catName = (id, names) => {
  const c = catOf(id);
  return c.custom && !names ? 'Maxsus toifa' : c.name;
};

export function buildContext({ names = false } = {}) {
  const key = curKey();
  const t = today();
  const st = stats(key);
  const day = Number(t.slice(8));
  const dim = daysInMonth(key);
  const base = baseline();

  const cats = Object.entries(st.byCat)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, v]) => ({ nomi: catName(id, names), summa: r(v), ortacha_3oy: r(avgCategory(id)), limit: state.budgets[id] > 0 ? r(state.budgets[id]) : null }));

  const biggest = state.transactions
    .filter((x) => x.type === 'expense' && x.date.slice(0, 7) === key)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((x) => ({ toifa: catName(x.categoryId, names), summa: r(x.amount), oy_kuni: Number(x.date.slice(8)) }));

  const hs = healthScore();
  const prev = monthsBack(4).slice(0, 3).map((k) => {
    const s = stats(k);
    return { oy: k, daromad: r(s.income), xarajat: r(s.expense) };
  });

  const goals = state.goals.map((g, i) => ({
    nomi: names ? g.name : `Maqsad ${i + 1}`,
    yigildi: r(g.saved || 0),
    maqsad: r(g.target),
    muddat_kun: g.deadline ? diffDays(g.deadline, t) : null,
  }));

  const debts = state.debts
    .filter((d) => d.type === 'borrowed' && debtLeft(d) > 0)
    .map((d, i) => ({ nomi: `Qarz ${i + 1}`, qolgan: r(debtLeft(d)), yillik_foiz: d.rate || 0, minimal_tolov: r(d.minPay || 0), muddat_kun: d.due ? diffDays(d.due, t) : null }));

  const biz = state.businesses.map((b, i) => {
    const m = bizMonth(b, key);
    const s = bizSummary(b);
    return { nomi: names ? b.name : `Biznes ${i + 1}`, oylik_daromad: r(m.inc), oylik_xarajat: r(m.exp), oylik_foyda: r(m.profit), kapital: r(b.capital || 0), kapital_qaytish_oy: s.payback };
  });

  const ctx = {
    valyuta: curCode(),
    sana: t,
    oy: `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`,
    bu_oy: { daromad: r(st.income), xarajat: r(st.expense), sof: r(st.net), jamgarma_darajasi: st.rate === null ? null : Math.round(st.rate * 100) / 100, otgan_kun: day, oy_kunlari: dim, byudjet_jami: r(budgetTotal()) },
    oldingi_oylar: prev,
    ortacha_oylik: { daromad: r(base.income), xarajat: r(base.expense) },
    toifalar_bu_oy: cats,
    eng_katta_xarajatlar: biggest,
    salomatlik: { ball: hs.score, qismlar: hs.parts.map((p) => ({ nomi: p.label, ball: Math.round(p.pts), maks: p.max })) },
    zaxira_oy: Math.round(emergencyMonths() * 10) / 10,
    balans_jami: r(totalBalance()),
    maqsadlar: goals,
    qarzlarim: debts,
    menga_qarzdor_jami: r(owedToMe()),
    takroriy_tolovlar: { oyiga: r(subsMonthly()), soni: state.subs.filter((s) => s.active !== false).length, ...(names ? { nomlari: state.subs.map((s) => s.name) } : {}) },
    bizneslar: biz,
  };
  return ctx;
}
