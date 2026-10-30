/* Glyph Loom — character sets, defaults and presets.
 *
 * Palette mode maps brightness to glyph colors in order: inks[0] = darkest
 * areas … inks[inkN-1] = brightest areas, so list inks from low to high
 * luminance. Contrast ratios (WCAG) of each glyph color on its background
 * are noted beside every preset.
 */
window.GL = window.GL || {};

GL.CHARSETS = {
  classic: { ramp: ' .:-=+*#%@', name: 'Classic' },
  dense:   { ramp: " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$", name: 'Dense' },
  blocks:  { ramp: ' ░▒▓█', name: 'Blocks' },
  binary:  { ramp: ' 01', name: 'Binary' },
  symbols: { ramp: ' ·+×*#', name: 'Symbols' },
  dots:    { ramp: ' ·∙•●', name: 'Dots' },
  slash:   { ramp: ' .-/\\X', name: 'Slash' },
  hex:     { ramp: ' 123456789ABCDEF', name: 'Hex' },
  bars:    { ramp: ' ─╸━', name: 'Bars' },
  shapes:  { ramp: ' ▪✕■●', name: 'Shapes' },
};

/* A ramp is either a plain string (one glyph per character) or a list split
 * by ';' where each entry can be a character, an emoji or a short word:
 * 'a;b;c;d' or 'AI;·;LOVE'. Entries run from dark/sparse to bright/dense and
 * an empty entry is a blank level. Without any blank level one is added in
 * front, so the background stays clear like the built-in sets. */
GL.parseRamp = str => {
  const toks = str.includes(';') ? str.split(';').map(s => s.trim()) : [...str].map(c => c.trim());
  if (!toks.some(t => !t)) toks.unshift('');
  return toks;
};

/* Glyphs drawn as geometry instead of font text, so they fill the cell
 * edge to edge and line up into continuous bars / halftone dots.
 * Each gets the atlas context, the cell's left/top, cell size and glyph scale. */
GL.SHAPES = {
  '─': (x, l, t, s, k) => { const h = s * 0.16 * k; x.fillRect(l, t + (s - h) / 2, s, h); },
  '╸': (x, l, t, s, k) => { const h = s * 0.58 * k; x.fillRect(l, t + (s - h) / 2, s * 0.55, h); },
  '━': (x, l, t, s, k) => { const h = s * 0.58 * k; x.fillRect(l, t + (s - h) / 2, s, h); },
  '▪': (x, l, t, s, k) => { const w = s * 0.34 * k; x.fillRect(l + (s - w) / 2, t + (s - w) / 2, w, w); },
  '■': (x, l, t, s, k) => { const w = s * 0.78 * k; x.fillRect(l + (s - w) / 2, t + (s - w) / 2, w, w); },
  '●': (x, l, t, s, k) => { x.beginPath(); x.arc(l + s / 2, t + s / 2, s * 0.5 * k, 0, Math.PI * 2); x.fill(); },
  '✕': (x, l, t, s, k) => {
    const a = s * 0.36 * k, c = [l + s / 2, t + s / 2];
    x.save(); x.strokeStyle = '#fff'; x.lineWidth = s * 0.2 * k; x.lineCap = 'square'; x.beginPath();
    x.moveTo(c[0] - a, c[1] - a); x.lineTo(c[0] + a, c[1] + a); x.moveTo(c[0] + a, c[1] - a); x.lineTo(c[0] - a, c[1] + a);
    x.stroke(); x.restore();
  },
};

GL.MAX_INKS = 8;

