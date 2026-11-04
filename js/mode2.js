/* Glyph Loom · Author: Hy Nguyen */
/* Glyph Loom — mode 2: generative clouds (test mode, self-contained).
 * A scene is a few cloud groups. Each group is one cluster with ribbons flowing out
 * of it, so cloud and ribbon always join:
 *   - cluster: a big lobe plus shoulder and side lobes, joined with a smooth union;
 *     filled with one color, drawn with light lines: the outline, inset contours,
 *     and a spiral (r = b·θ) in every large lobe; neighbouring spirals alternate spin;
 *   - ribbon: starts under its cluster and grows like a turtle: waves around its
 *     start heading with a capped turn per step and a pull back toward it, so it
 *     never drifts off. It is a bundle of parallel colored stripes split by light
 *     lines. Its tail tapers, winds into a hook (width kept under a third of the
 *     curl radius so turns never touch) or ends in a small cluster of its own;
 *   - groups are painted small to big, ribbons before their cluster, so every
 *     ribbon comes out from under a cloud.
 * Motion: ribbons sway (the wave phase moves), spirals turn and clusters bob.
 * Draws into GL.mode2.canvas, which app.js uses like any other source.
 * Removing the <script> tag for this file hides mode 2 completely.
 */
window.GL = window.GL || {};

