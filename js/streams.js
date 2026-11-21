/**
 * Daily income sources ("Dadam: 70 000 every Mon-Fri", "Akam: 75-80 000 a day, paid weekly").
 * Every day of a source can be: paid (money received), earned (worked, not paid yet) or off (rest / did not go).
 * Paid days create real income transactions, so budgets, reports and the health score keep working unchanged.
 */
import { state, commit, cats } from './store.js';
import { uid, today, parseYmd, addDays } from './utils.js';

export const DOW_SHORT = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];
export const DOW_LONG = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

export const dowOf = (s) => parseYmd(s).getDay();
export const weekStart = (s) => addDays(s, -((dowOf(s) + 6) % 7));
export const getEntry = (sid, date) => state.dayLog?.[sid]?.[date] || null;
export const activeStreams = () => (state.streams || []).filter((s) => s.active !== false);
export const streamById = (id) => (state.streams || []).find((s) => s.id === id);

export const typical = (st) => (st.mode === 'range' ? Math.round((st.min + st.max) / 2 / 500) * 500 : st.amount || 0);
export const isScheduled = (st, date) => st.active !== false && date >= st.start && (st.days || []).includes(dowOf(date));

// amount to pre-fill when marking a day: last amount used for this source, else the typical one
export function suggestAmount(st) {
  const log = state.dayLog?.[st.id] || {};
  const last = Object.keys(log).filter((d) => log[d].a > 0).sort().pop();
  return st.mode === 'range' && last ? log[last].a : typical(st);
}

const r2 = (n) => Math.round(n * 100) / 100;
/** What is still owed for a day: the day's pay minus the lunch money already taken that day. */
export const net = (e) => r2((e?.a || 0) - (e?.lunch || 0));
const removeTx = (id) => (state.transactions = state.transactions.filter((t) => t.id !== id));

/**
 * Set / change / clear one day. next = null (clear) | {s:'paid'|'earned'|'off', a, note, accountId}.
 * Keeps transactions in sync: a paid day owns (a share of) an income transaction.
 */
export function applyEntry(st, date, next) {
  const log = (state.dayLog[st.id] ||= {});
  const prev = log[date];
  const before = prev?.s === 'paid' ? net(prev) : 0; // a settled day only owns its "net" share of the pay-out transaction
  if (prev?.ltx) removeTx(prev.ltx); // lunch money received that day is re-created below when it still applies
  if (before > 0 && prev.tx) {
    const tx = state.transactions.find((t) => t.id === prev.tx);
    if (tx) {
      tx.amount = r2(tx.amount - before); // a weekly settlement tx covers several days: only take this day's share out
      if (tx.amount <= 0.5) removeTx(tx.id);
    }
  }
  if (!next) delete log[date];
  else {
    const entry = { s: next.s, a: next.s === 'off' ? 0 : r2(next.a || 0) };
    if (next.note) entry.note = next.note;
    if (next.s === 'paid' && entry.a > 0) {
      const tx = {
        id: uid(), ts: Date.now(), type: 'income', amount: entry.a, date, note: st.name,
        accountId: next.accountId || st.accountId || state.accounts[0]?.id, categoryId: st.categoryId || 'i_salary', streamId: st.id, day: date,
      };
      state.transactions.push(tx);
      entry.tx = tx.id;
    }
    // lunch money: taken on the day, so it is real income right away; only the rest of the day's pay stays owed
    const lunch = next.s === 'earned' ? Math.min(r2(next.lunch || 0), entry.a) : 0;
    if (lunch > 0) {
      const ltx = {
        id: uid(), ts: Date.now(), type: 'income', amount: lunch, date, note: `${st.name}: tushlik puli`,
        accountId: next.accountId || st.accountId || state.accounts[0]?.id, categoryId: st.categoryId || 'i_salary', streamId: st.id, day: date,
      };
      state.transactions.push(ltx);
      entry.lunch = lunch;
      entry.ltx = ltx.id;
    }
    log[date] = entry;
  }
  commit();
}

