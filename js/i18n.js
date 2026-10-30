/* Glyph Loom — UI strings (Tiếng Việt / English) */
window.GL = window.GL || {};

GL.STRINGS = {
  vi: {
    hint: 'Kéo thả ảnh / SVG / MP4 vào đây · hoặc dán (Ctrl+V)',
    upload: 'Tải file lên', demo: 'Rồng demo',
    pause: 'Tạm dừng video', play: 'Phát video',
    png: 'Xuất PNG', rec: '● Quay video', recStop: '■ Dừng & lưu',
    sPresets: 'Biến thể', sCharset: 'Bộ ký tự', sTone: 'Tone', sColor: 'Màu',
    sLayer: 'Lồng ảnh gốc', sMotion: 'Chuyển động & chữ',
    custom: 'Tự nhập',
    rampHint: 'Ngăn cách bằng ; (vd: a;b;c;d hoặc AI;·;LOVE). Trái → phải = vùng tối → vùng sáng; màu theo đúng thứ tự đó.', cell: 'Cỡ ô', fscale: 'Cỡ chữ', bold: 'Chữ đậm',
    bright: 'Độ sáng', contrast: 'Tương phản', gamma: 'Gamma', cut: 'Cắt vùng tối', invert: 'Đảo sáng / tối',
    bg: 'Nền', inks: 'Màu chữ', inkN: 'Số màu', sat: 'Độ bão hoà', grain: 'Hạt nhiễu',
    cMono: 'Mono', cPalette: 'Palette', cDuo: 'Duo', cSource: 'Ảnh', cZones: 'Vùng',
    zoneNote: 'App tự tìm các dải màu chính trong ảnh. Mỗi vùng có bộ ký tự và màu xuất riêng; độ sáng chọn ký tự thưa hay dày trong vùng đó. Bấm ô màu gốc rồi bấm vào ảnh để chọn lại màu, hoặc bấm thẳng vào ảnh để thêm vùng.',
    zoneN: 'Số vùng', zoneTol: 'Độ rộng vùng', zoneRedetect: 'Tìm lại màu (xoá chỉnh sửa vùng)',
    zoneCustom: 'tự nhập', zonePickTitle: 'Màu gốc — bấm rồi chọn trên ảnh', zoneInk: 'Màu xuất vùng', zoneSet: 'Bộ ký tự vùng',
    zoneShow: 'Hiện vùng', zoneDel: 'Xoá vùng', zoneEmpty: 'Chưa có vùng nào — bấm vào ảnh để thêm.',
    tZonePick: 'Bấm vào ảnh để chọn màu cho vùng này', tZonePicked: 'Đã đổi màu gốc của vùng', tZoneAdded: 'Đã thêm vùng màu mới', tZoneFull: 'Tối đa 8 vùng — xoá bớt một vùng trước',
    imgOpacity: 'Ảnh dưới', imgGray: 'Ảnh đen trắng',
    imgNormal: 'ảnh: normal', imgMultiply: 'ảnh: multiply', imgScreen: 'ảnh: screen', imgLuminosity: 'ảnh: luminosity', imgOverlay: 'ảnh: overlay',
    on: 'bật', alt: 'Bộ chữ 2', flip: 'Đảo block', reveal: 'Lộ ảnh', shuffle: 'Xáo block', set2: 'bộ 2',
    pos: 'Vị trí', posC: 'giữa', posBL: 'dưới trái', posTL: 'trên trái', posBR: 'dưới phải', posVL: 'dọc bên trái',
    frameSource: 'tỉ lệ gốc',
    chars: 'ký tự', kindSample: 'rồng demo', kindImage: 'ảnh', kindVideo: 'video',
    tUnsupported: 'File này chưa hỗ trợ — dùng ảnh, SVG hoặc video',
    tBadVideo: 'Trình duyệt không đọc được video này — thử MP4 (H.264) hoặc WebM',
    tBadImage: 'Không đọc được ảnh này',
    tNoDownload: 'Trang này chưa cho phép tải file',
    tSaved: 'Đã lưu', tSaveFail: 'Không lưu được',
    tNoRecord: 'Trình duyệt này không quay được canvas', tRecFail: 'Không bắt đầu quay được',
    inkLabel: 'Màu chữ',
  },
  en: {
    hint: 'Drop an image / SVG / MP4 here · or paste (Ctrl+V)',
    upload: 'Upload file', demo: 'Dragon demo',
    pause: 'Pause video', play: 'Play video',
    png: 'Export PNG', rec: '● Record', recStop: '■ Stop & save',
    sPresets: 'Presets', sCharset: 'Character set', sTone: 'Tone', sColor: 'Color',
    sLayer: 'Source layer', sMotion: 'Motion & label',
    custom: 'Custom',
    rampHint: 'Separate with ; (e.g. a;b;c;d or AI;·;LOVE). Left → right = dark → bright areas; colors follow the same order.', cell: 'Cell size', fscale: 'Glyph size', bold: 'Bold glyphs',
    bright: 'Brightness', contrast: 'Contrast', gamma: 'Gamma', cut: 'Cut darks', invert: 'Invert light / dark',
    bg: 'Background', inks: 'Glyph colors', inkN: 'Colors', sat: 'Saturation', grain: 'Grain',
    cMono: 'Mono', cPalette: 'Palette', cDuo: 'Duo', cSource: 'Source', cZones: 'Zones',
    zoneNote: 'The main colors of the image are found automatically. Each zone has its own glyph set and output color; brightness picks sparse or dense glyphs inside it. Click a source swatch then the image to re-pick its color, or click the image directly to add a zone.',
    zoneN: 'Zones', zoneTol: 'Zone reach', zoneRedetect: 'Re-detect colors (resets zone edits)',
    zoneCustom: 'custom', zonePickTitle: 'Source color — click, then pick on the image', zoneInk: 'Zone output color', zoneSet: 'Zone glyph set',
    zoneShow: 'Show zone', zoneDel: 'Remove zone', zoneEmpty: 'No zones yet — click the image to add one.',
    tZonePick: 'Click the image to pick this zone’s color', tZonePicked: 'Zone source color updated', tZoneAdded: 'New color zone added', tZoneFull: 'Up to 8 zones — remove one first',
    imgOpacity: 'Image', imgGray: 'Grayscale image',
    imgNormal: 'image: normal', imgMultiply: 'image: multiply', imgScreen: 'image: screen', imgLuminosity: 'image: luminosity', imgOverlay: 'image: overlay',
    on: 'on', alt: 'Set 2', flip: 'Flip blocks', reveal: 'Reveal image', shuffle: 'Shuffle', set2: 'set 2',
    pos: 'Position', posC: 'center', posBL: 'bottom left', posTL: 'top left', posBR: 'bottom right', posVL: 'vertical left',
    frameSource: 'source ratio',
    chars: 'chars', kindSample: 'dragon demo', kindImage: 'image', kindVideo: 'video',
    tUnsupported: 'Unsupported file — use an image, SVG or video',
    tBadVideo: 'This browser can’t read that video — try MP4 (H.264) or WebM',
    tBadImage: 'Couldn’t read that image',
    tNoDownload: 'Downloads aren’t allowed on this page',
    tSaved: 'Saved', tSaveFail: 'Couldn’t save',
    tNoRecord: 'This browser can’t record the canvas', tRecFail: 'Couldn’t start recording',
    inkLabel: 'Glyph color',
  },
};

GL.lang = (() => {
  try { const s = localStorage.getItem('glyphloom.lang'); if (s === 'vi' || s === 'en') return s; } catch (e) {}
  return /^vi\b/i.test(navigator.language || '') ? 'vi' : 'en';
})();

GL.t = key => (GL.STRINGS[GL.lang] && GL.STRINGS[GL.lang][key]) ?? GL.STRINGS.en[key] ?? key;

GL.applyLang = () => {
  document.documentElement.lang = GL.lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = GL.t(el.dataset.i18n); });
  document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === GL.lang));
};

GL.setLang = lang => {
  GL.lang = lang;
  try { localStorage.setItem('glyphloom.lang', lang); } catch (e) {}
  GL.applyLang();
  if (GL.onLangChange) GL.onLangChange();
};
