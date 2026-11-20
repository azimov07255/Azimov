const CUR = {
  UZS: { sym: "so'm", dec: 0, name: "O'zbek so'mi" },
  USD: { sym: '$', dec: 2, pre: true, name: 'AQSh dollari' },
  EUR: { sym: '€', dec: 2, pre: true, name: 'Yevro' },
  RUB: { sym: '₽', dec: 0, name: 'Rubl' },
};
let c = CUR.UZS;
let code = 'UZS';
let hide = false;
export const currencies = Object.entries(CUR).map(([k, v]) => ({ code: k, name: v.name, sym: v.sym }));
export function configure(cc, hidden) {
  code = CUR[cc] ? cc : 'UZS';
  c = CUR[code];
  hide = !!hidden;
}
export const curCode = () => code;
export const curSym = () => c.sym;
export const decimals = () => c.dec;
export const isHidden = () => hide;

const group = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export function num(n, dec = 0) {
  n = Number(n) || 0;
  const [i, f] = Math.abs(n).toFixed(dec).split('.');
  return (n < 0 && Number(i + '.' + (f || 0)) !== 0 ? '−' : '') + group(i) + (f ? '.' + f : '');
}
export function money(n, o = {}) {
  if (hide && !o.force) return '••••••';
  n = Number(n) || 0;
  const d = o.dec ?? c.dec;
  const s = num(Math.abs(n), d);
  const neg = n < 0 && Math.abs(n) >= Math.pow(10, -d) / 2;
  const sign = neg ? '−' : o.sign && n > 0 ? '+' : '';
  return c.pre ? sign + c.sym + s : `${sign}${s} ${c.sym}`;
}
export function short(n, o = {}) {
  if (hide && !o.force) return '••';
  n = Number(n) || 0;
  const a = Math.abs(n);
  const sg = n < 0 ? '−' : '';
  const f = (x) => x.toFixed(x >= 100 ? 0 : 1).replace(/\.0$/, '');
  if (code === 'UZS') {
    if (a >= 1e9) return sg + f(a / 1e9) + ' mlrd';
    if (a >= 1e6) return sg + f(a / 1e6) + ' mln';
    if (a >= 1e3) return sg + f(a / 1e3) + ' ming';
    return sg + Math.round(a);
  }
  const p = c.pre ? c.sym : '';
  if (a >= 1e9) return sg + p + f(a / 1e9) + 'B';
  if (a >= 1e6) return sg + p + f(a / 1e6) + 'M';
  if (a >= 1e3) return sg + p + f(a / 1e3) + 'K';
  return sg + p + Math.round(a);
}
export const pct = (x, d = 0) => (Number(x) * 100).toFixed(d).replace(/\.0+$/, '') + '%';
export function parseAmt(v) {
  if (typeof v === 'number') return v;
  const n = Number(String(v ?? '').replace(/[\s ]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}
// raw number -> text for an input box
export const amtText = (n) => (n ? group(String(Math.round(n * 100) / 100).split('.')[0]) + (String(n).includes('.') ? '.' + String(n).split('.')[1].slice(0, 2) : '') : '');
