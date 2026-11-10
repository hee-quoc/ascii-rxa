/* Glyph Loom · Author: Hy Nguyen */
/* Glyph Loom — mode 2: drifting clouds (test mode, self-contained).
 * Cloud sprites (bundled images listed in SPRITES) drift sideways across a wide sky.
 * Each cloud gets a random depth: near clouds are bigger, lower in the stack order and
 * faster; far ones are small and slow (parallax). A cloud that leaves the frame comes
 * back on the other side with a new size, height and sprite, so the sky keeps changing.
 * Sprites on a plain light background are keyed out on load (the background color is
 * read from the image corners), so clouds can overlap cleanly.
 * Draws into GL.mode2.canvas, which app.js uses like any other source.
 * Removing the <script> tag for this file hides mode 2 completely.
 */
window.GL = window.GL || {};

(() => {
const W = 1600, H = 900;
// add more cloud images here as they come in
const SPRITES = ['assets/mode2/cloud-1.png'];
const P = { seed: 7, view: 'plain', bg: '#F6F5F5', count: 7, minSize: 0.22, maxSize: 0.6, speed: 1, dir: 1, gust: 0.3, bob: 0.25, flip: true, playing: true };

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- sprites ---------- */
const sprites = [];
// makes a light, flat background transparent and crops to the drawing
function keyed(img) {
  const w = img.naturalWidth, h = img.naturalHeight, c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const id = x.getImageData(0, 0, w, h), d = id.data;
  const corner = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([cx, cy]) => (cy * w + cx) * 4);
  if (corner.some(i => d[i + 3] < 250)) return crop(c, d, w, h); // already transparent
  const bg = [0, 1, 2].map(k => corner.map(i => d[i + k]).sort((a, b) => a - b)[1]);
  for (let i = 0; i < d.length; i += 4) {
    const dist = Math.max(Math.abs(d[i] - bg[0]), Math.abs(d[i + 1] - bg[1]), Math.abs(d[i + 2] - bg[2]));
    const a = Math.min(1, Math.max(0, (dist - 10) / 30));
    if (a < 1) { // un-mix the background from soft edges so they don't keep a light halo
      for (let k = 0; k < 3; k++) d[i + k] = a > 0 ? Math.min(255, Math.max(0, (d[i + k] - bg[k] * (1 - a)) / a)) : 0;
      d[i + 3] = Math.round(d[i + 3] * a);
    }
  }
  despeck(d, w, h);
  x.putImageData(id, 0, 0);
  return crop(c, d, w, h);
}
// drops specks: opaque islands far smaller than the biggest one (dust, JPEG noise)
function despeck(d, w, h) {
  const lab = new Int32Array(w * h).fill(-1), sizes = [], stack = [];
  for (let s = 0; s < w * h; s++) {
    if (lab[s] >= 0 || d[s * 4 + 3] <= 8) continue;
    const id = sizes.length; let n = 0; lab[s] = id; stack.push(s);
    while (stack.length) {
      const p = stack.pop(), x = p % w, y = (p / w) | 0; n++;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1])
        if (q >= 0 && lab[q] < 0 && d[q * 4 + 3] > 8) { lab[q] = id; stack.push(q); }
    }
    sizes.push(n);
  }
  const keep = Math.max(...sizes, 0) * 0.002;
  for (let p = 0; p < w * h; p++) if (lab[p] >= 0 && sizes[lab[p]] < keep) d[p * 4 + 3] = 0;
}
function crop(c, d, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return c;
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext('2d').drawImage(c, -x0, -y0);
  return o;
}
const ready = Promise.all(SPRITES.map(src => new Promise(ok => {
  const img = new Image();
  img.onload = () => { sprites.push(keyed(img)); ok(); };
  img.onerror = () => ok();
  img.src = src;
})));

/* ---------- sky ---------- */
let clouds = [], r = rng(P.seed), last = null, clock = 0; // clock: sky time, stops while paused
// a cloud at depth z (0 far … 1 near); `edge` puts it just outside the frame on the upwind side
function spawn(edge) {
  const z = r(), sp = sprites[(r() * sprites.length) | 0];
  const w = W * (P.minSize + (P.maxSize - P.minSize) * z * z), h = w * sp.height / sp.width;
  const y = H * 0.04 + r() * Math.max(0, H * 0.92 - h);
  const x = edge ? (P.dir > 0 ? -w - r() * W * 0.15 : W + r() * W * 0.15) : -w * 0.5 + r() * (W + w * 0.5);
  return { sp, z, w, h, x, y, flip: P.flip && r() < 0.5, ph: r() * Math.PI * 2, drift: 0.85 + r() * 0.3 };
}
function reset() {
  r = rng(P.seed);
  clouds = sprites.length ? Array.from({ length: P.count }, () => spawn(false)) : [];
}

const canvas = document.createElement('canvas');
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext('2d');
// time in ms from the render loop
function draw(time) {
  const dt = last === null || !P.playing ? 0 : Math.min(0.1, (time - last) / 1000);
  last = time; clock += dt;
  if (!clouds.length && sprites.length) reset();
  const t = clock;
  for (const c of clouds) {
    // near clouds move faster; a slow gust makes the whole sky breathe a little
    const gust = 1 + P.gust * Math.sin(t * 0.23 + c.ph) * 0.6;
    c.x += P.dir * P.speed * W * 0.025 * (0.35 + 0.9 * c.z) * c.drift * gust * dt;
    if ((P.dir > 0 && c.x > W + 4) || (P.dir < 0 && c.x + c.w < -4)) Object.assign(c, spawn(true));
  }
  ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
  ctx.imageSmoothingQuality = 'high';
  for (const c of [...clouds].sort((a, b) => a.z - b.z)) {
    const y = c.y + Math.sin(t * 0.5 * (0.6 + c.z) + c.ph) * H * 0.012 * P.bob * (0.5 + c.z);
    if (c.flip) { ctx.save(); ctx.translate(c.x + c.w, y); ctx.scale(-1, 1); ctx.drawImage(c.sp, 0, 0, c.w, c.h); ctx.restore(); }
    else ctx.drawImage(c.sp, c.x, y, c.w, c.h);
  }
}

