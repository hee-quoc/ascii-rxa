/* Glyph Loom — engine + UI.
 * Pipeline per frame:
 *   source → sampled to a cols×rows grid → brightness picks a glyph from the
 *   ramp → glyphs stamped (white) into a mask from a pre-rendered atlas →
 *   a per-cell color grid is scaled up and clipped by that mask → composited
 *   over the background and the optional source-image layer.
 * In "zones" color mode each cell first finds its color zone (js/zones.js);
 * the zone decides the glyph set and the color, brightness the glyph within it.
 */
(() => {
const { CHARSETS, DEFAULTS, PRESETS, t } = GL;
const $ = s => document.querySelector(s);
const clone = o => JSON.parse(JSON.stringify(o));
// presets may list fewer than MAX_INKS colors; fill the rest with the last
// active one so raising the color count keeps the dark → bright order
function withInks(s) {
  const last = s.inks[Math.max(0, Math.min(s.inkN, s.inks.length) - 1)];
  while (s.inks.length < GL.MAX_INKS) s.inks.push(last);
  return s;
}

let state = withInks(clone({ ...DEFAULTS, ...PRESETS[GL.DEFAULT_PRESET] }));
let activePreset = GL.DEFAULT_PRESET;

/* ---------- sources ---------- */
let source = null;               // { kind: 'sample' | 'image' | 'video', el, name }
const dragonCanvas = document.createElement('canvas');
dragonCanvas.width = 1000; dragonCanvas.height = 1000;

function useSample() {
  clearVideo(); source = { kind: 'sample', el: dragonCanvas, name: 'dragon' };
  GL.drawDragon(dragonCanvas, 0); detectZones();
  $('#playBtn').hidden = true; dirty = true;
}
// zones come from the current source (a video's first frame) and are reset when it changes
function detectZones() {
  if (!source) return;
  const [sw, sh] = srcSize(source); if (!sw || !sh) return;
  state.zones = GL.detectZones(source.el, sw, sh, state.zoneN);
  pickTarget = null; renderZones(); dirty = true;
}
let objUrl = null;
function clearVideo() {
  if (source && source.kind === 'video') { source.el.pause(); source.el.removeAttribute('src'); source.el.load(); }
  if (objUrl) { URL.revokeObjectURL(objUrl); objUrl = null; }
}
function loadFile(f) {
  if (!f) return;
  const isVideo = f.type.startsWith('video/');
  const isSvg = /svg/.test(f.type) || /\.svg$/i.test(f.name);
  const isImage = f.type.startsWith('image/') || isSvg;
  if (!isVideo && !isImage) { toast(t('tUnsupported')); return; }
  clearVideo();
  objUrl = URL.createObjectURL(f);
  const base = f.name.replace(/\.[^.]+$/, '');
  if (isVideo) {
    const v = document.createElement('video');
    v.muted = true; v.loop = true; v.playsInline = true; v.src = objUrl;
    v.addEventListener('loadeddata', () => {
      source = { kind: 'video', el: v, name: base }; detectZones(); v.play().catch(() => {});
      $('#playBtn').hidden = false; updatePlayLabel(); dirty = true;
    }, { once: true });
    v.addEventListener('error', () => toast(t('tBadVideo')), { once: true });
  } else {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight, el = img;
      if (isSvg || !w) { // rasterise SVGs so they have a usable size
        const scale = w ? Math.max(1, 1600 / Math.max(w, h)) : 1;
        w = (w || 1600) * scale; h = (h || 1600) * scale;
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h); el = c;
      }
      source = { kind: 'image', el, name: base }; detectZones(); $('#playBtn').hidden = true; dirty = true;
    };
    img.onerror = () => toast(t('tBadImage'));
    img.src = objUrl;
  }
  $('#hint').hidden = true;
}
function srcSize(s) {
  const e = s.el;
  if (s.kind === 'video') return [e.videoWidth || 1, e.videoHeight || 1];
  if (e instanceof HTMLImageElement) return [e.naturalWidth, e.naturalHeight];
  return [e.width, e.height];
}
function drawCover(ctx, el, sw, sh, w, h) {
  const r = Math.max(w / sw, h / sh), dw = sw * r, dh = sh * r;
  ctx.drawImage(el, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

/* ---------- glyph atlas ---------- */
const atlasCache = {};
function getAtlas(name, ramp) {
  const toks = GL.parseRamp(ramp), s = state.cell, L = Math.max(1, toks.length);
  const key = [ramp, s, state.fscale, state.bold].join('|');
  if (atlasCache[name] && atlasCache[name].key === key) return atlasCache[name];
  const c = document.createElement('canvas'); c.width = s * L; c.height = s;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `${state.bold ? 700 : 500} ${s * state.fscale}px "Geist Mono", ui-monospace, Menlo, monospace`;
  // gi[i] = order of level i among the visible glyphs, G = how many there are;
  // palette colors are dealt out over that order so each glyph keeps one color
  const empty = [], gi = [], vis = [];
  let G = 0;
  for (let i = 0; i < L; i++) {
    const tok = toks[i] || '';
    empty[i] = !tok;
    if (empty[i]) continue;
    gi[i] = G++; vis.push(i);
    x.save(); x.beginPath(); x.rect(i * s, 0, s, s); x.clip();
    if (GL.SHAPES[tok]) GL.SHAPES[tok](x, i * s, 0, s, state.fscale);
    else if ([...tok].length > 1) x.fillText(tok, i * s + s / 2, s / 2 + s * 0.05, s * 0.94); // words squeeze into the cell
    else x.fillText(tok, i * s + s / 2, s / 2 + s * 0.05);
    x.restore();
  }
  return atlasCache[name] = { key, c, L, empty, gi, G, vis, toks };
}

/* ---------- render ---------- */
const out = $('#out'), octx = out.getContext('2d');
const sampC = document.createElement('canvas'), sctx = sampC.getContext('2d', { willReadFrequently: true });
const colC = document.createElement('canvas'), cctx = colC.getContext('2d');
const maskC = document.createElement('canvas'), mctx = maskC.getContext('2d');
const inkC = document.createElement('canvas'), ictx = inkC.getContext('2d');
const imgC = document.createElement('canvas'), gctx = imgC.getContext('2d');
let dirty = true;
// static film grain, regenerated only when the output size changes
const grainC = document.createElement('canvas');
function getGrain(W, H) {
  if (grainC.width === W && grainC.height === H) return grainC;
  grainC.width = W; grainC.height = H;
  const g = grainC.getContext('2d'), im = g.createImageData(W, H), a = im.data;
  for (let i = 0; i < a.length; i += 4) { const v = Math.random() < 0.5 ? 0 : 255; a[i] = a[i + 1] = a[i + 2] = v; a[i + 3] = Math.random() * 255; }
  g.putImageData(im, 0, 0);
  return grainC;
}
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function hash(x, y, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const inkIndex = (j, G, n) => Math.min(n - 1, Math.floor(j * n / G));
function setSize(c, w, h) { if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } }
let lastInfo = null;
let svgCells = null; // when set, render() also records every drawn glyph here for the SVG export

function render(time) {
  if (!source) return;
  if (source.kind === 'sample') GL.drawDragon(dragonCanvas, time);
  const [sw, sh] = srcSize(source); if (!sw || !sh) return;
  const ar = state.frame === 'source' ? sw / sh : +state.frame;
  const s = state.cell, outW = +state.size, outH = Math.round(outW / ar);
  const cols = Math.max(1, Math.floor(outW / s)), rows = Math.max(1, Math.floor(outH / s));
  const W = cols * s, H = rows * s;
  [out, maskC, inkC, imgC].forEach(c => setSize(c, W, H));
  setSize(sampC, cols, rows); setSize(colC, cols, rows);

  sctx.clearRect(0, 0, cols, rows); sctx.imageSmoothingQuality = 'high';
  drawCover(sctx, source.el, sw, sh, cols, rows);
  const d = sctx.getImageData(0, 0, cols, rows).data;
  const cd = cctx.createImageData(cols, rows), cdd = cd.data;

  const main = getAtlas('main', state.ramp);
  const alt = state.patch ? getAtlas('alt', CHARSETS[state.altSet].ramp) : null;
  const inks = state.inks.map(hex), n = state.inkN;
  const zoneMode = state.color === 'zones' && state.zones.length > 0;
  const zAt = zoneMode ? state.zones.map((z, k) => getAtlas('z' + k, z.ramp)) : null;
  const zInk = zoneMode ? state.zones.map(z => hex(z.ink)) : null;
  const zOf = zoneMode ? GL.zoneMatcher(state.zones, state.zoneTol) : null;
  const blk = state.block, bcols = Math.ceil(cols / blk), brows = Math.ceil(rows / blk);
  const kinds = new Uint8Array(bcols * brows); // 0 main, 1 set 2, 2 reveal image, 3 flip
  if (state.patch) for (let by = 0; by < brows; by++) for (let bx = 0; bx < bcols; bx++) {
    const r = hash(bx, by, state.seed);
    kinds[by * bcols + bx] = r < state.reveal ? 2 : r < state.reveal + state.alt ? 1 : r < state.reveal + state.alt + state.flip ? 3 : 0;
  }
  mctx.clearRect(0, 0, W, H);
  const { bright, contrast, gamma, cut, invert, sat, flicker } = state;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const i = (y * cols + x) * 4;
    if (d[i + 3] < 40) continue;                       // transparent pixels stay empty
    const kind = state.patch ? kinds[((y / blk) | 0) * bcols + ((x / blk) | 0)] : 0;
    if (kind === 2) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const zk = zoneMode ? zOf(r, g, b) : -1;
    if (zoneMode && (zk < 0 || !state.zones[zk].on)) continue;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    let v = (lum - 0.5) * contrast + 0.5 + bright;
    v = v < 0 ? 0 : v > 1 ? 1 : v; v = Math.pow(v, gamma);
    if (invert) v = 1 - v;
    if (kind === 3) v = 1 - v;
    if (v < cut) continue;
    const at = kind === 1 ? alt : zk >= 0 ? zAt[zk] : main;
    let lev;
    if (zk >= 0 && at === zAt[zk]) {
      // a zone that is shown covers all its cells: brightness only picks among its real glyphs
      if (!at.G) continue;
      let j = Math.round(v * (at.G - 1));
      if (flicker && Math.random() < flicker) j = Math.max(0, Math.min(at.G - 1, j + (Math.random() < .5 ? -1 : 1)));
      lev = at.vis[j];
    } else {
      lev = Math.round(v * (at.L - 1));
      if (flicker && Math.random() < flicker) lev = Math.max(0, Math.min(at.L - 1, lev + (Math.random() < .5 ? -1 : 1)));
      if (at.empty[lev]) continue;
    }
    mctx.drawImage(at.c, lev * s, 0, s, s, x * s, y * s, s, s);
    let cr, cg, cb;
    switch (zk >= 0 ? 'zone' : state.color) {
      case 'zone': [cr, cg, cb] = zInk[zk]; break;
      case 'mono': [cr, cg, cb] = inks[0]; break;
      case 'palette': [cr, cg, cb] = inks[inkIndex(at.gi[lev], at.G, n)]; break;
      case 'duotone': { const a = inks[0], z = inks[Math.min(1, n - 1)]; cr = a[0] + (z[0] - a[0]) * v; cg = a[1] + (z[1] - a[1]) * v; cb = a[2] + (z[2] - a[2]) * v; break; }
      default: { const l = lum * 255; cr = l + (r - l) * sat; cg = l + (g - l) * sat; cb = l + (b - l) * sat; }
    }
    cdd[i] = cr; cdd[i + 1] = cg; cdd[i + 2] = cb; cdd[i + 3] = 255;
    if (svgCells) svgCells.push([x, y, at.toks[lev], cdd[i] << 16 | cdd[i + 1] << 8 | cdd[i + 2]]);
  }
  cctx.putImageData(cd, 0, 0);

  if (state.imgOpacity > 0 || (state.patch && state.reveal > 0)) {
    gctx.clearRect(0, 0, W, H);
    gctx.filter = state.imgGray ? 'grayscale(1) contrast(1.1)' : 'none';
    drawCover(gctx, source.el, sw, sh, W, H);
    gctx.filter = 'none';
  }
  ictx.globalCompositeOperation = 'source-over'; ictx.clearRect(0, 0, W, H);
  ictx.imageSmoothingEnabled = false; ictx.drawImage(colC, 0, 0, W, H);
  ictx.globalCompositeOperation = 'destination-in'; ictx.drawImage(maskC, 0, 0);
  ictx.globalCompositeOperation = 'source-over';

  octx.globalCompositeOperation = 'source-over'; octx.globalAlpha = 1;
  octx.fillStyle = state.bg; octx.fillRect(0, 0, W, H);
  if (state.imgOpacity > 0) { octx.globalAlpha = state.imgOpacity; octx.globalCompositeOperation = state.imgBlend; octx.drawImage(imgC, 0, 0); }
  octx.globalAlpha = state.inkOpacity; octx.globalCompositeOperation = state.blend; octx.drawImage(inkC, 0, 0);
  octx.globalAlpha = 1; octx.globalCompositeOperation = 'source-over';
  if (state.grain > 0) { octx.globalAlpha = state.grain; octx.drawImage(getGrain(W, H), 0, 0); octx.globalAlpha = 1; }
  if (state.patch && state.reveal > 0) {
    octx.save(); octx.beginPath();
    for (let by = 0; by < brows; by++) for (let bx = 0; bx < bcols; bx++) if (kinds[by * bcols + bx] === 2) octx.rect(bx * blk * s, by * blk * s, blk * s, blk * s);
    octx.clip(); octx.drawImage(imgC, 0, 0); octx.restore();
  }
  if (state.label) drawLabel(W, H);
  lastInfo = { cols, rows, W, H, s, brows, bcols, blk, kinds }; updateMeta();
}
function updateMeta() {
  if (!lastInfo || !source) return;
  const kind = { sample: t('kindSample'), image: t('kindImage'), video: t('kindVideo') }[source.kind];
  $('#meta').textContent = `${lastInfo.cols} × ${lastInfo.rows} ${t('chars')} · ${lastInfo.W} × ${lastInfo.H} px · ${kind}`;
}
// label geometry and colors, shared by the canvas and the SVG export
function labelLayout(W, H) {
  if (state.labelPos === 'vl') { // small vertical caption on the left edge, no box
    return { vertical: true, fs: Math.round(W * 0.016), weight: 700, x: W * 0.022, y: H / 2, fill: state.inks[0] };
  }
  const fs = Math.round(W * 0.052), padX = fs * 0.45, padY = fs * 0.3;
  octx.font = `500 ${fs}px "Geist Mono", ui-monospace, monospace`;
  const tw = octx.measureText(state.label).width, bw = tw + padX * 2, bh = fs + padY * 2, m = W * 0.05;
  let x, y;
  switch (state.labelPos) {
    case 'bl': x = m; y = H - m - bh; break;
    case 'tl': x = m; y = m; break;
    case 'br': x = W - m - bw; y = H - m - bh; break;
    default: x = (W - bw) / 2; y = (H - bh) / 2;
  }
  // box uses the lightest glyph color; text uses the background
  const list = state.inks.slice(0, state.inkN).map(hex).sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  const light = list[list.length - 1], bgc = hex(state.bg), lc = `rgb(${light})`;
  const lightIsLighter = light[0] + light[1] + light[2] > bgc[0] + bgc[1] + bgc[2];
  return { fs, weight: 500, box: [x, y, bw, bh], boxFill: lightIsLighter ? lc : state.bg, fill: lightIsLighter ? state.bg : lc, x: x + padX, y: y + bh / 2 + fs * 0.04 };
}
function drawLabel(W, H) {
  const L = labelLayout(W, H);
  octx.save();
  if (L.box) { octx.fillStyle = L.boxFill; octx.fillRect(...L.box); }
  octx.font = `${L.weight} ${L.fs}px "Geist Mono", ui-monospace, monospace`;
  octx.textAlign = L.vertical ? 'center' : 'left'; octx.textBaseline = 'middle'; octx.fillStyle = L.fill;
  octx.translate(L.x, L.y); if (L.vertical) octx.rotate(-Math.PI / 2);
  octx.fillText(state.label, 0, 0); octx.restore();
}

let recording = false;
function loop(time) {
  const animated = (source && (source.kind === 'sample' || (source.kind === 'video' && !source.el.paused))) || state.flicker > 0 || recording;
  if (dirty || animated) { dirty = false; render(time); }
  requestAnimationFrame(loop);
}

/* ---------- UI ---------- */
const INT_KEYS = ['cell', 'inkN', 'block', 'zoneN'];
const PCT_KEYS = ['cut', 'imgOpacity', 'inkOpacity', 'reveal', 'alt', 'flip', 'flicker', 'grain', 'zoneTol'];
function fmt(k, v) {
  if (typeof v !== 'number') return v;
  if (INT_KEYS.includes(k)) return String(v);
  if (PCT_KEYS.includes(k)) return Math.round(v * 100) + '%';
  return v.toFixed(2);
}
function buildSeg(name, items, onPick) {
  const box = document.querySelector(`[data-seg="${name}"]`);
  box.innerHTML = '';
  for (const [v, label] of items) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.v = v;
    b.textContent = typeof label === 'function' ? label() : label;
    if (typeof label === 'function') b.dataset.dyn = '1';
    b.addEventListener('click', () => { onPick(v); changed(); });
    box.appendChild(b);
  }
}
function buildDynamicLabels() {
  buildSeg('ramp', Object.values(CHARSETS).map(c => [c.ramp, c.name]), v => state.ramp = v);
  buildSeg('color', [['mono', () => t('cMono')], ['palette', () => t('cPalette')], ['duotone', () => t('cDuo')], ['source', () => t('cSource')], ['zones', () => t('cZones')]], v => state.color = v);
  $('#altSet').innerHTML = Object.entries(CHARSETS).map(([k, c]) => `<option value="${k}">${t('set2')}: ${c.name}</option>`).join('');
  document.querySelectorAll('.preset span').forEach(sp => sp.textContent = PRESETS[sp.parentNode.dataset.p].name[GL.lang]);
  document.querySelectorAll('#inks input').forEach((c, i) => c.setAttribute('aria-label', `${t('inkLabel')} ${i + 1}`));
  updatePlayLabel(); updateRecLabel(); updateMeta(); renderZones();
}
const inkBox = $('#inks');
for (let i = 0; i < GL.MAX_INKS; i++) {
  const c = document.createElement('input'); c.type = 'color'; c.id = 'ink' + i;
  c.addEventListener('input', () => { state.inks[i] = c.value; changed(); });
  inkBox.appendChild(c);
}
function syncUI() {
  document.querySelectorAll('[data-k]').forEach(el => {
    const v = state[el.dataset.k];
    if (el.type === 'checkbox') el.checked = !!v; else if (el.value !== String(v)) el.value = v;
  });
  document.querySelectorAll('[data-o]').forEach(o => o.textContent = fmt(o.dataset.o, state[o.dataset.o]));
  document.querySelectorAll('[data-seg]').forEach(box => box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === state[box.dataset.seg])));
  state.inks.forEach((h, i) => { const c = $('#ink' + i); c.value = h; c.classList.toggle('off', i >= state.inkN); });
  document.querySelectorAll('.preset').forEach(b => b.classList.toggle('on', b.dataset.p === activePreset));
  const zoneMode = state.color === 'zones';
  $('#zonePanel').hidden = !zoneMode; $('#legend').hidden = zoneMode;
  document.querySelectorAll('.nozone').forEach(el => el.hidden = zoneMode); // zones set their own colors frame.classList.toggle('zoning', zoneMode);
  styleZones(); drawLegend();
}