export const unpaidDates = (st) => {
  const log = state.dayLog?.[st.id] || {};
  return Object.keys(log).filter((d) => log[d].s === 'earned').sort();
};
export const unpaidSum = (st) => unpaidDates(st).reduce((a, d) => a + net(state.dayLog[st.id][d]), 0);
export const totalUnpaid = () => activeStreams().reduce((a, st) => a + unpaidSum(st), 0);

/** One income transaction for several "earned" days (weekly pay-out). */
export function settle(st, dates, { accountId, date = today() } = {}) {
  const log = state.dayLog[st.id] || {};
  const use = dates.filter((d) => log[d]?.s === 'earned');
  const sum = r2(use.reduce((a, d) => a + net(log[d]), 0));
  if (!use.length) return 0;
  if (!(sum > 0)) {
    use.forEach((d) => (log[d] = { ...log[d], s: 'paid' })); // the lunch money already covered those days completely
    commit();
    return 0;
  }
  const tx = {
    id: uid(), ts: Date.now(), type: 'income', amount: sum, date, accountId: accountId || st.accountId || state.accounts[0]?.id,
    categoryId: st.categoryId || 'i_salary', note: `${st.name}: ${use.length} kunlik ish haqi`, streamId: st.id,
  };
  state.transactions.push(tx);
  use.forEach((d) => (log[d] = { ...log[d], s: 'paid', tx: tx.id }));
  commit();
  return sum;
}

/* ---------- views of the data ---------- */
export function dayStatus(st, date) {
  const e = getEntry(st.id, date);
  if (e) return e.s;
  const t = today();
  if (!isScheduled(st, date)) return 'rest';
  return date < t ? 'missed' : date === t ? 'pending' : 'planned';
}

export function weekModel(st, ws) {
  const days = [];
  const t = today();
  for (let i = 0; i < 7; i++) {
    const date = addDays(ws, i);
    const e = getEntry(st.id, date);
    days.push({ date, dow: dowOf(date), entry: e, status: dayStatus(st, date), scheduled: isScheduled(st, date), isToday: date === t });
  }
  const sumBy = (s) => days.reduce((a, d) => a + (d.entry?.s === s ? d.entry.a : 0), 0);
  const lunchBy = days.reduce((a, d) => a + (d.entry?.s === 'earned' ? d.entry.lunch || 0 : 0), 0);
  return {
    days,
    paid: sumBy('paid') + lunchBy, // lunch money already in hand counts as received
    earned: days.reduce((a, d) => a + (d.entry?.s === 'earned' ? net(d.entry) : 0), 0),
    expected: days.filter((d) => !d.entry && d.scheduled && d.date >= t).reduce((a) => a + typical(st), 0),
    worked: days.filter((d) => d.entry && d.entry.s !== 'off').length,
    off: days.filter((d) => d.entry?.s === 'off').length,
    missed: days.filter((d) => d.status === 'missed').length,
  };
}

/** Scheduled days in the last 30 days that were never marked. */
export function missedDays() {
  const t = today();
  const out = [];
  for (const st of activeStreams()) {
    for (let i = 1; i <= 30; i++) {
      const date = addDays(t, -i);
      if (date < st.start) break;
      if (isScheduled(st, date) && !getEntry(st.id, date)) out.push({ st, date });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function monthTotals(key) {
  const out = { paid: 0, earned: 0, days: 0, off: 0, byStream: {} };
  for (const st of state.streams || []) {
    const log = state.dayLog?.[st.id] || {};
    const b = (out.byStream[st.id] = { paid: 0, earned: 0, days: 0, off: 0 });
    for (const [d, e] of Object.entries(log)) {
      if (d.slice(0, 7) !== key) continue;
      if (e.s === 'paid') (b.paid += e.a), b.days++;
      else if (e.s === 'earned') (b.earned += net(e)), (b.paid += e.lunch || 0), b.days++;
      else b.off++;
    }
    out.paid += b.paid; out.earned += b.earned; out.days += b.days; out.off += b.off;
  }
  return out;
}

export const incomeCats = () => cats('income');
