import { state, commit, balanceOf, owedToMe, iOwe, addTx } from '../store.js';
import { esc, today, addDays, fmtDate, sum, parseYmd } from '../utils.js';
import { money, parseAmt, amtText, num } from '../fmt.js';
import { icon } from '../icons.js';
import { zakatCalc, NISAB, LUNAR_YEAR_DAYS } from '../planner.js';
import { actions, sheet, fAmount, fSelect, fDate, fText, card, empty, toast, amt, progress } from '../ui.js';
import { txRow } from './tx.js';

const DEFAULTS = { basis: 'silver_hanafi', goldPrice: 0, silverPrice: 0, goldG: 0, silverG: 0, goods: 0, cash: 0, useAcc: true, useRec: true, useDebt: true, hawl: '' };
const zs = () => ({ ...DEFAULTS, ...(state.settings.zakat || {}) });
const KINDS = { zakat: 'Zakat', sadaqa: 'Sadaqa', fitr: 'Fitr sadaqasi', xayriya: 'Xayriya' };

const accountsTotal = () => state.accounts.reduce((a, x) => a + Math.max(0, balanceOf(x.id)), 0);

function compute(z) {
  return zakatCalc({
    cash: (z.useAcc ? accountsTotal() : 0) + z.cash,
    goldG: z.goldG, silverG: z.silverG, goldPrice: z.goldPrice, silverPrice: z.silverPrice, goods: z.goods,
    receivable: z.useRec ? owedToMe() : 0, debts: z.useDebt ? iOwe() : 0, basis: z.basis,
  });
}

function outHtml(z) {
  const r = compute(z);
  const row = (l, v, cls = '') => `<div class="cr ${cls}"><span>${l}</span><b>${v}</b></div>`;
  let head;
  if (r.missingPrice) head = `<div class="banner warn">${icon('bell', 18)}<span>Nisabni aniqlash uchun <b>${r.metal === 'gold' ? 'oltin' : 'kumush'} narxini</b> (1 gramm) kiriting.</span></div>`;
  else if (r.eligible) head = row('Zakat miqdori (2,5%)', money(r.zakat, { force: true }), 'big');
  else head = `<div class="cr big neutral"><span>Mablag' nisabga yetmagan</span><b>Zakat farz emas</b></div>`;
  let hawl = '';
  if (z.hawl) {
    const due = addDays(z.hawl, LUNAR_YEAR_DAYS);
    const left = Math.round((parseYmd(due) - parseYmd(today())) / 864e5);
    const p = Math.min(1, Math.max(0, 1 - left / LUNAR_YEAR_DAYS));
    hawl = `<div class="zk-hawl"><div class="split"><span>Yil to'lishi (qamariy ~${LUNAR_YEAR_DAYS} kun)</span><b>${esc(fmtDate(due, true))}</b></div>${progress(p, { h: 8 })}<small class="muted">${left > 0 ? `${left} kun qoldi` : 'Yil to\'lgan — zakat berish vaqti'}</small></div>`;
  }
  return `${head}
    <div class="calc-rows" style="margin-top:10px">
      ${row("Jami mol-mulk", money(r.assets, { force: true }))}
      ${row('Qarzlar (ayriladi)', '−' + money(r.debts, { force: true }))}
      ${row("Sof mol-mulk", money(r.net, { force: true }))}
      ${row(`Nisab (${num(r.nisabGrams, 2)} g ${r.metal === 'gold' ? 'oltin' : 'kumush'})`, r.nisab == null ? '—' : money(r.nisab, { force: true }))}
    </div>${hawl}`;
}