/* ---------- color zones panel ---------- */
let pickTarget = null;           // zone index waiting for a color picked on the canvas
const zoneSetOptions = () => Object.entries(CHARSETS).map(([k, c]) => `<option value="${k}">${c.name}</option>`).join('') + `<option value="">${t('zoneCustom')}</option>`;
const setKeyOf = ramp => Object.keys(CHARSETS).find(k => CHARSETS[k].ramp === ramp) || '';
function renderZones() {
  const box = $('#zoneList'); if (!box) return;
  box.innerHTML = '';
  if (!state.zones.length) { box.innerHTML = `<p class="note">${t('zoneEmpty')}</p>`; return; }
  state.zones.forEach((z, k) => {
    const row = document.createElement('div'); row.className = 'zone'; row.dataset.z = k;
    row.innerHTML = `<button type="button" class="zsrc" title="${t('zonePickTitle')}" aria-label="${t('zonePickTitle')} ${k + 1}"></button>`
      + `<span class="zarrow" aria-hidden="true">→</span>`
      + `<input type="color" class="zink" aria-label="${t('zoneInk')} ${k + 1}">`
      + `<select class="zset" aria-label="${t('zoneSet')} ${k + 1}">${zoneSetOptions()}</select>`
      + `<label class="check" title="${t('zoneShow')}"><input type="checkbox" class="zon" aria-label="${t('zoneShow')} ${k + 1}"></label>`
      + `<button type="button" class="zdel" aria-label="${t('zoneDel')} ${k + 1}">×</button>`
      + `<input type="text" class="zramp" spellcheck="false" placeholder="a;b;c" aria-label="${t('zoneSet')} ${k + 1}">`;
    const q = s => row.querySelector(s);
    q('.zink').value = z.ink; q('.zset').value = setKeyOf(z.ramp); q('.zon').checked = z.on; q('.zramp').value = z.ramp;
    q('.zsrc').addEventListener('click', () => { pickTarget = pickTarget === k ? null : k; styleZones(); if (pickTarget !== null) toast(t('tZonePick')); });
    q('.zink').addEventListener('input', e => { z.ink = e.target.value; zoneEdited(); });
    q('.zon').addEventListener('change', e => { z.on = e.target.checked; zoneEdited(); });
    q('.zset').addEventListener('change', e => { if (e.target.value) { z.ramp = CHARSETS[e.target.value].ramp; q('.zramp').value = z.ramp; } zoneEdited(); });
    q('.zramp').addEventListener('input', e => { z.ramp = e.target.value || ' '; q('.zset').value = setKeyOf(z.ramp); zoneEdited(); });
    q('.zdel').addEventListener('click', () => { state.zones.splice(k, 1); pickTarget = null; renderZones(); zoneEdited(); });
    box.appendChild(row);
  });
  styleZones();
}
// zone edits change the picture but not the panel layout, so they skip syncUI (keeps typing focus)
function zoneEdited() { activePreset = null; dirty = true; styleZones(); document.querySelectorAll('.preset').forEach(b => b.classList.remove('on')); }
function styleZones() {
  document.querySelectorAll('.zone').forEach(row => {
    const z = state.zones[+row.dataset.z]; if (!z) return;
    row.classList.toggle('off', !z.on); row.classList.toggle('picking', pickTarget === +row.dataset.z);
    const src = row.querySelector('.zsrc'); src.style.background = z.src; src.title = `${t('zonePickTitle')} · ${z.src}${z.share ? ` · ${Math.round(z.share * 100)}%` : ''}`;
    const rp = row.querySelector('.zramp'); rp.style.background = state.bg; rp.style.color = z.ink;
  });
  frame.classList.toggle('picking', pickTarget !== null);
}
// click the output: pick a color for the armed zone, or add a new zone from that spot
out.addEventListener('click', e => {
  if (state.color !== 'zones' || !lastInfo) return;
  const r = out.getBoundingClientRect();
  const cx = Math.min(lastInfo.cols - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * lastInfo.cols)));
  const cy = Math.min(lastInfo.rows - 1, Math.max(0, Math.floor((e.clientY - r.top) / r.height * lastInfo.rows)));
  const p = sctx.getImageData(cx, cy, 1, 1).data; if (p[3] < 40) return;
  const col = GL.zoneToHex(p[0], p[1], p[2]);
  if (pickTarget !== null && state.zones[pickTarget]) { state.zones[pickTarget].src = col; pickTarget = null; toast(t('tZonePicked')); }
  else if (state.zones.length < GL.MAX_ZONES) {
    const k = state.zones.length;
    state.zones.push({ src: col, ink: col, on: true, ramp: CHARSETS[GL.ZONE_SETS[k % GL.ZONE_SETS.length]].ramp });
    toast(t('tZoneAdded'));
  } else { toast(t('tZoneFull')); return; }
  renderZones(); zoneEdited();
});
$('#zoneDetect').addEventListener('click', detectZones);
// which color each glyph of the main set gets, in the current color mode
function drawLegend() {
  const toks = GL.parseRamp(state.ramp).filter(Boolean), G = toks.length, n = state.inkN;
  const inks = state.inks.map(hex), bgc = hex(state.bg);
  const contrastInk = bgc[0] * .299 + bgc[1] * .587 + bgc[2] * .114 > 140 ? '#151515' : '#FFFFFF';
  const MAX = 16, box = $('#legend');
  box.style.background = state.bg;
  box.innerHTML = '';
  toks.slice(0, MAX).forEach((tok, j) => {
    let col;
    switch (state.color) {
      case 'mono': col = state.inks[0]; break;
      case 'palette': col = state.inks[inkIndex(j, G, n)]; break;
      case 'duotone': { const a = inks[0], z = inks[Math.min(1, n - 1)], f = G > 1 ? j / (G - 1) : 1; col = `rgb(${a.map((c, k) => Math.round(c + (z[k] - c) * f))})`; break; }
      default: col = contrastInk;
    }
    const sp = document.createElement('span'); sp.textContent = tok; sp.style.color = col; box.appendChild(sp);
  });
  if (G > MAX) { const sp = document.createElement('span'); sp.className = 'more'; sp.style.color = contrastInk; sp.textContent = `+${G - MAX}`; box.appendChild(sp); }
}
function changed(fromPreset) { if (!fromPreset) activePreset = null; dirty = true; syncUI(); }
document.querySelectorAll('[data-k]').forEach(el => {
  el.addEventListener('input', () => {
    const k = el.dataset.k;
    state[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
    if (k === 'ramp' && !state.ramp.length) state.ramp = ' ';
    if (k === 'zoneN') detectZones();
    changed();
  });
});
$('#seedBtn').addEventListener('click', () => { state.seed = (Math.random() * 1e6) | 0; dirty = true; });

// preset tiles with a small glyph swatch
const pbox = $('#presets');
for (const [id, p] of Object.entries(PRESETS)) {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'preset'; b.dataset.p = id;
  const c = document.createElement('canvas'); c.width = 120; c.height = 38;
  const x = c.getContext('2d'); x.fillStyle = p.bg; x.fillRect(0, 0, 120, 38);
  const inks = p.inks || DEFAULTS.inks, nI = p.color === 'palette' ? (p.inkN || 1) : 1;
  const chars = GL.parseRamp(p.ramp).filter(Boolean);
  x.font = `${p.bold ? 700 : 500} 11px ui-monospace, Menlo, monospace`; x.textBaseline = 'top';
  for (let r = 0; r < 3; r++) for (let k = 0; k < 17; k++) {
    x.fillStyle = p.color === 'source' ? ['#f2a541', '#3aa37a', '#e8615a', '#c8f0a8'][(k + r) % 4] : inks[(k + r) % nI];
    x.fillText(chars[(k * 7 + r * 3) % chars.length], 3 + k * 7, 3 + r * 11);
  }
  const sp = document.createElement('span');
  b.append(c, sp);
  b.addEventListener('click', () => applyPreset(id));
  pbox.appendChild(b);
}
function applyPreset(id) {
  // presets only change the look; the frame ratio and output width stay as the user set them
  const keep = { frame: state.frame, size: state.size, zones: state.zones, zoneN: state.zoneN, zoneTol: state.zoneTol };
  const { name, ...p } = PRESETS[id];
  state = withInks(clone({ ...DEFAULTS, ...p, ...keep }));
  activePreset = id; changed(true);
}

/* files */
$('#file').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
$('#sampleBtn').addEventListener('click', () => { useSample(); $('#hint').hidden = false; });
// cloud demo: a multi-color image that shows off the color zones mode
$('#cloudBtn').addEventListener('click', async () => {
  try {
    const res = await fetch('assets/cloud.jpg'); if (!res.ok) throw 0;
    const blob = await res.blob();
    // small bold cells so the swirls read; on the image's own off-white, darker = denser (invert)
    Object.assign(state, { color: 'zones', cell: 10, bold: true, invert: true, bg: '#F6F5F5', imgOpacity: 0, patch: false, label: '' }); changed();
    loadFile(new File([blob], 'cloud.jpg', { type: blob.type || 'image/jpeg' }));
  } catch (e) { toast(t('tNoCloud')); }
});
function updatePlayLabel() { if (source?.kind === 'video') $('#playBtn').textContent = source.el.paused ? t('play') : t('pause'); }
$('#playBtn').addEventListener('click', () => {
  if (source?.kind !== 'video') return;
  const v = source.el; if (v.paused) v.play(); else { v.pause(); dirty = true; }
  setTimeout(updatePlayLabel, 0);
});
const frame = $('#frame');
['dragenter', 'dragover'].forEach(ev => frame.addEventListener(ev, e => { e.preventDefault(); frame.classList.add('drag'); }));
['dragleave', 'drop'].forEach(ev => frame.addEventListener(ev, e => { e.preventDefault(); frame.classList.remove('drag'); }));
frame.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
window.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])][0]; if (f) loadFile(f); });

