import { state, commit, cats } from '../store.js';
import { esc, uid, today } from '../utils.js';
import { money, amtText, parseAmt, curCode } from '../fmt.js';
import { icon } from '../icons.js';
import { TESS_LIB, TESS_LANGS } from '../config.js';
import { parseReceipt, parseFiscalQr } from '../receipt.js';
import { guessCategory } from '../sms.js';
import { actions, toast, card } from '../ui.js';
import { lastAccountId, openTxSheet } from './tx.js';

// ---- module state (survives re-renders while the page is open) ----
let phase = 'idle'; // idle | loading | reading | done | error
let progress = 0;
let status = '';
let preview = '';
let res = null; // editable result
let worker = null;

/* ---------- image preparation: orientation, size, grayscale + auto levels ---------- */
export async function prepare(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const long = Math.max(bmp.width, bmp.height);
  const scale = long > 2200 ? 2200 / long : bmp.width < 900 ? 900 / bmp.width : 1;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = d[i + 1] = d[i + 2] = g;
    hist[g]++;
  }
  // stretch between the 2nd and 98th percentile so faded thermal paper becomes readable
  const total = w * h;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * 0.02; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * 0.02; hi--);
  const span = Math.max(30, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas: cv, bitmap: bmp };
}

async function readQr(bitmap) {
  try {
    if (!('BarcodeDetector' in window)) return null;
    const det = new window.BarcodeDetector({ formats: ['qr_code'] });
    const codes = await det.detect(bitmap);
    for (const c of codes) {
      const q = parseFiscalQr(c.rawValue);
      if (q) return q;
    }
  } catch {}
  return null;
}

async function getWorker() {
  if (worker) return worker;
  const mod = await import(/* @vite-ignore */ TESS_LIB);
  const T = mod.default || mod;
  worker = await T.createWorker(TESS_LANGS, 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        phase = 'reading';
        progress = m.progress;
        status = 'Chek o\'qilmoqda…';
      } else {
        phase = 'loading';
        progress = m.progress || 0;
        status = /loading language/.test(m.status) ? 'Til ma\'lumotlari yuklanmoqda…' : 'OCR dvigateli yuklanmoqda…';
      }
      paintProgress();
    },
  });
  return worker;
}

function paintProgress() {
  const el = document.getElementById('scanProg');
  if (!el) return;
  el.querySelector('b').textContent = status;
  el.querySelector('i').style.width = Math.round(progress * 100) + '%';
}

async function scanFile(file) {
  if (!file) return;
  if (!state.accounts.length) return toast("Avval hisob qo'shing (Sozlamalar)", { type: 'warn' });
  res = null;
  phase = 'loading';
  progress = 0;
  status = 'Tayyorlanmoqda…';
  preview = URL.createObjectURL(file);
  actions._render();
  try {
    const { canvas, bitmap } = await prepare(file);
    const qr = await readQr(bitmap);
    const w = await getWorker();
    const { data } = await w.recognize(canvas);
    const r = parseReceipt(data.text);
    const cat = guessCategory({ merchant: r.merchant, raw: `${r.merchant} ${r.items.map((i) => i.name).join(' ')}` }, state.rules || {}, 'expense');
    res = {
      merchant: r.merchant,
      amount: r.total || 0,
      date: r.date || qr?.date || today(),
      categoryId: cat,
      accountId: lastAccountId(),
      items: r.items,
      candidates: r.candidates,
      raw: data.text,
      conf: Math.round(data.confidence || 0),
      qr,
    };
    phase = 'done';
  } catch (e) {
    console.warn('scan', e);
    phase = 'error';
    status = navigator.onLine ? "Chekni o'qib bo'lmadi" : "Internet kerak (OCR kutubxonasi birinchi marta yuklanadi)";
  }
  actions._render();
}

