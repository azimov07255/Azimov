import { state, commit } from '../store.js';
import { esc, sum } from '../utils.js';
import { money, short, pct, num, parseAmt, curSym } from '../fmt.js';
import { icon } from '../icons.js';
import { baseline, futureValue, emergencyMonths } from '../insights.js';
import { area } from '../charts.js';
import { actions, sheet, fAmount, fNumber, fSelect, fRange, progress, toast } from '../ui.js';
import { totalBalance } from '../store.js';
import { rateOf, ratesInfo, refreshRates } from '../rates.js';

const TOOLS = [
  ['compound', '📈', 'Foiz va investitsiya', "Oylik jamg'arma va murakkab foiz kuchi"],
  ['when', '⏳', 'Maqsadga qachon erishaman?', 'Summa, oylik hissa va daromad → muddat'],
  ['loan', '🏦', 'Kredit kalkulyatori', "Oylik to'lov va ortiqcha foiz"],
  ['emergency', '🛟', 'Avariya fondi', "Necha oylik zaxira kerak?"],
  ['breakeven', '⚖️', 'Zararsizlik nuqtasi', "Biznes uchun nechta sotish kerak"],
  ['rule', '🧮', '50/30/20 rejasi', "Daromadni to'g'ri taqsimlash"],
  ['coffee', '☕', 'Kichik xarajatlar kuchi', "Kundalik odatning yillik narxi"],
  ['currency', '💱', 'Valyuta konvertori', "So'm ↔ dollar"],
  ['challenge', '🗓️', '52 haftalik challenge', "Har hafta ko'proq tejash"],
];

export function renderTools() {
  return `<div class="page-head"><div><h1>Asboblar</h1><p class="sub">Pul bo'yicha qaror qabul qilishga yordam beruvchi kalkulyatorlar</p></div></div>
  <h3 class="sec" style="margin-top:0">✨ Aqlli vositalar</h3>
  <div class="tools smart"><a class="tool" href="#/roundup"><span class="tool-ico">🐖</span><b>Yaxlitlab tejash</b><small>Har xarajatni yaxlitlab, farqini maqsadga yig'adi</small></a><a class="tool" href="#/whatif"><span class="tool-ico">🔮</span><b>Nima bo'ladi agar...</b><small>Xarajat yoki daromad o'zgarsa, kelajak qanday bo'ladi</small></a><a class="tool" href="#/advisor"><span class="tool-ico">🤖</span><b>Maslahatchi (AI)</b><small>«Nega bu oy ko'p sarfladim?» — Gemini javob beradi</small></a><a class="tool" href="#/zakat"><span class="tool-ico">🤲</span><b>Zakat va sadaqa</b><small>Nisab, 2,5% hisobi va berilganlar daftari</small></a><a class="tool" href="#/payoff"><span class="tool-ico">🏁</span><b>Qarzni tez yopish</b><small>Qaysi qarzni birinchi yopish, necha oyda tugaydi</small></a></div>
  <h3 class="sec">🧮 Kalkulyatorlar</h3>
  <div class="tools">${TOOLS.map(([id, ico, name, sub]) => `<button class="tool" data-act="tool:open" data-tool="${id}"><span class="tool-ico">${ico}</span><b>${name}</b><small>${sub}</small></button>`).join('')}</div>`;
}

const vals = (form) => {
  const o = {};
  for (const el of form.elements) if (el.name) o[el.name] = el.type === 'radio' && !el.checked ? o[el.name] : el.tagName === 'SELECT' || el.type === 'radio' ? el.value : parseAmt(el.value);
  return o;
};
const out = (rows, extra = '') => `<div class="calc-rows">${rows.map(([l, v, cls = '']) => `<div class="cr ${cls}"><span>${l}</span><b>${v}</b></div>`).join('')}</div>${extra}`;

function calc(title, fields, compute, { onMount } = {}) {
  sheet({
    title,
    footer: false,
    wide: true,
    body: `<div class="calc-in">${fields}</div><div id="calcOut" class="calc-out"></div>`,
    onMount(form) {
      const box = form.querySelector('#calcOut');
      const run = () => (box.innerHTML = compute(vals(form), form));
      form.addEventListener('input', run);
      form.addEventListener('change', run);
      onMount?.(form, run);
      run();
    },
  });
}

