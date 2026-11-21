/**
 * Exchange rates from the Central Bank of Uzbekistan (via the azimov-rates edge function).
 * Stored in settings.rates = {USD, EUR, RUB, GBP, CNY, date, fetchedAt}. With settings.autoRate !== false the
 * USD rate also drives settings.usdRate, which the converter and bank-message import already use.
 */
import { state, commit } from './store.js';
import { RATES_URL } from './config.js';

const KEEP = ['USD', 'EUR', 'RUB', 'GBP', 'CNY', 'KZT', 'TRY'];
const MAX_AGE = 6 * 3600 * 1000;

export const autoRateOn = () => state.settings.autoRate !== false;
export const ratesInfo = () => state.settings.rates || null;
// 1 unit of `code` in UZS: the bank's rate if known, else the manual USD rate
export const rateOf = (code) => state.settings.rates?.[code] || (code === 'USD' ? state.settings.usdRate : 0) || 0;
export const rateMap = () => ({ ...(state.settings.rates || {}), USD: rateOf('USD') });

export async function refreshRates({ force = false } = {}) {
  const s = state.settings;
  if (!force && (!autoRateOn() || (s.rates && Date.now() - (s.rates.fetchedAt || 0) < MAX_AGE))) return s.rates || null;
  try {
    const r = await fetch(RATES_URL, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (!(j.rates?.USD > 0)) throw new Error('bad payload');
    const picked = {};
    for (const c of KEEP) if (j.rates[c] > 0) picked[c] = j.rates[c];
    s.rates = { ...picked, date: j.date, stale: !!j.stale, fetchedAt: Date.now() };
    if (autoRateOn() && picked.USD) s.usdRate = picked.USD;
    commit();
    return s.rates;
  } catch (e) {
    console.warn('rates', e.message);
    return null; // offline or bank down: keep whatever we have
  }
}