/* ---------- page ---------- */
export function renderScan() {
  const upload = `<div class="scan-btns">
      <label class="btn primary lg">${icon('camera', 20)} Suratga olish<input type="file" id="scanCam" accept="image/*" capture="environment" hidden></label>
      <label class="btn ghost lg">${icon('upload', 20)} Galereyadan<input type="file" id="scanPick" accept="image/*" hidden></label>
    </div>`;
  let body = '';
  if (phase === 'idle' || phase === 'error') {
    body = `${phase === 'error' ? `<div class="banner warn">${icon('bell', 18)}<span>${esc(status)}</span></div>` : ''}${upload}
      <ul class="scan-tips"><li>Chekni tekis joyga, yorug'da qo'ying</li><li>Butun chek (do'kon nomi ham, «JAMI» qatori ham) ko'rinsin</li><li>Rasm <b>faqat qurilmangizda</b> tahlil qilinadi va saqlanmaydi</li></ul>
      <p class="muted small">Birinchi marta OCR dvigateli yuklanadi (~10 MB, internet kerak). Keyin tezroq ishlaydi.</p>`;
  } else if (phase === 'loading' || phase === 'reading') {
    body = `${preview ? `<img class="scan-prev" src="${preview}" alt="">` : ''}<div class="scan-prog" id="scanProg"><b>${esc(status)}</b><div class="bar" style="height:10px"><i style="width:${Math.round(progress * 100)}%;background:var(--grad)"></i></div></div>`;
  } else if (res) {
    const cl = cats('expense');
    body = `<div class="scan-res">
      ${preview ? `<img class="scan-prev" src="${preview}" alt="">` : ''}
      <div class="scan-form">
        <p class="muted small">O'qish ishonchliligi: <b>${res.conf}%</b>. Iltimos, tekshirib oling.</p>
        <label class="field"><span>Do'kon / izoh</span><input class="input" id="scMerchant" value="${esc(res.merchant)}"></label>
        <label class="field"><span>Jami summa</span><div class="amt-wrap big"><input class="input amt" id="scAmount" inputmode="decimal" value="${amtText(res.amount)}"><i></i></div></label>
        ${res.candidates.length > 1 ? `<div class="quick-amts">${res.candidates.map((v) => `<button type="button" class="hint" data-act="scan:amt" data-v="${v}">${money(v, { force: true })}</button>`).join('')}</div>` : ''}
        <div class="grid-2">
          <label class="field"><span>Sana</span><input class="input" type="date" id="scDate" value="${res.date}"></label>
          <label class="field"><span>Hisob</span><select class="input" id="scAcc">${state.accounts.map((a) => `<option value="${a.id}" ${a.id === res.accountId ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>Kategoriya</span><select class="input" id="scCat">${cl.map((c) => `<option value="${c.id}" ${c.id === res.categoryId ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select></label>
        ${res.items.length ? `<details class="how"><summary>Topilgan mahsulotlar (${res.items.length})</summary><ul class="scan-items">${res.items.map((i) => `<li><span>${esc(i.name)}</span><b>${money(i.sum, { force: true })}</b></li>`).join('')}</ul></details>` : ''}
        <details class="how"><summary>Aniqlangan matn</summary><pre class="raw-pre">${esc(res.raw)}</pre></details>
        <div class="btn-col"><button class="btn primary lg" data-act="scan:save">${icon('check', 18)} Xarajat sifatida qo'shish</button><button class="btn ghost" data-act="scan:reset">Boshqa chek</button></div>
      </div></div>`;
  }
  return `
  <div class="page-head"><div><h1>Chek skanerlash</h1><p class="sub">Chek rasmini oling — do'kon, summa, sana va kategoriyani o'zim aniqlayman</p></div></div>
  ${card(`${icon('camera', 18)} ${phase === 'done' ? 'Natija' : 'Chek'}`, body)}`;
}

export function afterScan(root) {
  for (const id of ['scanCam', 'scanPick']) {
    root.querySelector('#' + id)?.addEventListener('change', (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      scanFile(f);
    });
  }
  const sync = (id, key, conv = (v) => v) => root.querySelector(id)?.addEventListener('input', (e) => res && (res[key] = conv(e.target.value)));
  sync('#scMerchant', 'merchant');
  sync('#scAmount', 'amount', parseAmt);
  sync('#scDate', 'date');
  sync('#scAcc', 'accountId');
  sync('#scCat', 'categoryId');
  root.querySelector('#scAcc')?.addEventListener('change', (e) => res && (res.accountId = e.target.value));
  root.querySelector('#scCat')?.addEventListener('change', (e) => res && (res.categoryId = e.target.value));
}

actions['scan:amt'] = (el) => {
  if (!res) return;
  res.amount = Number(el.dataset.v);
  const i = document.getElementById('scAmount');
  if (i) i.value = amtText(res.amount);
};
actions['scan:reset'] = () => {
  phase = 'idle';
  res = null;
  preview = '';
  actions._render();
};
actions['scan:save'] = () => {
  if (!res || !(res.amount > 0)) return toast('Summani kiriting', { type: 'warn' });
  state.transactions.push({ id: uid(), ts: Date.now(), type: 'expense', amount: res.amount, accountId: res.accountId, categoryId: res.categoryId, date: res.date || today(), note: (res.merchant || '').trim() });
  if (res.merchant) (state.rules ||= {})[res.merchant.toLowerCase()] = res.categoryId;
  const a = res.amount;
  phase = 'idle';
  res = null;
  preview = '';
  commit();
  toast(`🧾 Chek qo'shildi: −${money(a, { force: true })}`, { type: 'ok' });
  location.hash = '#/transactions';
};
export const terminateScanner = () => {
  worker?.terminate?.();
  worker = null;
};
