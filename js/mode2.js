/* Glyph Loom · Author: Hy Nguyen */
/* Glyph Loom — mode 2: generative clouds (test mode, self-contained).
 * The scene is a wide ribbon that winds down a portrait frame and pours into a bank of
 * clouds at the bottom. The ribbon, its cloud puffs and the clusters on its bends are
 * one distance field joined with a smooth union, so they can never come apart; each
 * cluster of the bank is its own layer with its own rim, and the ribbon sits between
 * the back and front rows.
 *   - ribbon: a meander down the frame (level runs, round U-turns at the sides); it
 *     swells at each turn and cloud puffs bulge out around the outside of the turn;
 *   - clusters sit on some bends, and the bank is two rows of clusters;
 *   - color comes from depth inside the shape: a foil rim, a light line, the fill,
 *     then inset contour lines that follow every edge; big lobes carry a C-shaped
 *     curl (a spiral r = b·θ drawn as a thick light band with a colored core),
 *     neighbouring curls spinning opposite ways.
 * Motion: the meander sways, the curls turn and the bank breathes.
 * Draws into GL.mode2.canvas, which app.js uses like any other source.
 * Removing the <script> tag for this file hides mode 2 completely.
 */
window.GL = window.GL || {};

(() => {
const W = 900, H = 1200, TAU = Math.PI * 2;
// rim: foil tones on the edge · line: light separators · fill / deep: body · acc: curls and inner lines
const PALETTES = {
  kim:      { name: { vi: 'Kim nâu', en: 'Gold & umber' }, bg: '#FFFFFF', rim: ['#E6B23A', '#F4D266', '#C98C1E'], edge: '#B07A16', line: '#F6E9CF', fill: '#7A2E0E', acc: ['#F3E7D0', '#8FC0DE'] },
  tuongvan: { name: { vi: 'Tường vân', en: 'Auspicious' }, bg: '#F6F0E6', rim: ['#E0522F', '#EA6C48', '#C9441F'], edge: '#A8361A', line: '#F8F1E2', fill: '#2F4C7E', acc: ['#E2D4AE', '#8DB3A2'] },
  do:       { name: { vi: 'Đỏ son', en: 'Vermilion' }, bg: '#F6F5F5', rim: ['#F2A285', '#F6BCA4', '#E9765C'], edge: '#C9563F', line: '#FBE6D6', fill: '#C8322B', acc: ['#FBE6D6', '#7A141E'] },
  lagoon:   { name: { vi: 'Lagoon', en: 'Lagoon' }, bg: '#F4FAFB', rim: ['#5CC8D8', '#86DCE8', '#2FA8BC'], edge: '#1A93AE', line: '#EAF9FB', fill: '#1A20D8', acc: ['#BDEFF4', '#5CC8D8'] },
};
const P = { seed: 11, palette: 'kim', view: 'plain', motion: true, speed: 1, bends: 4, width: 1, bank: 2, lines: 2, turns: 1.6, wave: 1 };

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
// polynomial smooth min: rounds the joint where two lobes meet
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

/* ---------- layout ---------- */
// layers are painted back to front: back bank row, the ribbon, then the front bank row,
// so every cluster in the bank keeps its own rim and the ribbon pours in between them
function scene(t) {
  const r = rng(P.seed), wb = W * 0.085 * P.width, layers = [];
  let spin = 1;
  const curl = (L, x, y, R) => { // a C-curl in a big lobe
    const turns = Math.max(1, P.turns + (r() - 0.5) * 0.4), Rs = R * 0.72;
    L.spirals.push({ x, y, Rs, b: Rs / (TAU * turns), dir: spin, rot: t * 0.45 * spin, band: R * 0.1 }); spin = -spin;
  };
  const cluster = (L, cx, cy, R) => {
    L.lobes.push([cx, cy, R]); curl(L, cx, cy, R);
    const n = 3 + (r() * 3 | 0);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.1 + 0.8 * (i + r() * 0.5) / n), rr = R * (0.45 + r() * 0.25), dd = R * (0.75 + r() * 0.2);
      const x = cx + Math.cos(a) * dd * (r() < 0.5 ? 1 : -1), y = cy + Math.sin(a) * dd * 0.8 + R * 0.25;
      L.lobes.push([x, y, rr]); if (rr > R * 0.55) curl(L, x, y, rr);
    }
  };
  const layer = () => ({ spine: null, lobes: [], spirals: [], wb });
  const bankRow = row => {
    const R0 = W * (row ? 0.2 : 0.17), y0 = H * (row ? 1.0 : 0.9);
    for (let x = -W * 0.08 + r() * R0 * 0.5; x < W * 1.1; x += R0 * (1.35 + r() * 0.5)) {
      const L = layer(), R = R0 * (0.75 + r() * 0.45), y = y0 - r() * R0 * 0.45 + Math.sin(t * 0.6 + x * 0.01) * R0 * 0.05;
      cluster(L, x, y, R); layers.push(L);
    }
  };
  if (P.bank > 1) bankRow(0);

  // the ribbon is a meander: x = A·sin θ while y climbs with a −sin 2θ wobble, which makes
  // near-level runs across the frame and round U-turns at each side on the way down
  const R = layer(), nb = P.bends, bankTop = P.bank ? H * 0.84 : H * 1.05;
  const th0 = -0.5, th1 = nb * Math.PI + 0.5, y0 = -H * 0.08, c = (bankTop + H * 0.12 - y0) / (th1 - th0);
  const ph = r() * TAU, A = W * 0.31 * P.wave, x0 = W * (0.5 + (r() - 0.5) * 0.1), flip = r() < 0.5 ? 1 : -1, spine = [], apex = [];
  for (let i = 0, n = nb * 70; i <= n; i++) {
    const th = th0 + (th1 - th0) * i / n, sn = Math.sin(th);
    const x = x0 + flip * A * (0.85 + 0.2 * Math.sin(th * 0.7 + ph)) * sn + Math.sin(t * 0.5 + th * 0.8) * W * 0.025;
    const y = y0 + c * (th - th0) - 0.32 * c * Math.sin(2 * th) + Math.cos(t * 0.4 + th) * H * 0.006;
    spine.push([x, y, wb * (0.72 + 0.4 * Math.abs(sn)) * (1 + 0.08 * Math.sin(th * 3 + ph + t * 0.3))]);
  }
  for (let k = 0; k <= nb; k++) { const th = Math.PI / 2 + k * Math.PI; if (th > th0 && th < th1) apex.push(Math.round((th - th0) / (th1 - th0) * nb * 70)); }
  R.spine = spine;
  // cloud puffs bulge out around the outer side of each U-turn
  for (const i of apex) {
    const [x, y, w] = spine[i], out = Math.sign(x - x0) || 1;
    for (const dy of [-0.55, 0.5]) if (r() < 0.8) R.lobes.push([x + out * w * (0.45 + r() * 0.2), y + dy * w, w * (0.55 + r() * 0.25)]);
  }
  // a cluster on some bends
  for (const i of apex) if (r() < 0.4 && spine[i][1] < bankTop - wb) cluster(R, spine[i][0], spine[i][1], wb * (1.3 + r() * 0.35));
  layers.push(R);
  if (P.bank) bankRow(1);
  return layers;
}