/* export — a normal download link, or the claude.ai "downloads" capability when hosted there */
let dl = null;
const inClaude = !!(window.claude && window.claude.use);
const dlReady = inClaude ? window.claude.use('downloads').then(x => (dl = x)).catch(() => null) : Promise.resolve(null);
async function saveBlob(blob, name) {
  if (inClaude) {
    await dlReady;
    if (!dl) { toast(t('tNoDownload')); return; }
    try { await dl.save({ filename: name, data: blob }); toast(`${t('tSaved')} ${name}`); }
    catch (e) { if (e && e.code !== 'declined') toast(`${t('tSaveFail')}: ${e.message || e.code}`); }
    return;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const fileBase = () => `glyphloom-${source?.name || 'out'}`;
$('#pngBtn').addEventListener('click', () => { render(performance.now()); out.toBlob(b => b && saveBlob(b, fileBase() + '.png'), 'image/png'); });

/* SVG export — glyphs become real <text> (shapes become <use> of a vector symbol),
 * grouped by color so the file stays editable in Figma / Illustrator. The source
 * image layer, if shown, is embedded as a PNG; grain becomes an SVG noise filter. */
const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const cssBlend = b => (b === 'source-over' ? 'normal' : b === 'lighter' ? 'plus-lighter' : b);
const FONT = `'Geist Mono', ui-monospace, Menlo, monospace`;
// canvas centers text on the em box ('middle'); SVG viewers disagree on
// dominant-baseline, so place text on its alphabetic baseline at the same spot
function baseDrop(weight, size) {
  octx.font = `${weight} ${size}px "Geist Mono", ui-monospace, Menlo, monospace`; octx.textBaseline = 'middle';
  return -octx.measureText('M').alphabeticBaseline || 0;
}
function buildSvg() {
  svgCells = [];
  try { render(performance.now()); } finally { var cells = svgCells; svgCells = null; }
  const { W, H, s, bcols, brows, blk, kinds } = lastInfo, f = v => +v.toFixed(2);
  const fs = f(s * state.fscale), weight = state.bold ? 700 : 500, maxW = s * 0.94;
  const drop = baseDrop(weight, fs);
  const defs = [], shapeIds = {}, groups = new Map();
  for (const [x, y, tok, rgb] of cells) {
    const col = '#' + rgb.toString(16).padStart(6, '0');
    if (!groups.has(col)) groups.set(col, []);
    let el;
    if (GL.SHAPES_SVG[tok]) {
      if (!shapeIds[tok]) { shapeIds[tok] = 's' + Object.keys(shapeIds).length; defs.push(`<symbol id="${shapeIds[tok]}" overflow="visible">${GL.SHAPES_SVG[tok](s, state.fscale)}</symbol>`); }
      el = `<use href="#${shapeIds[tok]}" x="${x * s}" y="${y * s}"/>`;
    } else {
      const fit = [...tok].length > 1 && octx.measureText(tok).width > maxW ? ` textLength="${f(maxW)}" lengthAdjust="spacingAndGlyphs"` : '';
      el = `<text x="${f(x * s + s / 2)}" y="${f(y * s + s / 2 + s * 0.05 + drop)}"${fit}>${esc(tok)}</text>`;
    }
    groups.get(col).push(el);
  }
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`];
  const needImg = state.imgOpacity > 0 || (state.patch && state.reveal > 0);
  if (needImg) defs.push(`<image id="src" width="${W}" height="${H}" preserveAspectRatio="none" href="${imgC.toDataURL('image/png')}"/>`);
  if (state.grain > 0) defs.push(`<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.1"/></filter>`);
  if (state.patch && state.reveal > 0) {
    const rects = [];
    for (let by = 0; by < brows; by++) for (let bx = 0; bx < bcols; bx++) if (kinds[by * bcols + bx] === 2) rects.push(`<rect x="${bx * blk * s}" y="${by * blk * s}" width="${blk * s}" height="${blk * s}"/>`);
    defs.push(`<clipPath id="reveal">${rects.join('')}</clipPath>`);
  }
  if (defs.length) o.push(`<defs>${defs.join('')}</defs>`);
  o.push(`<rect width="100%" height="100%" fill="${state.bg}"/>`);
  if (state.imgOpacity > 0) o.push(`<use href="#src" opacity="${state.imgOpacity}" style="mix-blend-mode:${cssBlend(state.imgBlend)}"/>`);
  o.push(`<g id="ascii" opacity="${state.inkOpacity}" style="mix-blend-mode:${cssBlend(state.blend)}" font-family="${FONT}" font-size="${fs}" font-weight="${weight}" text-anchor="middle">`);
  for (const [col, els] of groups) o.push(`<g fill="${col}" color="${col}">${els.join('')}</g>`);
  o.push('</g>');
  if (state.grain > 0) o.push(`<rect width="100%" height="100%" filter="url(#grain)" opacity="${state.grain}"/>`);
  if (state.patch && state.reveal > 0) o.push(`<use href="#src" clip-path="url(#reveal)"/>`);
  if (state.label) {
    const L = labelLayout(W, H), lab = esc(state.label), ld = baseDrop(L.weight, L.fs);
    if (L.box) o.push(`<rect x="${f(L.box[0])}" y="${f(L.box[1])}" width="${f(L.box[2])}" height="${f(L.box[3])}" fill="${L.boxFill}"/>`);
    const rot = L.vertical ? ` transform="rotate(-90 ${f(L.x)} ${f(L.y)})"` : '';
    o.push(`<text x="${f(L.x)}" y="${f(L.y + ld)}"${rot} font-family="${FONT}" font-size="${L.fs}" font-weight="${L.weight}" text-anchor="${L.vertical ? 'middle' : 'start'}" fill="${L.fill}">${lab}</text>`);
  }
  o.push('</svg>');
  return o.join('\n');
}
// Geist Mono subset to just the characters used, so the SVG looks the same
// wherever it is opened; offline the file simply falls back to a system mono
async function fontFaces(svg) {
  const chars = new Set();
  for (const m of svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) for (const c of m[1].replace(/&(amp|lt|gt|quot);/g, e => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"' })[e])) chars.add(c);
  if (!chars.size) return '';
  const weights = [...new Set([...svg.matchAll(/font-weight="(\d+)"/g)].map(m => m[1]))].sort().join(';');
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Geist+Mono:wght@${weights}&text=${encodeURIComponent([...chars].join(''))}`)).text();
    const faces = await Promise.all([...css.matchAll(/@font-face\s*{[^}]*}/g)].map(async ([face]) => {
      const url = face.match(/url\(([^)]+)\)/)[1], buf = await (await fetch(url)).blob();
      const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(buf); });
      return face.replace(url, data);
    }));
    return faces.length ? `<style>${faces.join('')}</style>` : '';
  } catch (e) { return ''; }
}
$('#svgBtn').addEventListener('click', async () => {
  if (!source) return;
  let svg = buildSvg();
  const style = await fontFaces(svg);
  if (style) svg = svg.replace('>\n', `>\n${style}\n`);
  saveBlob(new Blob([svg], { type: 'image/svg+xml' }), fileBase() + '.svg');
});

let rec = null, chunks = [];
function updateRecLabel() { $('#recBtn').textContent = recording ? t('recStop') : t('rec'); $('#recBtn').classList.toggle('on', recording); }
$('#recBtn').addEventListener('click', () => {
  if (recording) { rec.stop(); return; }
  if (!out.captureStream || !window.MediaRecorder) { toast(t('tNoRecord')); return; }
  const types = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'];
  const mime = types.find(m => MediaRecorder.isTypeSupported(m)) || '';
  try { rec = new MediaRecorder(out.captureStream(30), mime ? { mimeType: mime, videoBitsPerSecond: 12e6 } : undefined); }
  catch (e) { toast(t('tRecFail')); return; }
  chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    recording = false; updateRecLabel();
    const ext = /mp4/.test(rec.mimeType) ? 'mp4' : 'webm';
    saveBlob(new Blob(chunks, { type: rec.mimeType }), fileBase() + '.' + ext);
  };
  rec.start(); recording = true; updateRecLabel();
  if (source?.kind === 'video') { source.el.currentTime = 0; source.el.play(); }
});

let toastTimer;
function toast(m) { const el = $('#toast'); el.textContent = m; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2600); }

/* language */
document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => GL.setLang(b.dataset.lang)));
GL.onLangChange = () => { buildDynamicLabels(); syncUI(); };

/* boot */
GL.applyLang(); buildDynamicLabels(); syncUI(); useSample();
(document.fonts ? Promise.all([document.fonts.load('500 20px "Geist Mono"'), document.fonts.load('700 20px "Geist Mono"')]) : Promise.resolve())
  .finally(() => { for (const k in atlasCache) delete atlasCache[k]; dirty = true; });
requestAnimationFrame(loop);
})();