(() => {
const W = 1200, H = 760, TAU = Math.PI * 2;
// bg, line (outlines and stripe gaps), fill colors
const PALETTES = {
  tuongvan: { name: { vi: 'Tường vân', en: 'Auspicious' }, bg: '#F6F0E6', line: '#F8F1E2', colors: ['#E0522F', '#2F4C7E', '#8DA8C6', '#8DB3A2', '#E2D4AE', '#C4B08A'] },
  kim:      { name: { vi: 'Kim nâu', en: 'Gold & umber' }, bg: '#FFFFFF', line: '#F6E7BE', colors: ['#7E3412', '#E1A62B', '#F2E8D0', '#86B6D8', '#B4621E'] },
  do:       { name: { vi: 'Đỏ son', en: 'Vermilion' }, bg: '#F6F5F5', line: '#FBE6D6', colors: ['#D43C33', '#E9765C', '#A9212A', '#F2A285'] },
  lagoon:   { name: { vi: 'Lagoon', en: 'Lagoon' }, bg: '#F4FAFB', line: '#EAF9FB', colors: ['#1A20D8', '#2F6FE0', '#1A93AE', '#5CC8D8', '#0B1690'] },
};
const P = { seed: 11, palette: 'tuongvan', view: 'plain', motion: true, speed: 1, groups: 4, ribbons: 2, lines: 3, turns: 2, wave: 1 };

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
// polynomial smooth min: rounds the joint where two lobes meet
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

/* ---------- layout ---------- */
function cluster(r, cx, cy, R, color, dir, t) {
  const lobes = [[cx, cy, R]];
  for (const side of [-1, 1]) {
    if (r() < 0.75) { const a = (0.22 + r() * 0.2) * Math.PI, rb = R * (0.4 + r() * 0.12); lobes.push([cx + side * Math.sin(a) * R * 0.75, cy - Math.cos(a) * R * 0.75, rb]); }
    const r1 = R * (0.5 + r() * 0.2); lobes.push([cx + side * R * (0.85 + r() * 0.2), cy + R * (0.15 + r() * 0.2), r1]);
    if (r() < 0.5) lobes.push([cx + side * R * (0.35 + r() * 0.3), cy + R * (0.5 + r() * 0.15), R * (0.4 + r() * 0.12)]);
  }
  // a spiral in every large lobe, alternating spin
  const spirals = lobes.filter(l => l[2] > R * 0.45).map(([x, y, lr], i) => {
    const d = i % 2 ? -dir : dir, turns = Math.max(1.2, P.turns + (r() - 0.5) * 0.5), Rs = lr * 0.78;
    return { x: x + lr * 0.04 * d, y: y - lr * 0.06, Rs, b: Rs / (TAU * turns), dir: d, rot: t * 0.5 * d };
  });
  return { kind: 'cluster', R, lobes, spirals, color };
}
function ribbon(r, x, y, h, wmax, stripes, t, tail) {
  const pts = [], n = 50 + (r() * 35 | 0), step = W / 120, A = 0.05 * P.wave, f = 0.07 + r() * 0.05, ph = r() * TAU;
  const h0 = h, y0 = y;
  pts.push([x, y, wmax]);
  for (let i = 0; i < n; i++) {
    const pull = -0.06 * (h - h0) - 0.0006 * (y - y0) * Math.cos(h0);
    h += Math.max(-0.08, Math.min(0.08, A * Math.sin(f * i + ph + t * 1.1) + pull));
    x += Math.cos(h) * step; y += Math.sin(h) * step;
    const u = i / n, w = tail === 'taper' ? wmax * Math.max(0.05, 1 - Math.max(0, u - 0.5) * 2) : wmax * (1 - 0.2 * u);
    pts.push([x, y, w]);
  }
  if (tail === 'hook') { // curvature rises so the end winds into a spiral
    const s = r() < 0.5 ? 1 : -1, m = 60, w0 = pts[pts.length - 1][2];
    for (let i = 1; i <= m; i++) {
      const u = i / m, k = 0.04 + u * 0.26, st = step * (1 - 0.4 * u);
      h += s * k; x += Math.cos(h) * st; y += Math.sin(h) * st;
      pts.push([x, y, Math.min(w0 * (1 - 0.5 * u), st / k * 0.33)]);
    }
  }
  return { kind: 'ribbon', pts, stripes, end: [x, y], wmax };
}
function layout(t) {
  const r = rng(P.seed), pal = PALETTES[P.palette], nc = pal.colors.length, items = [];
  const n = P.groups, gr = Math.max(1, Math.round(Math.sqrt(n * H / W))), gc = Math.ceil(n / gr);
  const order = [...Array(nc).keys()].sort(() => r() - 0.5);
  for (let g = 0; g < n; g++) {
    const gx = g % gc, gy = (g / gc) | 0;
    const R = Math.min(W / gc, H / gr) * (0.27 + r() * 0.14);
    const cx = (gx + 0.2 + r() * 0.6) / gc * W, cy = (gy + 0.3 + r() * 0.4) / gr * H + Math.sin(t * 0.6 + g * 1.7) * R * 0.04;
    // ribbons flow toward the middle of the frame, so they cross the open sky instead of leaving it
    const main = 2 + order[g % nc], dir = g % 2 ? 1 : -1, side = cx < W / 2 ? 1 : -1;
    const group = [];
    const nr = Math.max(1, P.ribbons + (r() < 0.3 ? -1 : 0));
    for (let k = 0; k < nr; k++) {
      const sx = cx + side * R * (0.1 + r() * 0.4), sy = cy + R * (0.2 + k * 0.22 + r() * 0.1);
      const h = (side > 0 ? 0 : Math.PI) + (r() - 0.5) * 0.6, wmax = R * (0.3 + r() * 0.15);
      const ns = 3 + (r() * 3 | 0), stripes = [main];
      while (stripes.length < ns) stripes.push(2 + ((main - 2 + 1 + (r() * (nc - 1) | 0)) % nc));
      const roll = r(), end = roll < 0.45 ? 'hook' : roll < 0.65 ? 'taper' : 'cloud';
      const rb = ribbon(r, sx, sy, h, wmax, stripes, t, end);
      group.push(rb);
      if (end === 'cloud') group.push(cluster(r, rb.end[0], rb.end[1], wmax * 1.5, stripes[1], -dir, t));
    }
    group.push(cluster(r, cx, cy, R, main, dir, t));
    items.push({ R, group });
  }
  return items.sort((a, b) => a.R - b.R).flatMap(g => g.group);
}

/* ---------- raster ---------- */
const idx = new Uint8Array(W * H), F = new Float32Array(W * H), C = new Float32Array(W * H);
function paintCluster(c, LINE) {
  const k = c.R * 0.14, lw = Math.max(1.6, c.R * 0.035), bw = c.R * 0.17;
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (const [x, y, r] of c.lobes) { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); y1 = Math.max(y1, y + r); }
  x0 = Math.max(0, x0 - k | 0); x1 = Math.min(W - 1, Math.ceil(x1 + k)); y0 = Math.max(0, y0 - k | 0); y1 = Math.min(H - 1, Math.ceil(y1 + k));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    let d = 1e9;
    for (const [lx, ly, lr] of c.lobes) d = smin(d, Math.sqrt((x - lx) * (x - lx) + (y - ly) * (y - ly)) - lr, k);
    if (d >= 0) continue;
    const depth = -d;
    let line = depth < lw, inSpiral = false;
    for (const s of c.spirals) {
      const dx = x - s.x, dy = y - s.y, rr = Math.sqrt(dx * dx + dy * dy);
      if (rr >= s.Rs) continue;
      inSpiral = true;
      const m = (((rr / s.b - (Math.atan2(dy, dx) + s.rot) * s.dir) % TAU) + TAU) % TAU;
      if (Math.min(m, TAU - m) * s.b < lw * 0.8) line = true;
      break;
    }
    if (!inSpiral && depth < bw * P.lines && depth % bw < lw) line = true;
    idx[y * W + x] = line ? LINE : c.color;
  }
}
// signed distance to the ribbon edge (F) and the side offset from its spine (C), splatted per segment
function paintRibbon(rb, LINE) {
  const p = rb.pts, m0 = rb.wmax + 2;
  let bx0 = W, bx1 = 0, by0 = H, by1 = 0;
  for (const [x, y] of p) { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  bx0 = Math.max(0, bx0 - m0 | 0); bx1 = Math.min(W - 1, Math.ceil(bx1 + m0)); by0 = Math.max(0, by0 - m0 | 0); by1 = Math.min(H - 1, Math.ceil(by1 + m0));
  if (bx0 > bx1 || by0 > by1) return;
  for (let y = by0; y <= by1; y++) F.fill(1e9, y * W + bx0, y * W + bx1 + 1);
  for (let i = 0; i + 1 < p.length; i++) {
    const [ax, ay, aw] = p[i], [bx, by, bwid] = p[i + 1], ex = bx - ax, ey = by - ay, ll = ex * ex + ey * ey || 1, len = Math.sqrt(ll), m = Math.max(aw, bwid) + 1;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx) - m)), x1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + m));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by) - m)), y1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + m));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const tt = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / ll));
      const px = x - ax - ex * tt, py = y - ay - ey * tt, d = Math.sqrt(px * px + py * py) - (aw + (bwid - aw) * tt), q = y * W + x;
      if (d < F[q]) { F[q] = d; C[q] = (ex * (y - ay) - ey * (x - ax)) / len; }
    }
  }
  const S = rb.stripes.length, lw = Math.max(1.4, rb.wmax * 0.06);
  for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
    const q = y * W + x, d = F[q];
    if (d >= 0) continue;
    const c = C[q], w = Math.abs(c) - d;                     // ribbon half-width at this point
    if (-d < lw || w <= 0) { idx[q] = LINE; continue; }
    const v = Math.max(0, Math.min(S - 1e-6, (c / w + 1) / 2 * S)), k = v | 0, gap = Math.min(v - k, k + 1 - v) * (2 * w / S);
    idx[q] = gap < lw * 0.6 && v > 0.5 && v < S - 0.5 ? LINE : rb.stripes[k];
  }
}