/* ---------- raster ---------- */
const idx = new Uint8Array(W * H), F = new Float32Array(W * H);
// coarse hash noise for the foil rim
const foil = (x, y) => { let h = Math.imul(x >> 3, 374761393) ^ Math.imul(y >> 3, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// distance field of one layer inside its bounding box: ribbon segments (hard min), then lobes (smooth union)
function field(L) {
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  const grow = (x, y, m) => { x0 = Math.min(x0, x - m); x1 = Math.max(x1, x + m); y0 = Math.min(y0, y - m); y1 = Math.max(y1, y + m); };
  if (L.spine) for (const [x, y, w] of L.spine) grow(x, y, w + 2);
  for (const [x, y, lr] of L.lobes) grow(x, y, lr * 1.35 + 2);
  const box = [Math.max(0, x0 | 0), Math.min(W - 1, Math.ceil(x1)), Math.max(0, y0 | 0), Math.min(H - 1, Math.ceil(y1))];
  if (box[0] > box[1] || box[2] > box[3]) return null;
  for (let y = box[2]; y <= box[3]; y++) F.fill(1e9, y * W + box[0], y * W + box[1] + 1);
  const p = L.spine || [];
  for (let i = 0; i + 1 < p.length; i++) {
    const [ax, ay, aw] = p[i], [bx, by, bw] = p[i + 1], ex = bx - ax, ey = by - ay, ll = ex * ex + ey * ey || 1, m = Math.max(aw, bw) + 2;
    const sx0 = Math.max(0, Math.floor(Math.min(ax, bx) - m)), sx1 = Math.min(W - 1, Math.ceil(Math.max(ax, bx) + m));
    const sy0 = Math.max(0, Math.floor(Math.min(ay, by) - m)), sy1 = Math.min(H - 1, Math.ceil(Math.max(ay, by) + m));
    for (let y = sy0; y <= sy1; y++) for (let x = sx0; x <= sx1; x++) {
      const tt = Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / ll)), px = x - ax - ex * tt, py = y - ay - ey * tt;
      const d = Math.sqrt(px * px + py * py) - (aw + (bw - aw) * tt), q = y * W + x;
      if (d < F[q]) F[q] = d;
    }
  }
  for (const [lx, ly, lr] of L.lobes) {
    const k = lr * 0.35, m = lr + k;
    const sx0 = Math.max(0, Math.floor(lx - m)), sx1 = Math.min(W - 1, Math.ceil(lx + m)), sy0 = Math.max(0, Math.floor(ly - m)), sy1 = Math.min(H - 1, Math.ceil(ly + m));
    for (let y = sy0; y <= sy1; y++) for (let x = sx0; x <= sx1; x++) {
      const q = y * W + x; F[q] = smin(F[q], Math.sqrt((x - lx) * (x - lx) + (y - ly) * (y - ly)) - lr, k);
    }
  }
  return box;
}
// color table indexes
const BG = 0, EDGE = 1, LINE = 2, FILL = 3, ACC0 = 4, ACC1 = 5, RIM = 6;
// paints one layer over what is already there
function paint(L, box) {
  const g = L.wb * 0.17, lw = Math.max(1.5, L.wb * 0.035), sp = L.wb * 0.2, inner = sp * P.lines;
  const mine = new Uint8Array((box[1] - box[0] + 1) * (box[3] - box[2] + 1)), bw = box[1] - box[0] + 1;
  for (let y = box[2]; y <= box[3]; y++) for (let x = box[0]; x <= box[1]; x++) {
    const q = y * W + x, d = F[q];
    if (d >= 0) continue;
    mine[(y - box[2]) * bw + x - box[0]] = 1;
    const depth = -d;
    if (depth < lw * 0.8) idx[q] = EDGE;
    else if (depth < g) { const n = foil(x, y); idx[q] = RIM + (n < 0.55 ? 0 : n < 0.85 ? 1 : 2); }
    else if (depth < g + lw) idx[q] = LINE;
    else {
      const e = depth - g - lw;
      idx[q] = e < inner && e % sp > sp - lw * 1.3 ? (((e / sp) | 0) % 2 ? ACC1 : ACC0) : FILL;
    }
  }
  for (const s of L.spirals) { // C-curls: a thick light band with a colored core, over this layer's fill only
    const sx0 = Math.max(box[0], Math.floor(s.x - s.Rs)), sx1 = Math.min(box[1], Math.ceil(s.x + s.Rs)), sy0 = Math.max(box[2], Math.floor(s.y - s.Rs)), sy1 = Math.min(box[3], Math.ceil(s.y + s.Rs));
    for (let y = sy0; y <= sy1; y++) for (let x = sx0; x <= sx1; x++) {
      const q = y * W + x, c = idx[q];
      if (!mine[(y - box[2]) * bw + x - box[0]] || (c !== FILL && c !== ACC0 && c !== ACC1)) continue;
      const dx = x - s.x, dy = y - s.y, rr = Math.sqrt(dx * dx + dy * dy);
      if (rr >= s.Rs) continue;
      const m = (((rr / s.b - (Math.atan2(dy, dx) + s.rot) * s.dir) % TAU) + TAU) % TAU, dist = Math.min(m, TAU - m) * s.b;
      const fade = 1 - (rr / s.Rs) ** 4;                       // the band thins out toward the curl's end
      idx[q] = dist < s.band * 0.35 * fade ? ACC1 : dist < s.band * fade ? ACC0 : FILL;
    }
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
  const pal = PALETTES[P.palette], table = [pal.bg, pal.edge, pal.line, pal.fill, ...pal.acc, ...pal.rim].map(hex);
  idx.fill(0);
  for (const L of scene(t)) { const box = field(L); if (box) paint(L, box); }
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
  for (let p = 0, o = 0; p < W * H; p++, o += 4) { const c = table[idx[p]]; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
  ctx.putImageData(img, 0, 0);
}

/* ---------- panel ---------- */
Object.assign(GL.STRINGS.vi, { m2Plain: 'Mây gốc', m2Ascii: 'ASCII', m2Palette: 'Bảng màu', m2Motion: 'Chuyển động', m2Speed: 'Tốc độ',
  m2Bends: 'Số khúc uốn', m2Width: 'Độ rộng dải', m2Bank: 'Lớp mây dưới', m2Lines: 'Đường viền trong', m2Turns: 'Vòng xoắn', m2Wave: 'Độ lượn', m2New: 'Tạo mây mới' });
Object.assign(GL.STRINGS.en, { m2Plain: 'Plain clouds', m2Ascii: 'ASCII', m2Palette: 'Palette', m2Motion: 'Motion', m2Speed: 'Speed',
  m2Bends: 'Bends', m2Width: 'Ribbon width', m2Bank: 'Cloud bank rows', m2Lines: 'Inner lines', m2Turns: 'Spiral turns', m2Wave: 'Swing', m2New: 'New clouds' });

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
    slider('speed', 'm2Speed', 0.2, 3, 0.1) + slider('bends', 'm2Bends', 2, 5, 1) + slider('width', 'm2Width', 0.6, 1.6, 0.05) +
    slider('wave', 'm2Wave', 0.3, 1.5, 0.05) + slider('bank', 'm2Bank', 0, 2, 1) + slider('lines', 'm2Lines', 0, 4, 1) +
    slider('turns', 'm2Turns', 1, 3, 0.1) + `<button type="button" data-m2new data-i18n="m2New"></button>`;
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