actions['tool:open'] = (el) => TOOL_FNS[el.dataset.tool]?.();

const TOOL_FNS = {
  compound() {
    calc(
      'Foiz va investitsiya',
      `${fAmount("Boshlang'ich summa", 'start', { value: 0 })}${fAmount("Oylik qo'shimcha", 'monthly', { value: 500000 })}
       <div class="grid-2">${fNumber('Yillik foiz', 'rate', { value: 15, suffix: '%', step: 0.5 })}${fNumber('Muddat', 'years', { value: 5, suffix: 'yil', step: 1, min: 1, max: 50 })}</div>`,
      (v) => {
        const years = Math.max(1, Math.min(50, v.years || 1));
        const labels = [];
        const tot = [];
        const con = [];
        for (let y = 0; y <= years; y++) {
          labels.push(y + ' y');
          tot.push(futureValue(v.monthly, v.rate / 100, y, v.start));
          con.push(v.start + v.monthly * 12 * y);
        }
        const fv = tot[tot.length - 1];
        const c = con[con.length - 1];
        return out([
          ["Yakuniy summa", money(fv, { force: true }), 'big'],
          ["Siz qo'shgan", money(c, { force: true })],
          ['Foiz daromadi', money(fv - c, { force: true }), 'pos'],
          ['Foyda ulushi', c > 0 ? pct((fv - c) / fv) : '—'],
        ], `<div class="chart-wrap">${area(labels, [{ values: tot, color: '#34d399' }, { values: con, color: '#7c5cff', fill: false, dash: '4 4' }], { height: 190 })}</div><div class="legend-inline"><span><i style="background:#34d399"></i>Jami</span><span><i style="background:#7c5cff"></i>Qo'shilgan</span></div>`);
      }
    );
  },
  when() {
    calc(
      'Maqsadga qachon erishaman?',
      `${fAmount('Maqsad summasi', 'target', { value: 50000000 })}${fAmount('Hozirgi jamg\'arma', 'cur', { value: 0 })}${fAmount('Oylik hissa', 'monthly', { value: Math.max(0, Math.round((baseline().income - baseline().expense) / 1000) * 1000) || 1000000 })}${fNumber('Yillik foiz (ixtiyoriy)', 'rate', { value: 0, suffix: '%' })}`,
      (v) => {
        if (v.target <= v.cur) return out([['Natija', 'Maqsadga allaqachon erishgansiz 🎉', 'big']]);
        if (v.monthly <= 0 && v.rate <= 0) return out([['Natija', "Oylik hissa kiriting", 'big']]);
        const r = v.rate / 100 / 12;
        let bal = v.cur;
        let m = 0;
        while (bal < v.target && m < 1200) {
          bal = bal * (1 + r) + v.monthly;
          m++;
        }
        if (m >= 1200) return out([['Natija', '100 yildan ortiq 😅 — hissani oshiring', 'big']]);
        const d = new Date();
        d.setMonth(d.getMonth() + m);
        const y = Math.floor(m / 12);
        return out([['Kerakli vaqt', `${y ? y + ' yil ' : ''}${m % 12 ? (m % 12) + ' oy' : ''}`.trim(), 'big'], ['Taxminiy sana', `${d.getFullYear()}-yil, ${['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'][d.getMonth()]}`], ["Siz qo'shasiz", money(v.monthly * m, { force: true })], ['Foizdan', money(Math.max(0, bal - v.cur - v.monthly * m), { force: true }), 'pos']]);
      }
    );
  },
  loan() {
    calc(
      'Kredit kalkulyatori',
      `${fAmount('Kredit summasi', 'amount', { value: 30000000 })}<div class="grid-2">${fNumber('Yillik foiz', 'rate', { value: 24, suffix: '%', step: 0.5 })}${fNumber('Muddat', 'months', { value: 24, suffix: 'oy', step: 1, min: 1 })}</div>`,
      (v) => {
        const n = Math.max(1, Math.round(v.months));
        const r = v.rate / 100 / 12;
        const pmt = r === 0 ? v.amount / n : (v.amount * r) / (1 - Math.pow(1 + r, -n));
        const total = pmt * n;
        return out([["Oylik to'lov", money(pmt, { force: true }), 'big'], ["Jami to'lov", money(total, { force: true })], ['Ortiqcha foiz', money(total - v.amount, { force: true }), 'neg'], ['Haqiqiy narxi', v.amount > 0 ? `${pct(total / v.amount - 1, 1)} qimmatroq` : '—']], `<p class="muted small">Ishlatilgan formula: annuitet. Kreditni muddatidan oldin yopsangiz, ortiqcha foiz kamayadi.</p>`);
      }
    );
  },
  emergency() {
    const b = baseline();
    calc(
      'Avariya fondi',
      `${fAmount("Oylik majburiy xarajat", 'exp', { value: Math.round(b.expense) })}${fRange('Necha oylik zaxira', 'months', { min: 1, max: 12, value: 3, suffix: ' oy' })}${fAmount('Hozirgi zaxira', 'cur', { value: Math.max(0, Math.round(totalBalance())) })}${fAmount('Oyiga ajrata olaman', 'save', { value: Math.max(0, Math.round((b.income - b.expense) / 1000) * 1000) })}`,
      (v) => {
        const target = v.exp * v.months;
        const gap = Math.max(0, target - v.cur);
        return out([['Kerakli zaxira', money(target, { force: true }), 'big'], ['Yetishmaydi', gap > 0 ? money(gap, { force: true }) : "Yetarli ✅", gap > 0 ? 'neg' : 'pos'], ['Erishish muddati', gap <= 0 ? '—' : v.save > 0 ? `${Math.ceil(gap / v.save)} oy` : 'Oylik hissa kiriting']], `${progress(target ? Math.min(1, v.cur / target) : 0, { h: 10 })}<p class="muted small">Barqaror daromad bo'lsa 3 oy, biznes yoki frilans bo'lsa 6–12 oy zaxira tavsiya etiladi.</p>`);
      }
    );
  },
  breakeven() {
    calc(
      'Zararsizlik nuqtasi',
      `${fAmount('Doimiy xarajat (oyiga)', 'fixed', { value: 3000000 })}<div class="grid-2">${fAmount('Mahsulot narxi', 'price', { value: 25000 })}${fAmount('Tannarxi (1 dona)', 'cost', { value: 10000 })}</div>${fAmount('Istalgan oylik foyda', 'goal', { value: 0 })}`,
      (v) => {
        const m = v.price - v.cost;
        if (m <= 0) return out([['Natija', 'Narx tannarxdan yuqori bo\'lishi kerak', 'neg big']]);
        const u = v.fixed / m;
        const ug = (v.fixed + v.goal) / m;
        return out([['Zararsizlik', `${Math.ceil(u)} dona/oy`, 'big'], ['Kunlik', `${(u / 30).toFixed(1)} dona`], ['Daromad nuqtasi', money(Math.ceil(u) * v.price, { force: true })], ['Marja', pct(m / v.price)], ...(v.goal > 0 ? [[`${short(v.goal, { force: true })} foyda uchun`, `${Math.ceil(ug)} dona/oy`, 'pos']] : [])]);
      }
    );
  },
  rule() {
    const b = baseline();
    calc(
      '50/30/20 rejasi',
      `${fAmount('Oylik daromad', 'inc', { value: Math.round(b.income) || 5000000, big: true })}`,
      (v) => out([['🏠 Zarur xarajatlar (50%)', money(v.inc * 0.5, { force: true })], ['🎉 Xohishlar (30%)', money(v.inc * 0.3, { force: true })], ["💎 Jamg'arma / investitsiya (20%)", money(v.inc * 0.2, { force: true }), 'pos big']], `<p class="muted small">Biznes boshlamoqchi bo'lsangiz jamg'arma ulushini 30–40% gacha oshirishga harakat qiling.</p>`)
    );
  },
  coffee() {
    calc(
      'Kichik xarajatlar kuchi',
      `${fAmount('Bir martalik narx', 'price', { value: 25000 })}<div class="grid-2">${fNumber('Haftasiga necha marta', 'times', { value: 5, step: 1, min: 0, max: 50 })}${fNumber('Foiz (yillik)', 'rate', { value: 15, suffix: '%' })}</div>`,
      (v) => {
        const yearly = v.price * v.times * 52;
        return out([['Yiliga', money(yearly, { force: true }), 'big neg'], ['10 yilda (sarflanadi)', money(yearly * 10, { force: true })], ['Agar investitsiya qilsangiz (10 yil)', money(futureValue(yearly / 12, v.rate / 100, 10), { force: true }), 'pos']], `<p class="muted small">Maqsad — o'zingizni ayblash emas, balki ongli tanlov qilish: bu summa sizga haqiqatan quvonch keltiryaptimi?</p>`);
      }
    );
  },
  currency() {
    const info = ratesInfo();
    const CUR = ['USD', 'EUR', 'RUB', 'GBP', 'CNY'];
    calc(
      'Valyuta konvertori',
      `<div class="field"><span>Valyuta</span><div class="seg">${CUR.map((c, i) => `<label><input type="radio" name="cur" value="${c}" ${i === 0 ? 'checked' : ''}><span>${c}</span></label>`).join('')}</div></div>
       ${fNumber("Kurs: 1 birlik = so'm", 'rate', { value: rateOf('USD'), step: 0.01 })}
       ${fAmount("So'm", 'uzs', { value: 1000000 })}${fAmount('Chet el valyutasi', 'fx', { value: 100 })}`,
      (v) => {
        const r = v.rate || 1;
        return out([[`So'm → ${v.cur}`, `${num(v.uzs / r, 2)} ${v.cur}`, 'big'], [`${num(v.fx, 2)} ${v.cur} → so'm`, `${num(v.fx * r)} so'm`]], `<p class="muted small">${info ? `Manba: Markaziy bank (CBU), ${esc(info.date)}.` : "Kurs qo'lda kiritilgan."} Bank va bozor kursi farq qilishi mumkin.</p>`);
      },
      {
        onMount(form, run) {
          const setRate = (c) => {
            const r = rateOf(c);
            if (r) form.rate.value = r;
          };
          form.addEventListener('change', (e) => {
            if (e.target.name === 'cur') {
              setRate(e.target.value);
              run();
            }
          });
          refreshRates().then(() => {
            setRate(form.cur.value || 'USD');
            run();
          });
        },
      }
    );
  },
  challenge() {
    const ch = state.challenge;
    const draw = (form) => {
      const base = ch.base || 1000;
      const done = new Set(ch.done);
      const total = sum([...done], (w) => w * base);
      const all = sum(Array.from({ length: 52 }, (_, i) => i + 1), (w) => w * base);
      form.querySelector('#chBody').innerHTML = `
        <div class="calc-rows"><div class="cr big"><span>Yig'ildi</span><b class="pos">${money(total, { force: true })}</b></div><div class="cr"><span>52 haftada jami</span><b>${money(all, { force: true })}</b></div><div class="cr"><span>Bajarildi</span><b>${done.size}/52 hafta</b></div></div>
        ${progress(done.size / 52, { h: 10 })}
        <div class="weeks">${Array.from({ length: 52 }, (_, i) => i + 1).map((w) => `<button type="button" class="wk ${done.has(w) ? 'on' : ''}" data-w="${w}" title="${money(w * base, { force: true })}"><b>${w}</b><small>${short(w * base, { force: true })}</small></button>`).join('')}</div>`;
    };
    sheet({
      title: '52 haftalik challenge',
      footer: false,
      wide: true,
      body: `<p class="muted small">1-haftada 1×, 2-haftada 2×, ... 52-haftada 52× bazaviy summani tejang. Bajargan haftangizni bosib belgilang.</p>${fAmount('Bazaviy summa (1-hafta)', 'base', { value: ch.base || 1000 })}<div id="chBody"></div>`,
      onMount(form) {
        form.addEventListener('input', (e) => {
          if (e.target.name === 'base') {
            ch.base = parseAmt(e.target.value) || 1000;
            commit();
            draw(form);
          }
        });
        form.addEventListener('click', (e) => {
          const b = e.target.closest('[data-w]');
          if (!b) return;
          const w = Number(b.dataset.w);
          ch.done = ch.done.includes(w) ? ch.done.filter((x) => x !== w) : [...ch.done, w];
          commit();
          draw(form);
        });
        draw(form);
      },
    });
  },
};
