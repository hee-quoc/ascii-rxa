/* Glyph Loom — color zones.
 * The source is split into a few dominant colors (k-means in Oklab). Every
 * cell then belongs to its nearest zone, and each zone has its own glyph set
 * and output color. Lightness counts for less than hue/chroma when matching,
 * so a cloud keeps one zone across its lit and shaded sides.
 */
window.GL = window.GL || {};

GL.MAX_ZONES = 8;
// default glyph set per zone, in detection order, so zones differ out of the box
GL.ZONE_SETS = ['classic', 'symbols', 'dots', 'slash', 'blocks', 'binary', 'hex', 'dense'];

(() => {
const W_L = 0.5;                 // weight of lightness against the a/b (hue) axes
const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const c = i / 255; LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

// sRGB bytes → weighted Oklab, written into out[o..o+2]
function lab(r, g, b, out, o) {
  r = LIN[r]; g = LIN[g]; b = LIN[b];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  out[o] = (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s) * W_L;
  out[o + 1] = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  out[o + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
}
const toHex = (r, g, b) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
const fromHex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* Find k dominant colors of a drawable. Returns zones sorted by area, each
 * { src, ink, ramp, on, share }. The zone that covers most of the image
 * border is switched off, since that is usually the background. */
GL.detectZones = (el, sw, sh, k) => {
  const S = 72, c = document.createElement('canvas');
  const r = Math.min(1, S / Math.max(sw, sh)), w = Math.max(1, Math.round(sw * r)), h = Math.max(1, Math.round(sh * r));
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(el, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const px = [], rgb = [], border = [];
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    const i = (y * w + xx) * 4; if (d[i + 3] < 40) continue;
    const o = px.length; px.length += 3; lab(d[i], d[i + 1], d[i + 2], px, o);
    rgb.push(d[i], d[i + 1], d[i + 2]); border.push(xx === 0 || y === 0 || xx === w - 1 || y === h - 1);
  }
  const N = px.length / 3; if (!N) return [];
  k = Math.max(1, Math.min(k, N));
  // k-means++ seeding, fixed seed so the same image always gives the same zones
  const rand = rng(1234), cen = [], dist = new Float32Array(N).fill(Infinity);
  let pick = Math.floor(rand() * N);
  for (let j = 0; j < k; j++) {
    cen.push(px[pick * 3], px[pick * 3 + 1], px[pick * 3 + 2]);
    let sum = 0;
    for (let p = 0; p < N; p++) {
      const a = px[p * 3] - cen[j * 3], b = px[p * 3 + 1] - cen[j * 3 + 1], e = px[p * 3 + 2] - cen[j * 3 + 2];
      dist[p] = Math.min(dist[p], a * a + b * b + e * e); sum += dist[p];
    }
    let t = rand() * sum; pick = 0;
    for (let p = 0; p < N; p++) { t -= dist[p]; if (t <= 0) { pick = p; break; } }
  }
  const asg = new Uint8Array(N);
  for (let it = 0; it < 14; it++) {
    const acc = new Float64Array(k * 4);
    for (let p = 0; p < N; p++) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < k; j++) {
        const a = px[p * 3] - cen[j * 3], b = px[p * 3 + 1] - cen[j * 3 + 1], e = px[p * 3 + 2] - cen[j * 3 + 2], dd = a * a + b * b + e * e;
        if (dd < bd) { bd = dd; best = j; }
      }
      asg[p] = best; acc[best * 4] += px[p * 3]; acc[best * 4 + 1] += px[p * 3 + 1]; acc[best * 4 + 2] += px[p * 3 + 2]; acc[best * 4 + 3]++;
    }
    for (let j = 0; j < k; j++) if (acc[j * 4 + 3]) for (let q = 0; q < 3; q++) cen[j * 3 + q] = acc[j * 4 + q] / acc[j * 4 + 3];
  }
  // average sRGB per cluster for display, plus area and border coverage
  const st = Array.from({ length: k }, () => ({ r: 0, g: 0, b: 0, n: 0, edge: 0 }));
  let edges = 0;
  for (let p = 0; p < N; p++) {
    const z = st[asg[p]]; z.r += rgb[p * 3]; z.g += rgb[p * 3 + 1]; z.b += rgb[p * 3 + 2]; z.n++;
    if (border[p]) { z.edge++; edges++; }
  }
  const zones = st.filter(z => z.n).sort((a, b) => b.n - a.n).map(z => {
    const src = toHex(z.r / z.n, z.g / z.n, z.b / z.n);
    return { src, ink: src, on: true, share: z.n / N, edge: edges ? z.edge / edges : 0 };
  });
  const bg = zones.reduce((a, b) => (b.edge > a.edge ? b : a), zones[0]);
  if (zones.length > 1 && bg.edge > 0.6) bg.on = false;
  zones.forEach((z, j) => { z.ramp = GL.CHARSETS[GL.ZONE_SETS[j % GL.ZONE_SETS.length]].ramp; delete z.edge; });
  return zones;
};

/* Returns f(r, g, b) → index of the nearest zone, or -1 when it is further
 * than the tolerance allows (tol 1 = every pixel joins its nearest zone). */
GL.zoneMatcher = (zones, tol) => {
  const n = zones.length, c = new Float32Array(n * 3), p = new Float32Array(3);
  zones.forEach((z, j) => { const [r, g, b] = fromHex(z.src); lab(r, g, b, c, j * 3); });
  const max = tol >= 1 ? Infinity : (tol * 0.35) ** 2;
  return (r, g, b) => {
    lab(r, g, b, p, 0);
    let best = -1, bd = Infinity;
    for (let j = 0; j < n; j++) {
      const a = p[0] - c[j * 3], e = p[1] - c[j * 3 + 1], f = p[2] - c[j * 3 + 2], dd = a * a + e * e + f * f;
      if (dd < bd) { bd = dd; best = j; }
    }
    return bd <= max ? best : -1;
  };
};
GL.zoneToHex = toHex;
})();