const canvas = document.createElement('canvas');
canvas.width = W; canvas.height = H;
let lastT = -1, forced = true;
// time in ms; while moving, redraws are capped at ~25 fps
function draw(time = 0) {
  const t = P.motion ? time / 1000 * P.speed : 0;
  if (!forced && (t === lastT || (P.motion && Math.abs(t - lastT) < 0.04 * P.speed))) return;
  forced = false; lastT = t;
  const pal = PALETTES[P.palette], table = [hex(pal.bg), hex(pal.line), ...pal.colors.map(hex)];
  idx.fill(0);
  for (const it of layout(t)) it.kind === 'ribbon' ? paintRibbon(it, 1) : paintCluster(it, 1);
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  for (let p = 0, o = 0; p < W * H; p++, o += 4) { const c = table[idx[p]]; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
  ctx.putImageData(img, 0, 0);
}

/* ---------- panel ---------- */
Object.assign(GL.STRINGS.vi, { m2View: 'Hiển thị', m2Plain: 'Mây gốc', m2Ascii: 'ASCII', m2Palette: 'Bảng màu', m2Motion: 'Chuyển động', m2Speed: 'Tốc độ',
  m2Groups: 'Số cụm', m2Ribbons: 'Dải mỗi cụm', m2Lines: 'Số đường viền', m2Turns: 'Vòng xoắn', m2Wave: 'Độ uốn', m2New: 'Tạo mây mới' });
Object.assign(GL.STRINGS.en, { m2View: 'View', m2Plain: 'Plain clouds', m2Ascii: 'ASCII', m2Palette: 'Palette', m2Motion: 'Motion', m2Speed: 'Speed',
  m2Groups: 'Clusters', m2Ribbons: 'Ribbons each', m2Lines: 'Contour lines', m2Turns: 'Spiral turns', m2Wave: 'Wave', m2New: 'New clouds' });

// builds the mode 2 panel at the top of the rail; onChange(what) runs after every change
function mount(rail, onChange) {
  const sec = document.createElement('section');
  sec.hidden = true;
  const slider = (key, label, min, max, step) => `<div class="row"><label data-i18n="${label}"></label>` +
    `<input data-m2="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${P[key]}"><output>${P[key]}</output></div>`;
  sec.innerHTML = `<h2>Mode 2</h2>
    <div class="seg m2-view"><button type="button" data-view="plain" data-i18n="m2Plain"></button><button type="button" data-view="ascii" data-i18n="m2Ascii"></button></div>
    <div class="row2"><label data-i18n="m2Palette"></label><select data-m2p></select></div>
    <label class="check"><input data-m2c="motion" type="checkbox"${P.motion ? ' checked' : ''}> <span data-i18n="m2Motion"></span></label>` +
    slider('speed', 'm2Speed', 0.2, 3, 0.1) + slider('groups', 'm2Groups', 1, 8, 1) + slider('ribbons', 'm2Ribbons', 1, 3, 1) +
    slider('lines', 'm2Lines', 0, 6, 1) + slider('turns', 'm2Turns', 1, 3, 0.1) + slider('wave', 'm2Wave', 0, 2, 0.1) +
    `<button type="button" data-m2new data-i18n="m2New"></button>`;
  const sel = sec.querySelector('[data-m2p]');
  const fillPalettes = () => { sel.innerHTML = Object.entries(PALETTES).map(([k, p]) => `<option value="${k}">${p.name[GL.lang] || p.name.en}</option>`).join(''); sel.value = P.palette; };
  const syncView = () => sec.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === P.view));
  const redraw = what => { forced = true; draw(performance.now()); onChange(what); };
  fillPalettes(); syncView();
  sec.querySelectorAll('[data-m2]').forEach(inp => inp.addEventListener('input', () => {
    P[inp.dataset.m2] = +inp.value; inp.nextElementSibling.textContent = inp.value; redraw('shape');
  }));
  sec.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { P.view = b.dataset.view; syncView(); onChange('view'); }));
  sel.addEventListener('input', () => { P.palette = sel.value; redraw('palette'); });
  sec.querySelector('[data-m2c]').addEventListener('input', e => { P.motion = e.target.checked; redraw('motion'); });
  sec.querySelector('[data-m2new]').addEventListener('click', () => { P.seed = (Math.random() * 1e6) | 0; redraw('shape'); });
  rail.prepend(sec);
  GL.mode2.panel = sec;
  GL.mode2.relabel = fillPalettes;
}

GL.mode2 = {
  canvas, draw, mount, panel: null, relabel: null,
  get plain() { return P.view === 'plain'; },
  get moving() { return P.motion; },
  get bg() { return PALETTES[P.palette].bg; },
  reset() { forced = true; },
};
})();