export function renderZakat() {
  const z = zs();
  const year = today().slice(0, 4);
  const paid = state.transactions.filter((t) => t.categoryId === 'c_zakat').sort((a, b) => (a.date === b.date ? b.ts - a.ts : a.date < b.date ? 1 : -1));
  const yr = paid.filter((t) => t.date.startsWith(year));
  const byKind = {};
  yr.forEach((t) => (byKind[t.tag || 'sadaqa'] = (byKind[t.tag || 'sadaqa'] || 0) + t.amount));
  const sw = (key, label, sub) => `<label class="switch-row"><span><b>${label}</b><small class="muted">${sub}</small></span><input type="checkbox" name="${key}" ${z[key] ? 'checked' : ''}></label>`;

  return `
  <div class="page-head"><div class="back-row"><a class="icon-btn" href="#/tools" aria-label="Orqaga">${icon('chevL', 20)}</a><div><h1>Zakat va sadaqa</h1><p class="sub">Mol-mulkingiz bo'yicha zakat hisob-kitobi va berilganlarni yozib borish</p></div></div></div>
  <div class="banner info" style="align-items:flex-start">${icon('shield', 18)}<span><b>Yordamchi hisob-kitob, fatvo emas.</b> Nisab, mol-mulk turlari va shartlar mazhab hamda shaxsiy holatga qarab farq qiladi. Aniq masalalarda ishonchli imom yoki ulamodan so'rang.</span></div>
  <div class="grid">
    <form id="zkForm" class="card c6" autocomplete="off" onsubmit="return false">
      <div class="card-h"><h3>${icon('wallet', 18)} Mol-mulkingiz</h3></div>
      ${sw('useAcc', "Hisoblardagi pul", `${money(accountsTotal())} (avtomatik)`)}
      ${fAmount("Boshqa naqd pul (uyda va h.k.)", 'cash', { value: z.cash })}
      <div class="grid-2">
        <label class="field"><span>Oltin (gramm)</span><input class="input" type="number" name="goldG" step="0.01" min="0" value="${z.goldG || ''}" placeholder="0"></label>
        ${fAmount('Oltin narxi (1 g)', 'goldPrice', { value: z.goldPrice })}
        <label class="field"><span>Kumush (gramm)</span><input class="input" type="number" name="silverG" step="0.01" min="0" value="${z.silverG || ''}" placeholder="0"></label>
        ${fAmount('Kumush narxi (1 g)', 'silverPrice', { value: z.silverPrice })}
      </div>
      ${fAmount('Savdo tovarlari / ombor (bozor narxida)', 'goods', { value: z.goods })}
      ${sw('useRec', "Qaytishi aniq bo'lgan qarzlar", `Sizga qarzdorlar: ${money(owedToMe())}`)}
      ${sw('useDebt', 'Qarzlarimni ayiraman', `Sizning qarzlaringiz: ${money(iOwe())}`)}
      <label class="field"><span>Nisab o'lchovi</span><select class="input" name="basis">${Object.entries(NISAB).map(([k, n]) => `<option value="${k}" ${z.basis === k ? 'selected' : ''}>${n.name}</option>`).join('')}</select></label>
      <label class="field"><span>Mol-mulk nisabga yetgan sana (yil hisobi uchun, ixtiyoriy)</span><input class="input" type="date" name="hawl" value="${z.hawl || ''}"></label>
      <p class="muted small">Oltin va kumush narxini bugungi bozor/bank narxida o'zingiz kiriting — ilova uni avtomatik bilmaydi.</p>
    </form>
    <div class="c6 stack">
      <section class="card"><div class="card-h"><h3>${icon('sparkles', 18)} Natija</h3></div><div id="zkOut">${outHtml(z)}</div>
        <button class="btn primary block" style="margin-top:12px" data-act="zakat:pay">${icon('heart', 16)} Zakat / sadaqa berdim — yozish</button></section>
      ${card(`${icon('heart', 18)} ${year}-yilda berilgan`, yr.length ? `<div class="calc-rows"><div class="cr big"><span>Jami</span><b>${money(sum(yr, (t) => t.amount))}</b></div>${Object.entries(byKind).map(([k, v]) => `<div class="cr"><span>${KINDS[k] || 'Sadaqa'}</span><b>${money(v)}</b></div>`).join('')}</div>` : `<p class="muted small">Hali yozilmagan. Bergan zakat va sadaqangizni yozib borsangiz, yil oxirida hisobini ko'rasiz.</p>`)}
    </div>
  </div>
  ${paid.length ? card("So'nggi yozuvlar", `<div class="rows">${paid.slice(0, 8).map((t) => txRow(t, { showDate: true })).join('')}</div>`) : ''}
  <details class="card how"><summary>📖 Qisqacha qoidalar</summary>
    <ul class="narr" style="margin-top:10px">
      <li><b>Miqdor:</b> nisabdan oshgan sof mol-mulkning 2,5% i.</li>
      <li><b>Nisab:</b> 85 g oltin yoki 595 g kumush qiymati (hanafiy hisobda 87,48 g oltin / 612,36 g kumush). Qaysi birini olish — mazhab va ulamolarning tavsiyasiga bog'liq.</li>
      <li><b>Yil (havl):</b> mol-mulk nisabdan kam bo'lmagan holda bir qamariy yil (~354 kun) turishi kerak.</li>
      <li><b>Qarzlar:</b> o'zingizning muddati kelgan qarzlaringiz mol-mulkdan ayriladi; kimdan qaytishi aniq bo'lgan qarzlar qo'shiladi.</li>
      <li><b>Kimlarga beriladi:</b> Tavba surasi 60-oyatda sanalgan sakkiz toifa (faqir, miskin, zakot yig'uvchilar, qalblari moyil qilinuvchilar, qullar, qarzdorlar, Alloh yo'lida, yo'lovchi). Ota-onangiz va farzandlaringizga zakot berilmaydi.</li>
      <li><b>Sadaqa</b> — nisab va yil shartisiz, istalgan vaqt va miqdorda.</li>
    </ul></details>`;
}

export function afterZakat(root) {
  const form = root.querySelector('#zkForm');
  const out = root.querySelector('#zkOut');
  if (!form) return;
  let t;
  const read = () => {
    const f = new FormData(form);
    const z = {
      basis: f.get('basis'), hawl: f.get('hawl') || '',
      cash: parseAmt(f.get('cash')), goods: parseAmt(f.get('goods')), goldPrice: parseAmt(f.get('goldPrice')), silverPrice: parseAmt(f.get('silverPrice')),
      goldG: Number(f.get('goldG')) || 0, silverG: Number(f.get('silverG')) || 0,
      useAcc: form.useAcc.checked, useRec: form.useRec.checked, useDebt: form.useDebt.checked,
    };
    state.settings.zakat = z;
    out.innerHTML = outHtml(z);
    clearTimeout(t);
    t = setTimeout(() => commit({ quiet: true }), 600); // saved + synced without re-rendering the form you are typing in
  };
  form.addEventListener('input', read);
  form.addEventListener('change', read);
}

actions['zakat:pay'] = () => {
  const r = compute(zs());
  sheet({
    title: 'Zakat / sadaqa yozish',
    submit: "Yozish",
    body: `${fSelect('Turi', 'kind', Object.entries(KINDS), r.eligible ? 'zakat' : 'sadaqa')}
      ${fAmount('Summa', 'amount', { value: r.eligible ? r.zakat : 0, big: true, focus: true })}
      <div class="grid-2">${fSelect('Hisob', 'accountId', state.accounts.map((a) => [a.id, `${a.icon} ${a.name}`]), state.accounts[0]?.id)}${fDate('Sana', 'date', today())}</div>
      ${fText('Kimga / izoh (ixtiyoriy)', 'note', { placeholder: 'Masalan: mahalla, qo\'shni, masjid' })}`,
    onSubmit(d) {
      const a = amt(d.amount);
      if (!(a > 0)) return toast('Summani kiriting', { type: 'warn' }), false;
      const tx = addTx({ type: 'expense', amount: a, accountId: d.accountId, categoryId: 'c_zakat', date: d.date, note: `${KINDS[d.kind]}${d.note.trim() ? ': ' + d.note.trim() : ''}` });
      tx.tag = d.kind;
      commit();
      toast('Yozildi 🤲 Alloh qabul qilsin', { type: 'ok' });
    },
  });
};
