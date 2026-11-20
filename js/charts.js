import { short, money } from './fmt.js';

let _id = 0;
const gid = () => `g${++_id}`;

export function ring(pct, { size = 120, thick = 10, colors = ['#7c5cff', '#22d3ee'], track = 'var(--track)', center = '' } = {}) {
  const id = gid();
  const r = 50 - thick / 2;
  const C = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 100 100" width="${size}" height="${size}">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1] || colors[0]}"/></linearGradient></defs>
      <g transform="rotate(-90 50 50)">
        <circle cx="50" cy="50" r="${r}" fill="none" stroke="${track}" stroke-width="${thick}"/>
        <circle class="ring-arc" cx="50" cy="50" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${thick}" stroke-linecap="round" stroke-dasharray="${C * p} ${C}" style="--c:${C};--p:${C * p}"/>
      </g>
    </svg>
    <div class="ring-c">${center}</div>
  </div>`;
}

export function donut(items, { size = 170, thick = 15, gap = 2.5, center = '' } = {}) {
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  const r = 50 - thick / 2;
  const C = 2 * Math.PI * r;
  let off = 0;
  const segs = items
    .map((it) => {
      const len = (it.value / total) * C;
      const dash = Math.max(0.01, len - gap);
      const s = `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${it.color}" stroke-width="${thick}" stroke-linecap="round" stroke-dasharray="${dash} ${C - dash}" stroke-dashoffset="${-off}"><title>${it.label}: ${money(it.value, { force: true })}</title></circle>`;
      off += len;
      return s;
    })
    .join('');
  return `<div class="ring donut" style="width:${size}px;height:${size}px">
    <svg viewBox="0 0 100 100" width="${size}" height="${size}"><g transform="rotate(-90 50 50)">
      <circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--track)" stroke-width="${thick}"/>${segs}</g></svg>
    <div class="ring-c">${center}</div></div>`;
}

// grouped bars: groups=[{label,a,b}] ; a = income (green), b = expense (red)
export function bars(groups, { height = 170, aColor = 'var(--pos)', bColor = 'var(--neg)', single = false } = {}) {
  const W = 340;
  const H = height;
  const padL = 34;
  const padB = 22;
  const padT = 8;
  const max = Math.max(1, ...groups.flatMap((g) => (single ? [g.a] : [g.a, g.b])));
  const nice = niceMax(max);
  const ch = H - padB - padT;
  const gw = (W - padL) / groups.length;
  const bw = Math.min(single ? 28 : 16, gw / (single ? 1.8 : 3));
  let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">`;
  for (let i = 0; i <= 3; i++) {
    const y = padT + (ch * i) / 3;
    out += `<line x1="${padL}" x2="${W}" y1="${y}" y2="${y}" class="gridline"/><text x="${padL - 6}" y="${y + 3}" class="axis" text-anchor="end">${short(nice * (1 - i / 3), { force: true })}</text>`;
  }
  groups.forEach((g, i) => {
    const cx = padL + gw * i + gw / 2;
    const hA = (g.a / nice) * ch;
    const hB = ((g.b || 0) / nice) * ch;
    if (single) {
      out += bar(cx - bw / 2, padT + ch - hA, bw, hA, aColor, g.label, g.a);
    } else {
      out += bar(cx - bw - 1.5, padT + ch - hA, bw, hA, aColor, g.label + ' daromad', g.a);
      out += bar(cx + 1.5, padT + ch - hB, bw, hB, bColor, g.label + ' xarajat', g.b);
    }
    out += `<text x="${cx}" y="${H - 6}" class="axis" text-anchor="middle">${g.label}</text>`;
  });
  return out + '</svg>';
}
function bar(x, y, w, h, color, label, val) {
  if (h < 0.5) return `<rect x="${x}" y="${y - 1}" width="${w}" height="1.5" rx="1" fill="${color}" opacity=".4"/>`;
  const r = Math.min(5, w / 2, h);
  return `<path d="M${x} ${y + h} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h} Z" fill="${color}"><title>${label}: ${money(val, { force: true })}</title></path>`;
}
function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * p;
}

function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  return d;
}

export function spark(values, { w = 300, h = 60, color = '#fff', fill = true } = {}) {
  if (values.length < 2) return '';
  const id = gid();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 8)]);
  const line = smoothPath(pts);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    ${fill ? `<path d="${line} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/>` : ''}
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}

// area chart with axes; series=[{name,values,color}]
export function area(labels, series, { height = 200 } = {}) {
  const W = 340;
  const H = height;
  const padL = 40;
  const padB = 22;
  const padT = 8;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const ch = H - padB - padT;
  const cw = W - padL - 6;
  const n = labels.length;
  let out = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  for (let i = 0; i <= 3; i++) {
    const y = padT + (ch * i) / 3;
    out += `<line x1="${padL}" x2="${W}" y1="${y}" y2="${y}" class="gridline"/><text x="${padL - 6}" y="${y + 3}" class="axis" text-anchor="end">${short(max * (1 - i / 3), { force: true })}</text>`;
  }
  series.forEach((s) => {
    const id = gid();
    const pts = s.values.map((v, i) => [padL + (n === 1 ? 0 : (i / (n - 1)) * cw), padT + ch - (v / max) * ch]);
    const line = smoothPath(pts);
    out += `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity=".3"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient></defs>`;
    if (s.fill !== false) out += `<path d="${line} L${pts[pts.length - 1][0]} ${padT + ch} L${pts[0][0]} ${padT + ch} Z" fill="url(#${id})"/>`;
    out += `<path d="${line}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="${s.dash || ''}"/>`;
  });
  const step = Math.max(1, Math.ceil(n / 6));
  labels.forEach((l, i) => {
    if (i % step === 0 || i === n - 1) out += `<text x="${padL + (n === 1 ? 0 : (i / (n - 1)) * cw)}" y="${H - 6}" class="axis" text-anchor="middle">${l}</text>`;
  });
  return out + '</svg>';
}
