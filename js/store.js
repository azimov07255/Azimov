import { uid, today, monthKey } from './utils.js';
import { DEFAULT_CATS } from './data.js';
import { configure } from './fmt.js';

const KEY = 'azimov.finance.v1';

function fresh() {
  return {
    v: 1,
    settings: { name: '', currency: 'UZS', usdRate: 12700, theme: 'dark', hide: false, onboarded: false },
    accounts: [
      { id: 'a_cash', name: 'Naqd pul', type: 'cash', icon: '💵', color: '#34d399', initial: 0 },
      { id: 'a_card', name: 'Plastik karta', type: 'card', icon: '💳', color: '#7c5cff', initial: 0 },
    ],
    categories: structuredClone(DEFAULT_CATS),
    transactions: [],
    budgets: {},
    goals: [],
    debts: [],
    subs: [],
    businesses: [],
    challenge: { base: 1000, done: [] },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) {
    console.warn('Load failed', e);
  }
  return fresh();
}
function normalize(s) {
  const f = fresh();
  const out = { ...f, ...s, settings: { ...f.settings, ...(s.settings || {}) } };
  if (!out.categories?.length) out.categories = f.categories;
  // make sure all default categories exist (new versions may add some)
  for (const c of DEFAULT_CATS) if (!out.categories.find((x) => x.id === c.id)) out.categories.push(structuredClone(c));
  return out;
}

export const state = load();
configure(state.settings.currency, state.settings.hide);

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
let saveTimer;
export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Save failed', e);
  }
}
export function commit() {
  configure(state.settings.currency, state.settings.hide);
  clearTimeout(saveTimer);
  save();
  listeners.forEach((fn) => fn());
}
export function replaceState(next) {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, normalize(next));
  commit();
}
export function resetAll() {
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, fresh());
  commit();
}

/* ---------- lookups ---------- */
export const catOf = (id) =>
  state.categories.find((c) => c.id === id) || { id, name: "Noma'lum", icon: '❓', color: '#94a3b8', type: 'expense' };
export const acctOf = (id) => state.accounts.find((a) => a.id === id);
export const cats = (type) => state.categories.filter((c) => c.type === type);

export function balanceOf(id) {
  const a = acctOf(id);
  let b = a?.initial || 0;
  for (const t of state.transactions) {
    if (t.type === 'income' && t.accountId === id) b += t.amount;
    else if (t.type === 'expense' && t.accountId === id) b -= t.amount;
    else if (t.type === 'transfer') {
      if (t.accountId === id) b -= t.amount;
      if (t.toAccountId === id) b += t.amount;
    }
  }
  return b;
}
export const totalBalance = () => state.accounts.reduce((s, a) => s + balanceOf(a.id), 0);
export const goalsAllocated = () => state.goals.reduce((s, g) => s + (g.saved || 0), 0);

/* ---------- transactions ---------- */
export function sortedTx() {
  return [...state.transactions].sort((a, b) => (a.date === b.date ? (b.ts || 0) - (a.ts || 0) : a.date < b.date ? 1 : -1));
}
export function addTx(t) {
  const tx = { id: uid(), ts: Date.now(), date: today(), note: '', ...t };
  state.transactions.push(tx);
  commit();
  return tx;
}
export function updateTx(id, patch) {
  const t = state.transactions.find((x) => x.id === id);
  if (t) Object.assign(t, patch);
  commit();
}
export function delTx(id) {
  state.transactions = state.transactions.filter((t) => t.id !== id);
  commit();
}

/* ---------- debts ---------- */
export const debtPaid = (d) => (d.payments || []).reduce((s, p) => s + p.amount, 0);
export const debtLeft = (d) => Math.max(0, d.amount - debtPaid(d));
export const iOwe = () => state.debts.filter((d) => d.type === 'borrowed').reduce((s, d) => s + debtLeft(d), 0);
export const owedToMe = () => state.debts.filter((d) => d.type === 'lent').reduce((s, d) => s + debtLeft(d), 0);
export const netWorth = () => totalBalance() + owedToMe() - iOwe();

/* ---------- subs ---------- */
export const CYCLES = { weekly: 'Haftalik', monthly: 'Oylik', yearly: 'Yillik' };
export const monthlyEq = (s) => (s.cycle === 'weekly' ? (s.amount * 52) / 12 : s.cycle === 'yearly' ? s.amount / 12 : s.amount);
export const subsMonthly = () => state.subs.filter((s) => s.active !== false).reduce((a, s) => a + monthlyEq(s), 0);

export const budgetTotal = () => Object.values(state.budgets).reduce((a, b) => a + (Number(b) || 0), 0);
export const thisMonth = () => monthKey(today());
