import { esc, uid } from './utils.js';
import { icon } from './icons.js';
import { amtText, decimals, parseAmt } from './fmt.js';
import { EMOJI, COLORS } from './data.js';

export const actions = {};

/* ---------------- toast ---------------- */
export function toast(msg, { type = 'info', action, ms = 4200 } = {}) {
  const host = document.getElementById('toasts');
  while (host.children.length >= 3) host.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  const kill = () => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 250);
  };
  el.querySelector('button')?.addEventListener('click', () => {
    action.fn();
    kill();
  });
  setTimeout(kill, ms);
}

/* ---------------- sheet (modal) ---------------- */
let current = null;
export function closeSheet() {
  if (!current) return;
  const { el } = current;
  current = null;
  el.classList.remove('open');
  document.body.classList.remove('lock');
  setTimeout(() => {
    el.remove();
    document.dispatchEvent(new Event('sheetclosed'));
  }, 260);
}

/**
 * sheet({title, body, submit, onSubmit(data, form), onMount(form), danger:{label,fn}, footer:false})
 */
export function sheet({ title, body, submit = 'Saqlash', onSubmit, onMount, danger, footer = true, wide = false }) {
  closeSheet();
  const el = document.createElement('div');
  el.className = 'sheet-root';
  el.innerHTML = `<div class="sheet-back" data-close></div>
  <form class="sheet ${wide ? 'wide' : ''}" novalidate autocomplete="off">
    <div class="sheet-handle"></div>
    <header class="sheet-h"><h3>${title}</h3><button type="button" class="icon-btn" data-close aria-label="Yopish">${icon('x', 18)}</button></header>
    <div class="sheet-body">${body}</div>
    ${footer ? `<footer class="sheet-f">${danger ? `<button type="button" class="btn danger-ghost" data-danger>${icon('trash', 16)} ${esc(danger.label || "O'chirish")}</button>` : ''}<button type="submit" class="btn primary grow">${esc(submit)}</button></footer>` : ''}
  </form>`;
  document.getElementById('overlay').appendChild(el);
  document.body.classList.add('lock');
  const form = el.querySelector('form');
  current = { el, form };
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeSheet();
  });
  el.querySelector('[data-danger]')?.addEventListener('click', async () => {
    if (await confirmBox(danger.confirm || "Haqiqatan ham o'chirasizmi?")) {
      closeSheet();
      danger.fn();
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = formData(form);
    const res = await onSubmit?.(data, form);
    if (res !== false) closeSheet();
  });
  onMount?.(form);
  requestAnimationFrame(() => {
    el.classList.add('open');
    form.querySelector('[data-autofocus]')?.focus();
  });
  return form;
}
export function formData(form) {
  const d = {};
  for (const [k, v] of new FormData(form)) d[k] = v;
  return d;
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});

