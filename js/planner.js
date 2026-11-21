/**
 * Pure money-planning maths (no DOM, no state): round-ups, "what if" projections, debt pay-off schedules.
 */

// ---- compound growth: `monthly` added at the end of each month, `annualRate` as a fraction (0.15) ----
export function futureValue(monthly, annualRate, years, start = 0) {
  const r = annualRate / 12;
  const n = Math.round(years * 12);
  if (r === 0) return start + monthly * n;
  return start * Math.pow(1 + r, n) + monthly * ((Math.pow(1 + r, n) - 1) / r);
}

// ---- round-up: 23 400 with step 5 000 -> 1 600 (spare change); exact multiples give 0 ----
export function ruAmount(amount, step) {
  if (!(step > 0) || !(amount > 0)) return 0;
  const up = Math.ceil(amount / step - 1e-9) * step;
  return Math.round((up - amount) * 100) / 100;
}

// ---- "what if": freed money per month -> where does it lead in N years? ----
export function whatIf({ income = 0, expense = 0, cuts = [], incomeDelta = 0, extra = 0, rate = 0.12, years = 5, start = 0, target = 0 }) {
  const cutSum = cuts.reduce((a, c) => a + (c.avg || 0) * (c.pct || 0), 0);
  const freed = cutSum + incomeDelta + extra;
  const base = income - expense; // what is saved per month today (can be negative)
  const baseSave = Math.max(0, base);
  const newSave = Math.max(0, base + freed);
  const y = Math.max(1, Math.round(years));
  const series = (m) => Array.from({ length: y + 1 }, (_, i) => futureValue(m, rate, i, start));
  const a = series(baseSave);
  const b = series(newSave);
  const monthsTo = (m) => {
    if (!(target > 0)) return null;
    let bal = start;
    for (let i = 1; i <= 1200; i++) {
      bal = bal * (1 + rate / 12) + m;
      if (bal >= target) return i;
    }
    return null;
  };
  return {
    freed, cutSum, base, baseSave, newSave, base_series: a, new_series: b,
    endBase: a[y], endNew: b[y], gain: b[y] - a[y],
    contributed: start + newSave * y * 12,
    monthsBase: monthsTo(baseSave), monthsNew: monthsTo(newSave),
  };
}

// ---- debt pay-off ----
// debts: [{id, name, left, rate (annual %), minPay, due}], budget = money available per month for ALL debts.
export const STRATEGIES = {
  snowball: { name: "Qor ko'chkisi", hint: "Eng kichik qarzdan boshlanadi — tez g'alaba, motivatsiya", order: (a, b) => a.left - b.left },
  avalanche: { name: 'Eng qimmat foizdan', hint: "Foizi eng yuqori qarzdan boshlanadi — jami foiz kam bo'ladi", order: (a, b) => b.rate - a.rate || a.left - b.left },
  due: { name: 'Muddat bo\'yicha', hint: "Muddati eng yaqin qarzdan boshlanadi — kechikishdan saqlaydi", order: (a, b) => (a.due || '9999') .localeCompare(b.due || '9999') || a.left - b.left },
};

export function simulatePayoff(debts, budget, strategy = 'snowball', maxMonths = 720) {
  const ds = debts.filter((d) => d.left > 0).map((d) => ({ ...d, b: d.left, rate: d.rate || 0, min: d.minPay || 0, paid: null }));
  const need = ds.reduce((a, d) => a + d.min, 0);
  const feasible = budget >= need - 1e-9;
  const pot = Math.max(budget, need);
  const order = [...ds].sort(STRATEGIES[strategy].order);
  let interest = 0;
  const history = [ds.reduce((a, d) => a + d.b, 0)];
  let m = 0;
  while (m < maxMonths && ds.some((d) => d.b > 0.005)) {
    m++;
    for (const d of ds) {
      if (d.b <= 0.005) continue;
      const i = (d.b * d.rate) / 1200;
      d.b += i;
      interest += i;
    }
    let left = pot;
    for (const d of ds) {
      if (d.b <= 0.005) continue;
      const p = Math.min(d.min, d.b, left);
      d.b -= p;
      left -= p;
    }
    for (const d of order) {
      if (left <= 0.005) break;
      if (d.b <= 0.005) continue;
      const p = Math.min(d.b, left);
      d.b -= p;
      left -= p;
    }
    for (const d of ds) if (d.b <= 0.005 && d.paid === null) (d.paid = m), (d.b = 0);
    history.push(ds.reduce((a, d) => a + d.b, 0));
  }
  const done = ds.every((d) => d.paid !== null);
  return {
    strategy, feasible, need, budget: pot, done, months: done ? m : null, interest: Math.round(interest),
    total: ds.reduce((a, d) => a + d.left, 0), history,
    order: order.map((d) => ({ id: d.id, name: d.name, left: d.left, rate: d.rate, paidMonth: d.paid })),
  };
}

// ---- zakat al-mal: 2.5% of net wealth that stays above the nisab for a (lunar) year ----
// Nisab options (grams). Which one applies is a matter of madhab/scholar: the app only calculates.
export const NISAB = {
  silver_hanafi: { g: 612.36, metal: 'silver', name: 'Kumush — 612,36 g (hanafiy: 200 dirham)' },
  gold_hanafi: { g: 87.48, metal: 'gold', name: 'Oltin — 87,48 g (hanafiy: 20 misqol)' },
  silver_595: { g: 595, metal: 'silver', name: 'Kumush — 595 g' },
  gold_85: { g: 85, metal: 'gold', name: 'Oltin — 85 g' },
};
export const LUNAR_YEAR_DAYS = 354;
export function zakatCalc({ cash = 0, goldG = 0, silverG = 0, goldPrice = 0, silverPrice = 0, goods = 0, receivable = 0, debts = 0, basis = 'silver_hanafi' }) {
  const goldValue = goldG * goldPrice;
  const silverValue = silverG * silverPrice;
  const assets = cash + goldValue + silverValue + goods + receivable;
  const net = Math.max(0, assets - debts);
  const n = NISAB[basis] || NISAB.silver_hanafi;
  const price = n.metal === 'gold' ? goldPrice : silverPrice;
  const nisab = price > 0 ? n.g * price : null;
  const eligible = nisab !== null && net >= nisab;
  return { assets, debts, net, goldValue, silverValue, nisab, nisabGrams: n.g, metal: n.metal, missingPrice: !(price > 0), eligible, zakat: eligible ? Math.round(net * 0.025 * 100) / 100 : 0 };
}
