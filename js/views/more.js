import { icon } from '../icons.js';
import { state } from '../store.js';
import { esc } from '../utils.js';

const ITEMS = [
  ['budgets', 'Byudjet', 'pie', "Toifalar bo'yicha limitlar", '#22d3ee'],
  ['daily', 'Kunlik daromad', 'calendar', "Dada/akadan kunlik pul: oldim, ishladim, dam", '#a78bfa'],
  ['goals', 'Maqsadlar', 'target', "Orzularni raqamga aylantiring", '#34d399'],
  ['debts', 'Qarzlar', 'users', "Kim kimga qarzdor", '#fb7185'],
  ['subs', "Takroriy to'lovlar", 'repeat', "Obuna va majburiy to'lovlar", '#818cf8'],
  ['reminders', 'Eslatmalar', 'bell', "To'lov, qarz va byudjet eslatmalari", '#fbbf24'],
  ['import', 'Bank xabarlari', 'msg', "SMS / Payme / Click xabarini import qilish", '#f472b6'],
  ['scan', 'Chek skanerlash', 'camera', "Chek rasmini olsangiz — o'zi yoziladi", '#fbbf24'],
  ['reports', 'Hisobotlar', 'file', "Oylik tahlil va PDF", '#60a5fa'],
  ['business', 'Biznes', 'briefcase', "Foyda va kapital qaytishi", '#22d3ee'],
  ['roundup', 'Yaxlitlab tejash', 'wallet', "Sezilmay yig'ish", '#fbbf24'],
  ['whatif', 'Nima bo\'ladi agar', 'sparkles', "Kelajak simulyatori", '#34d399'],
  ['payoff', 'Qarzni tez yopish', 'target', "Qarz rejasi", '#fb7185'],
  ['advisor', 'Maslahatchi (AI)', 'sparkles', "Savol bering — Gemini javob beradi", '#a78bfa'],
  ['zakat', 'Zakat va sadaqa', 'heart', "Zakat hisobi va sadaqalar", '#34d399'],
  ['tools', 'Asboblar', 'sliders', "Kalkulyatorlar va challenge", '#fbbf24'],
  ['settings', 'Sozlamalar', 'gear', "Hisoblar, kategoriyalar, ma'lumot", '#94a3b8'],
];
export function renderMore() {
  return `<div class="page-head"><div><h1>Ko'proq</h1><p class="sub">Barcha bo'limlar</p></div></div>
  <div class="more-grid">${ITEMS.map(([id, label, ic, sub, c]) => `<a class="more-i" href="#/${id}" style="--c:${c}"><span class="more-ico">${icon(ic, 24)}</span><b>${label}</b><small>${sub}</small></a>`).join('')}</div>`;
}