export function confirmBox(msg, { ok = 'Ha', cancel = 'Bekor qilish' } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'confirm-root';
    el.innerHTML = `<div class="confirm"><p>${esc(msg)}</p><div class="confirm-b"><button class="btn ghost" data-v="0">${esc(cancel)}</button><button class="btn danger" data-v="1">${esc(ok)}</button></div></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('open'));
    const done = (v) => {
      el.classList.remove('open');
      setTimeout(() => el.remove(), 200);
      resolve(v);
    };
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (b) done(b.dataset.v === '1');
      else if (e.target === el) done(false);
    });
  });
}

/* ---------------- form field helpers ---------------- */
export const fText = (label, name, { value = '', placeholder = '', required = false, focus = false, type = 'text', attrs = '' } = {}) =>
  `<label class="field"><span>${label}</span><input class="input" type="${type}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${required ? 'required' : ''} ${focus ? 'data-autofocus' : ''} ${attrs}></label>`;

export const fAmount = (label, name, { value = 0, placeholder = '0', focus = false, big = false, suffix = '' } = {}) =>
  `<label class="field"><span>${label}</span><div class="amt-wrap ${big ? 'big' : ''}"><input class="input amt" inputmode="decimal" name="${name}" value="${amtText(value)}" placeholder="${placeholder}" ${focus ? 'data-autofocus' : ''}><i>${suffix}</i></div></label>`;

export const fNumber = (label, name, { value = '', step = 'any', min = '', max = '', suffix = '' } = {}) =>
  `<label class="field"><span>${label}</span><div class="amt-wrap"><input class="input" type="number" inputmode="decimal" step="${step}" ${min !== '' ? `min="${min}"` : ''} ${max !== '' ? `max="${max}"` : ''} name="${name}" value="${value}"><i>${suffix}</i></div></label>`;

export const fDate = (label, name, value = '', { clearable = false } = {}) =>
  `<label class="field"><span>${label}</span><input class="input" type="date" name="${name}" value="${value || ''}" ${clearable ? '' : 'required'}></label>`;

export const fSelect = (label, name, options, value = '') =>
  `<label class="field"><span>${label}</span><select class="input" name="${name}">${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;

export const fArea = (label, name, value = '', placeholder = '') =>
  `<label class="field"><span>${label}</span><textarea class="input" name="${name}" rows="2" placeholder="${esc(placeholder)}">${esc(value)}</textarea></label>`;

export const fSeg = (name, options, value) =>
  `<div class="seg" role="radiogroup">${options
    .map(([v, l, cls = '']) => `<label class="${cls}"><input type="radio" name="${name}" value="${esc(v)}" ${v === value ? 'checked' : ''}><span>${l}</span></label>`)
    .join('')}</div>`;

export const fChips = (label, name, options, value) =>
  `<div class="field"><span>${label}</span><div class="chips">${options
    .map((o) => `<label class="chip-opt" style="--c:${o.color || 'var(--accent)'}"><input type="radio" name="${name}" value="${esc(o.id)}" ${o.id === value ? 'checked' : ''}><span>${o.icon ? `<em>${o.icon}</em>` : ''}${esc(o.name)}</span></label>`)
    .join('')}</div></div>`;

export const fEmoji = (name, value, list = EMOJI) =>
  `<div class="field"><span>Belgi</span><div class="emoji-grid">${list
    .map((e) => `<label><input type="radio" name="${name}" value="${e}" ${e === value ? 'checked' : ''}><span>${e}</span></label>`)
    .join('')}</div></div>`;

export const fColor = (name, value) =>
  `<div class="field"><span>Rang</span><div class="color-grid">${COLORS.map((c) => `<label><input type="radio" name="${name}" value="${c}" ${c === value ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div></div>`;

export const fRange = (label, name, { min, max, step = 1, value, suffix = '' }) =>
  `<label class="field"><span>${label} <b class="range-v" data-for="${name}">${value}${suffix}</b></span><input class="range" type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${value}" data-suffix="${suffix}"></label>`;

export function bindFormEnhancements(root = document) {
  // amount formatting
  root.addEventListener('input', (e) => {
    const t = e.target;
    if (t.classList?.contains('amt')) {
      const allowDec = decimals() > 0;
      let raw = t.value.replace(/[^\d.,]/g, '').replace(',', '.');
      let [i, ...f] = raw.split('.');
      i = i.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      t.value = i + (allowDec && raw.includes('.') ? '.' + f.join('').slice(0, decimals()) : '');
    }
    if (t.classList?.contains('range')) {
      const v = t.closest('.field').querySelector('.range-v');
      if (v) v.textContent = t.value + (t.dataset.suffix || '');
    }
  });
}
export const amt = (v) => parseAmt(v);

/* ---------------- common bits ---------------- */
export const empty = (ico, title, text, btn = '') =>
  `<div class="empty"><div class="empty-ico">${ico}</div><h4>${esc(title)}</h4><p>${esc(text)}</p>${btn}</div>`;

export const progress = (p, { color = 'var(--grad)', h = 8 } = {}) =>
  `<div class="bar" style="height:${h}px"><i style="width:${Math.max(0, Math.min(1, p)) * 100}%;background:${color}"></i></div>`;

export const card = (title, body, { action = '', cls = '' } = {}) =>
  `<section class="card ${cls}">${title || action ? `<div class="card-h"><h3>${title}</h3>${action}</div>` : ''}${body}</section>`;

export function animateCounters(root, fmt) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count);
    if (!Number.isFinite(to) || to === 0) return;
    const t0 = performance.now();
    const dur = 750;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(to * e, el);
      if (p < 1 && el.isConnected) requestAnimationFrame(tick);
      else el.textContent = fmt(to, el);
    };
    requestAnimationFrame(tick);
  });
}
export { uid };
