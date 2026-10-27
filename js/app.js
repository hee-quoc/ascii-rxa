/* Glyph Loom — engine + UI.
 * Pipeline per frame:
 *   source → sampled to a cols×rows grid → brightness picks a glyph from the
 *   ramp → glyphs stamped (white) into a mask from a pre-rendered atlas →
 *   a per-cell color grid is scaled up and clipped by that mask → composited
 *   over the background and the optional source-image layer.
 */
(() => {
const { CHARSETS, DEFAULTS, PRESETS, t } = GL;
const $ = s => document.querySelector(s);
const clone = o => JSON.parse(JSON.stringify(o));

let state = clone({ ...DEFAULTS, ...PRESETS[GL.DEFAULT_PRESET] });
let activePreset = GL.DEFAULT_PRESET;

/* ---------- sources ---------- */
let source = null;               // { kind: 'sample' | 'image' | 'video', el, name }
const dragonCanvas = document.createElement('canvas');
dragonCanvas.width = 1000; dragonCanvas.height = 1000;

function useSample() {
  clearVideo(); source = { kind: 'sample', el: dragonCanvas, name: 'dragon' };
  $('#playBtn').hidden = true; dirty = true;
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
      source = { kind: 'video', el: v, name: base }; v.play().catch(() => {});
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
      source = { kind: 'image', el, name: base }; $('#playBtn').hidden = true; dirty = true;
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
  const chars = [...ramp], s = state.cell, L = Math.max(1, chars.length);
  const key = [ramp, s, state.fscale, state.bold].join('|');
  if (atlasCache[name] && atlasCache[name].key === key) return atlasCache[name];
  const c = document.createElement('canvas'); c.width = s * L; c.height = s;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `${state.bold ? 700 : 500} ${s * state.fscale}px "Geist Mono", ui-monospace, Menlo, monospace`;
  const empty = [];
  for (let i = 0; i < L; i++) {
    const ch = chars[i] || ' ';
    empty[i] = !ch.trim();
    if (!empty[i]) { x.save(); x.beginPath(); x.rect(i * s, 0, s, s); x.clip(); x.fillText(ch, i * s + s / 2, s / 2 + s * 0.05); x.restore(); }
  }
  return atlasCache[name] = { key, c, L, empty };
}

/* ---------- render ---------- */
const out = $('#out'), octx = out.getContext('2d');
const sampC = document.createElement('canvas'), sctx = sampC.getContext('2d', { willReadFrequently: true });
const colC = document.createElement('canvas'), cctx = colC.getContext('2d');
const maskC = document.createElement('canvas'), mctx = maskC.getContext('2d');
const inkC = document.createElement('canvas'), ictx = inkC.getContext('2d');
const imgC = document.createElement('canvas'), gctx = imgC.getContext('2d');
let dirty = true;
const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function hash(x, y, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function setSize(c, w, h) { if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } }
let lastInfo = null;

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
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    let v = (lum - 0.5) * contrast + 0.5 + bright;
    v = v < 0 ? 0 : v > 1 ? 1 : v; v = Math.pow(v, gamma);
    if (invert) v = 1 - v;
    if (kind === 3) v = 1 - v;
    if (v < cut) continue;
    const at = kind === 1 ? alt : main;
    let lev = Math.round(v * (at.L - 1));
    if (flicker && Math.random() < flicker) lev = Math.max(0, Math.min(at.L - 1, lev + (Math.random() < .5 ? -1 : 1)));
    if (at.empty[lev]) continue;
    mctx.drawImage(at.c, lev * s, 0, s, s, x * s, y * s, s, s);
    let cr, cg, cb;
    switch (state.color) {
      case 'mono': [cr, cg, cb] = inks[0]; break;
      case 'palette': [cr, cg, cb] = inks[Math.min(n - 1, Math.floor(v * n))]; break;
      case 'duotone': { const a = inks[0], z = inks[Math.min(1, n - 1)]; cr = a[0] + (z[0] - a[0]) * v; cg = a[1] + (z[1] - a[1]) * v; cb = a[2] + (z[2] - a[2]) * v; break; }
      default: { const l = lum * 255; cr = l + (r - l) * sat; cg = l + (g - l) * sat; cb = l + (b - l) * sat; }
    }
    cdd[i] = cr; cdd[i + 1] = cg; cdd[i + 2] = cb; cdd[i + 3] = 255;
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
  if (state.patch && state.reveal > 0) {
    octx.save(); octx.beginPath();
    for (let by = 0; by < brows; by++) for (let bx = 0; bx < bcols; bx++) if (kinds[by * bcols + bx] === 2) octx.rect(bx * blk * s, by * blk * s, blk * s, blk * s);
    octx.clip(); octx.drawImage(imgC, 0, 0); octx.restore();
  }
  if (state.label) drawLabel(W, H);
  lastInfo = { cols, rows, W, H }; updateMeta();
}
function updateMeta() {
  if (!lastInfo || !source) return;
  const kind = { sample: t('kindSample'), image: t('kindImage'), video: t('kindVideo') }[source.kind];
  $('#meta').textContent = `${lastInfo.cols} × ${lastInfo.rows} ${t('chars')} · ${lastInfo.W} × ${lastInfo.H} px · ${kind}`;
}
function drawLabel(W, H) {
  const fs = Math.round(W * 0.052), padX = fs * 0.45, padY = fs * 0.3;
  octx.font = `500 ${fs}px "Geist Mono", ui-monospace, monospace`;
  octx.textBaseline = 'middle';
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
  const light = list[list.length - 1], bgc = hex(state.bg);
  const lightIsLighter = light[0] + light[1] + light[2] > bgc[0] + bgc[1] + bgc[2];
  octx.fillStyle = lightIsLighter ? `rgb(${light})` : state.bg; octx.fillRect(x, y, bw, bh);
  octx.fillStyle = lightIsLighter ? state.bg : `rgb(${light})`;
  octx.fillText(state.label, x + padX, y + bh / 2 + fs * 0.04);
}

let recording = false;
function loop(time) {
  const animated = (source && (source.kind === 'sample' || (source.kind === 'video' && !source.el.paused))) || state.flicker > 0 || recording;
  if (dirty || animated) { dirty = false; render(time); }
  requestAnimationFrame(loop);
}

/* ---------- UI ---------- */
const INT_KEYS = ['cell', 'inkN', 'block'];
const PCT_KEYS = ['cut', 'imgOpacity', 'inkOpacity', 'reveal', 'alt', 'flip', 'flicker'];
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
  buildSeg('color', [['mono', () => t('cMono')], ['palette', () => t('cPalette')], ['duotone', () => t('cDuo')], ['source', () => t('cSource')]], v => state.color = v);
  $('#altSet').innerHTML = Object.entries(CHARSETS).map(([k, c]) => `<option value="${k}">${t('set2')}: ${c.name}</option>`).join('');
  document.querySelectorAll('.preset span').forEach(sp => sp.textContent = PRESETS[sp.parentNode.dataset.p].name[GL.lang]);
  document.querySelectorAll('#inks input').forEach((c, i) => c.setAttribute('aria-label', `${t('inkLabel')} ${i + 1}`));
  updatePlayLabel(); updateRecLabel(); updateMeta();
}
const inkBox = $('#inks');
for (let i = 0; i < 4; i++) {
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
}
function changed(fromPreset) { if (!fromPreset) activePreset = null; dirty = true; syncUI(); }
document.querySelectorAll('[data-k]').forEach(el => {
  el.addEventListener('input', () => {
    const k = el.dataset.k;
    state[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value;
    if (k === 'ramp' && !state.ramp.length) state.ramp = ' ';
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
  const chars = [...p.ramp].filter(ch => ch.trim());
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
  const keep = { frame: state.frame, size: state.size };
  const { name, ...p } = PRESETS[id];
  state = clone({ ...DEFAULTS, ...p });
  if (!p.frame) state.frame = keep.frame;
  state.size = keep.size;
  activePreset = id; changed(true);
}

/* files */
$('#file').addEventListener('change', e => { loadFile(e.target.files[0]); e.target.value = ''; });
$('#sampleBtn').addEventListener('click', () => { useSample(); $('#hint').hidden = false; });
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
