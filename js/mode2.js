/* Glyph Loom · Author: Hy Nguyen */
/* Glyph Loom — mode 2: the cloud demo with a row of ASCII looks to switch between
 * (test mode, self-contained). A look is a full style, like a preset; switching keeps
 * the frame, the output size and the color zones found in the image. Looks can be
 * stepped through by hand or played one after another.
 * Removing the <script> tag for this file hides mode 2 completely.
 */
window.GL = window.GL || {};

(() => {
const C = GL.CHARSETS;
// on the cloud's off-white ground, darker = denser (invert) unless noted
const LOOKS = [
  { id: 'zones', name: { vi: 'Vùng màu', en: 'Color zones' },
    set: { ramp: C.classic.ramp, cell: 10, bold: true, color: 'zones', invert: true, bg: '#F6F5F5', contrast: 1.2 } },
  { id: 'lagoon', name: { vi: 'Lagoon', en: 'Lagoon' },
    set: { ramp: C.classic.ramp, cell: 10, bold: true, color: 'palette', bg: '#F4FAFB', inks: ['#1A93AE', '#2F6FE0', '#1A20D8', '#0B1690'], inkN: 4, invert: true, contrast: 1.3, cut: 0.06 } },
  { id: 'ink', name: { vi: 'Mực tàu', en: 'Ink' },
    set: { ramp: C.dense.ramp, cell: 8, color: 'mono', bg: '#F1ECE2', inks: ['#1E1A17'], invert: true, contrast: 1.3 } },
  { id: 'blocks', name: { vi: 'Khối màu', en: 'Blocks' },
    set: { ramp: C.blocks.ramp, cell: 12, color: 'source', sat: 1.3, bg: '#F6F5F5', invert: true, contrast: 1.2 } },
  { id: 'dots', name: { vi: 'Chấm in', en: 'Halftone' },
    set: { ramp: C.dots.ramp, cell: 12, bold: true, color: 'mono', bg: '#FBF3EC', inks: ['#C8322B'], invert: true, contrast: 1.4 } },
  // dark ground: inks run dark → light, the brightest on the densest glyphs
  { id: 'gold', name: { vi: 'Kim tuyến', en: 'Gold thread' },
    set: { ramp: C.symbols.ramp, cell: 11, bold: true, color: 'palette', bg: '#2A120A', inks: ['#8A4A1C', '#C98C1E', '#E6B23A', '#F4D266'], inkN: 4, invert: true, contrast: 1.3 } },
  { id: 'tiles', name: { vi: 'Ô nền', en: 'Tiles' },
    set: { ramp: C.classic.ramp, cell: 12, bold: true, color: 'mono', bg: '#F6F5F5', inks: ['#FFFFFF'], cellBg: true, cellBgColor: '#C8322B', invert: true, contrast: 1.3 } },
  { id: 'neon', name: { vi: 'Đêm', en: 'Night' },
    set: { ramp: C.binary.ramp, cell: 10, color: 'source', sat: 1.8, bg: '#08080A', invert: true, contrast: 1.3 } },
];

let api = null, cur = 0, timer = null, playing = false, every = 2.5, sec = null;

Object.assign(GL.STRINGS.vi, { m2Looks: 'Kiểu ASCII', m2Prev: '← Trước', m2Next: 'Sau →', m2Play: 'Tự đổi kiểu', m2Every: 'Mỗi (giây)' });
Object.assign(GL.STRINGS.en, { m2Looks: 'ASCII looks', m2Prev: '← Prev', m2Next: 'Next →', m2Play: 'Cycle looks', m2Every: 'Every (s)' });

function show(i) {
  cur = (i + LOOKS.length) % LOOKS.length;
  api.apply(LOOKS[cur].set);
  sec.querySelectorAll('[data-look]').forEach(b => b.classList.toggle('on', +b.dataset.look === cur));
}
// cycling only switches while the mode 2 panel is showing
function schedule() {
  clearInterval(timer); timer = null;
  if (playing) timer = setInterval(() => { if (!sec.hidden) show(cur + 1); }, every * 1000);
}

// builds the mode 2 panel at the top of the rail; host.apply(look) restyles, host.open(look) loads the cloud
function mount(rail, host) {
  api = host;
  sec = document.createElement('section');
  sec.hidden = true;
  sec.innerHTML = `<h2>Mode 2 · <span data-i18n="m2Looks"></span></h2>
    <div class="m2-looks">${LOOKS.map((l, i) => `<button type="button" data-look="${i}" data-m2name="${i}"></button>`).join('')}</div>
    <div class="two"><button type="button" data-step="-1" data-i18n="m2Prev"></button><button type="button" data-step="1" data-i18n="m2Next"></button></div>
    <label class="check"><input type="checkbox" data-m2play> <span data-i18n="m2Play"></span></label>
    <div class="row"><label data-i18n="m2Every"></label><input type="range" min="0.5" max="8" step="0.5" value="${every}" data-m2every><output>${every}</output></div>`;
  sec.querySelectorAll('[data-look]').forEach(b => b.addEventListener('click', () => show(+b.dataset.look)));
  sec.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { show(cur + +b.dataset.step); schedule(); }));
  sec.querySelector('[data-m2play]').addEventListener('input', e => { playing = e.target.checked; schedule(); });
  const ev = sec.querySelector('[data-m2every]');
  ev.addEventListener('input', () => { every = +ev.value; ev.nextElementSibling.textContent = ev.value; schedule(); });
  rail.prepend(sec);
  GL.mode2.panel = sec;
  relabel();
}
function relabel() { sec?.querySelectorAll('[data-m2name]').forEach(b => { const n = LOOKS[+b.dataset.m2name].name; b.textContent = n[GL.lang] || n.en; }); }

GL.mode2 = {
  src: 'assets/cloud.jpg', panel: null, mount, relabel,
  start() { api.open(LOOKS[cur].set); },
  // the cloud is open: mark the current look
  opened() { sec.querySelectorAll('[data-look]').forEach(b => b.classList.toggle('on', +b.dataset.look === cur)); },
};
})();