GL.DEFAULTS = {
  ramp: GL.CHARSETS.classic.ramp, cell: 12, fscale: 1.05, bold: false,
  bright: 0, contrast: 1.2, gamma: 1, cut: 0, invert: false,
  color: 'mono', bg: '#0A0A0A', inks: ['#FFFFFF', '#BBBBBB', '#888888', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'], inkN: 1, sat: 1.2,
  imgOpacity: 0, imgBlend: 'source-over', blend: 'source-over', inkOpacity: 1, imgGray: true,
  patch: false, block: 6, reveal: 0, alt: 0.3, flip: 0, altSet: 'dots', seed: 7,
  flicker: 0, grain: 0, label: '', labelPos: 'c', frame: 'source', size: '1080',
};

GL.PRESETS = {
  // white 4.43:1
  rose: { name: { vi: 'Rose', en: 'Rose' },
    ramp: GL.CHARSETS.symbols.ramp, cell: 13, bold: true, color: 'mono', bg: '#DB2C8A',
    inks: ['#FFFFFF', '#FFC4E3', '#FFFFFF', '#FFFFFF'], contrast: 1.35,
    patch: true, block: 6, alt: 0.35, altSet: 'blocks', flip: 0.1 },
  // violet 3.36 · coral 5.08 · amber 8.27 · cream 14.39
  loong: { name: { vi: 'Loong', en: 'Loong' },
    ramp: GL.CHARSETS.classic.ramp, cell: 15, bold: true, color: 'palette', bg: '#1C1838',
    inks: ['#6A62C4', '#E8615A', '#F2A541', '#F7EBD5'], inkN: 4, contrast: 1.3, cut: 0.08,
    label: 'LOONG_', labelPos: 'bl' },
  // amber 10.86
  amber: { name: { vi: 'Amber', en: 'Amber' },
    ramp: GL.CHARSETS.dense.ramp, cell: 9, color: 'mono', bg: '#120D06',
    inks: ['#FFB347', '#FFB347', '#FFB347', '#FFB347'], contrast: 1.25, flicker: 0.03 },
  // colors come from the source
  chroma: { name: { vi: 'Chroma', en: 'Chroma' },
    ramp: GL.CHARSETS.dense.ramp, cell: 10, bold: true, color: 'source', sat: 1.6, bg: '#050505', contrast: 1.15 },
  // navy 7.42 · blue 4.44
  reseau: { name: { vi: 'Réseau', en: 'Réseau' },
    ramp: GL.CHARSETS.slash.ramp, cell: 12, bold: true, color: 'palette', bg: '#5EE68A',
    inks: ['#1B2A8F', '#2E46D6', '#1B2A8F', '#1B2A8F'], inkN: 2, contrast: 1.4, cut: 0.25,
    patch: true, block: 5, alt: 0.35, altSet: 'dots' },
  // orange 5.57 · sky 8.50 · grey 9.74 · yellow 11.54
  strata: { name: { vi: 'Strata', en: 'Strata' },
    ramp: GL.CHARSETS.binary.ramp, cell: 11, bold: true, color: 'palette', bg: '#0D1022',
    inks: ['#E8613C', '#5BB8E8', '#B8BAC4', '#F5C443'], inkN: 4, contrast: 1.3,
    patch: true, block: 4, alt: 0.3, altSet: 'symbols' },
  // white 21:1 over the full-colour source image
  layered: { name: { vi: 'Lồng ảnh', en: 'Layered' },
    ramp: GL.CHARSETS.classic.ramp, cell: 11, bold: true, color: 'mono', bg: '#000000',
    inks: ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'], imgOpacity: 0.85, imgGray: false,
    blend: 'screen', inkOpacity: 0.9, contrast: 1.3 },
  // ink 15.59
  paper: { name: { vi: 'Paper', en: 'Paper' },
    ramp: GL.CHARSETS.dense.ramp, cell: 9, color: 'mono', bg: '#EFEDE6',
    inks: ['#151515', '#151515', '#151515', '#151515'], invert: true, contrast: 1.2 },
  // graphite 12.59 — plain keyboard ASCII on cream
  linen: { name: { vi: 'Linen', en: 'Linen' },
    ramp: ' -=+#', cell: 9, color: 'mono', bg: '#F2F0E9',
    inks: ['#2A2A2A', '#2A2A2A', '#2A2A2A', '#2A2A2A'], contrast: 1.5, cut: 0.12 },
  // black 14.67 — horizontal scan bars over a grainy grey
  scan: { name: { vi: 'Scan', en: 'Scan' },
    ramp: GL.CHARSETS.bars.ramp, cell: 8, color: 'mono', bg: '#E3E3DF',
    inks: ['#111111', '#111111', '#111111', '#111111'], contrast: 1.6, cut: 0.1, grain: 0.18 },
  // green 6.85 — halftone dots, squares and crosses
  moss: { name: { vi: 'Moss', en: 'Moss' },
    ramp: GL.CHARSETS.shapes.ramp, cell: 18, color: 'mono', bg: '#EDEDE8',
    inks: ['#1E5A47', '#1E5A47', '#1E5A47', '#1E5A47'], contrast: 1.5, cut: 0.1, grain: 0.08,
    label: '2025', labelPos: 'vl' },
};

GL.DEFAULT_PRESET = 'loong';
