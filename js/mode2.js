/* Glyph Loom · Author: Hy Nguyen */
/* Glyph Loom — mode 2: generative cloud clusters (test mode, self-contained).
 * Rules:
 *   - a cluster is one big lobe holding a spiral, shoulder bumps and 2–4 side lobes,
 *     joined with a smooth union and cut flat on its row's baseline;
 *   - its stripes are inset contours of that silhouette (signed distance / band
 *     width): light rim outside, darker inward;
 *   - the spiral (r = b·θ) turns 1.5–2.5 times, light along its line, dark
 *     between turns; neighbours alternate their spin;
 *   - clusters are painted small to big, so the big ones sit in front.
 * Draws into GL.mode2.canvas, which app.js uses like any other source.
 * Removing the <script> tag for this file hides mode 2 completely.
 */
window.GL = window.GL || {};

(() => {
const W = 1200, H = 760, BG = '#F6F5F5';
// light rim → dark core
const STOPS = ['#FBE6D6', '#F4B496', '#E9765C', '#D43C33', '#A9212A', '#7A141E'];
const P = { seed: 11, rows: 2, clusters: 5, bands: 5, turns: 2 };

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
// n+1 colors spread over STOPS
function palette(n) {
  const s = STOPS.map(hex), out = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n * (s.length - 1), a = Math.floor(u), b = Math.min(s.length - 1, a + 1), f = u - a;
    out.push(s[a].map((v, q) => Math.round(v + (s[b][q] - v) * f)));
  }
  return out;
}
// polynomial smooth min: rounds the joint where two lobes meet
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

function layout() {
  const r = rng(P.seed), out = [];
  const rows = P.rows === 1 ? [H * 0.66] : [H * 0.4, H * 0.9];
  rows.forEach((yb, ri) => {
    const n = P.clusters, Rmax = W / (n * 1.05) * (P.rows === 1 ? 0.8 : 0.62);
    for (let i = 0; i < n; i++) {
      const R = Rmax * (0.55 + r() * 0.45);
      const cx = (i + 0.5 + (r() - 0.5) * 0.5) / n * W, cy = yb - R * (0.5 + r() * 0.2);
      const lobes = [[cx, cy, R]];
      for (const side of [-1, 1]) {
        // a shoulder bump high on the main lobe gives the scalloped top
        if (r() < 0.7) { const a = (0.25 + r() * 0.2) * Math.PI, rb = R * (0.38 + r() * 0.12); lobes.push([cx + side * Math.sin(a) * R * 0.72, cy - Math.cos(a) * R * 0.72, rb]); }
        const r1 = R * (0.5 + r() * 0.2), x1 = cx + side * R * (0.8 + r() * 0.2), y1 = cy + R * (0.1 + r() * 0.2);
        lobes.push([x1, y1, r1]);
        if (r() < 0.5) { const r2 = r1 * (0.55 + r() * 0.15); lobes.push([x1 + side * (r1 * 0.8 + r2 * 0.4), y1 + r1 * 0.35, r2]); }
      }
      const dir = ((i + ri) % 2 ? 1 : -1) * (r() < 0.15 ? -1 : 1);
      const turns = Math.max(1.2, P.turns + (r() - 0.5) * 0.6), Rs = R * 0.8;
      out.push({ R, yb, lobes, dir, sx: cx + R * 0.04 * dir, sy: cy - R * 0.04, Rs, b: Rs / (Math.PI * 2 * turns) });
    }
  });
  return out.sort((a, b) => a.R - b.R);
}

function draw() {
  const N = P.bands, pal = palette(N), cl = layout();
  const lev = new Int8Array(W * H).fill(-1);
  for (const c of cl) {
    const k = c.R * 0.12, bw = c.R * 0.1;
    let x0 = W, x1 = 0, y0 = H;
    for (const [x, y, r] of c.lobes) { x0 = Math.min(x0, x - r); x1 = Math.max(x1, x + r); y0 = Math.min(y0, y - r); }
    x0 = Math.max(0, Math.floor(x0 - k)); x1 = Math.min(W - 1, Math.ceil(x1 + k));
    y0 = Math.max(0, Math.floor(y0 - k)); const y1 = Math.min(H - 1, Math.ceil(c.yb));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      let d = 1e9;
      for (const [lx, ly, lr] of c.lobes) d = smin(d, Math.hypot(x - lx, y - ly) - lr, k);
      d = Math.max(d, y - c.yb);
      if (d >= 0) continue;
      let L = Math.min(N, Math.floor(-d / bw));
      const dx = x - c.sx, dy = y - c.sy, rr = Math.hypot(dx, dy);
      if (rr < c.Rs) {
        const m = ((rr / c.b - Math.atan2(dy, dx) * c.dir) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const gap = Math.min(m, Math.PI * 2 - m) / Math.PI;          // 0 on the spiral line, 1 between turns
        L = Math.min(L, Math.floor(gap * N + (rr / c.Rs) ** 3 * N)); // fades out toward the spiral's outer end
      }
      lev[y * W + x] = Math.max(0, L);
    }
  }
  const ctx = canvas.getContext('2d'), img = ctx.createImageData(W, H), d = img.data, bg = hex(BG);
  for (let p = 0; p < W * H; p++) {
    const c = lev[p] < 0 ? bg : pal[lev[p]];
    d[p * 4] = c[0]; d[p * 4 + 1] = c[1]; d[p * 4 + 2] = c[2]; d[p * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

const canvas = document.createElement('canvas');
canvas.width = W; canvas.height = H;

Object.assign(GL.STRINGS.vi, { m2Rows: 'Hàng', m2Clusters: 'Số cụm', m2Bands: 'Số sọc', m2Turns: 'Vòng xoắn', m2New: 'Tạo mây mới' });
Object.assign(GL.STRINGS.en, { m2Rows: 'Rows', m2Clusters: 'Clusters', m2Bands: 'Bands', m2Turns: 'Spiral turns', m2New: 'New clouds' });

// builds the mode 2 panel at the top of the rail; onChange runs after every redraw
function mount(rail, onChange) {
  const sec = document.createElement('section');
  sec.hidden = true;
  const slider = (key, label, min, max, step) => `<div class="row"><label data-i18n="${label}"></label>` +
    `<input data-m2="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${P[key]}"><output>${P[key]}</output></div>`;
  sec.innerHTML = `<h2>Mode 2</h2>` + slider('rows', 'm2Rows', 1, 2, 1) + slider('clusters', 'm2Clusters', 2, 8, 1) +
    slider('bands', 'm2Bands', 3, 7, 1) + slider('turns', 'm2Turns', 1, 3, 0.1) + `<button type="button" data-i18n="m2New"></button>`;
  const redraw = () => { draw(); onChange(); };
  sec.querySelectorAll('[data-m2]').forEach(inp => inp.addEventListener('input', () => {
    P[inp.dataset.m2] = +inp.value; inp.nextElementSibling.textContent = inp.value; redraw();
  }));
  sec.querySelector('button').addEventListener('click', () => { P.seed = (Math.random() * 1e6) | 0; redraw(); });
  rail.prepend(sec);
  GL.mode2.panel = sec;
}

GL.mode2 = { canvas, draw, mount, BG, panel: null };
})();