/* ---------- panel ---------- */
Object.assign(GL.STRINGS.vi, { m2Plain: 'Mây gốc', m2Ascii: 'ASCII', m2Play: 'Mây bay', m2Speed: 'Tốc độ', m2Dir: 'Hướng bay', m2Right: 'sang phải →', m2Left: '← sang trái',
  m2Gust: 'Gió thổi không đều', m2Bob: 'Bồng bềnh', m2Count: 'Số mây', m2Min: 'Mây nhỏ nhất', m2Max: 'Mây to nhất', m2Flip: 'Lật ngẫu nhiên', m2Bg: 'Nền trời', m2New: 'Tạo mây mới' });
Object.assign(GL.STRINGS.en, { m2Plain: 'Plain clouds', m2Ascii: 'ASCII', m2Play: 'Clouds drift', m2Speed: 'Speed', m2Dir: 'Direction', m2Right: 'to the right →', m2Left: '← to the left',
  m2Gust: 'Gusty wind', m2Bob: 'Float', m2Count: 'Clouds', m2Min: 'Smallest cloud', m2Max: 'Biggest cloud', m2Flip: 'Random flip', m2Bg: 'Sky', m2New: 'New clouds' });

let sec = null;
// builds the mode 2 panel at the top of the rail; onChange(what) tells the app something changed
function mount(rail, onChange) {
  sec = document.createElement('section');
  sec.hidden = true;
  const slider = (key, label, min, max, step) => `<div class="row"><label data-i18n="${label}"></label>` +
    `<input data-m2="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${P[key]}"><output>${P[key]}</output></div>`;
  sec.innerHTML = `<h2>Mode 2</h2>
    <div class="seg m2-view"><button type="button" data-view="plain" data-i18n="m2Plain"></button><button type="button" data-view="ascii" data-i18n="m2Ascii"></button></div>
    <label class="check"><input type="checkbox" data-m2c="playing"${P.playing ? ' checked' : ''}> <span data-i18n="m2Play"></span></label>` +
    slider('speed', 'm2Speed', 0, 4, 0.1) +
    `<div class="row2"><label data-i18n="m2Dir"></label><select data-m2dir><option value="1" data-i18n="m2Right"></option><option value="-1" data-i18n="m2Left"></option></select></div>` +
    slider('gust', 'm2Gust', 0, 1, 0.05) + slider('bob', 'm2Bob', 0, 1, 0.05) +
    slider('count', 'm2Count', 1, 20, 1) + slider('minSize', 'm2Min', 0.05, 0.6, 0.01) + slider('maxSize', 'm2Max', 0.1, 1.2, 0.01) +
    `<label class="check"><input type="checkbox" data-m2c="flip"${P.flip ? ' checked' : ''}> <span data-i18n="m2Flip"></span></label>
    <div class="row2"><label data-i18n="m2Bg"></label><div class="inks"><input type="color" data-m2bg value="${P.bg}"></div></div>
    <button type="button" data-m2new data-i18n="m2New"></button>`;
  const syncView = () => sec.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === P.view));
  syncView();
  // size and count changes rebuild the sky from the same seed; motion changes apply live
  const rebuild = new Set(['count', 'minSize', 'maxSize']);
  sec.querySelectorAll('[data-m2]').forEach(inp => inp.addEventListener('input', () => {
    const k = inp.dataset.m2; P[k] = +inp.value; inp.nextElementSibling.textContent = inp.value;
    if (k === 'minSize' && P.minSize > P.maxSize) { P.maxSize = P.minSize; syncSliders(); }
    if (k === 'maxSize' && P.maxSize < P.minSize) { P.minSize = P.maxSize; syncSliders(); }
    if (rebuild.has(k)) reset();
    onChange('shape');
  }));
  const syncSliders = () => sec.querySelectorAll('[data-m2]').forEach(i => { i.value = P[i.dataset.m2]; i.nextElementSibling.textContent = P[i.dataset.m2]; });
  sec.querySelectorAll('[data-m2c]').forEach(inp => inp.addEventListener('input', () => { P[inp.dataset.m2c] = inp.checked; if (inp.dataset.m2c === 'flip') reset(); onChange('motion'); }));
  sec.querySelector('[data-m2dir]').addEventListener('input', e => { P.dir = +e.target.value; onChange('motion'); });
  sec.querySelector('[data-m2bg]').addEventListener('input', e => { P.bg = e.target.value; onChange('bg'); });
  sec.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { P.view = b.dataset.view; syncView(); onChange('view'); }));
  sec.querySelector('[data-m2new]').addEventListener('click', () => { P.seed = (Math.random() * 1e6) | 0; reset(); onChange('shape'); });
  rail.prepend(sec);
  GL.mode2.panel = sec;
}

GL.mode2 = {
  canvas, draw, mount, ready, panel: null,
  get plain() { return P.view === 'plain'; },
  get moving() { return P.playing && P.speed > 0; },
  get bg() { return P.bg; },
  restart() { last = null; reset(); },
};
})();
