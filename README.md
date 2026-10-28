# Glyph Loom

Hệ thống ASCII generative chạy hoàn toàn trên trình duyệt. Upload ảnh, SVG hoặc video (MP4/WebM) và chuyển thành lưới ký tự, có lớp ảnh gốc lồng bên dưới, patchwork, flicker và xuất PNG / video.
*A browser-only ASCII generative system: turn images, SVG and video into character grids, layered over the source, with patchwork, flicker and PNG / video export. UI in Vietnamese and English.*

## Chạy local

Không cần build. Mở thẳng `index.html`, hoặc chạy một static server:

```bash
npx serve .
```

## Deploy lên Vercel

1. Push folder này lên một repo GitHub.
2. Vercel → **Add New… → Project** → chọn repo.
3. Framework Preset: **Other**. Build Command: để trống. Output Directory: `.` (mặc định).
4. Deploy.

Hoặc dùng CLI: `npx vercel` rồi `npx vercel --prod`.

## Cấu trúc

```
index.html        markup + các ô điều khiển
css/style.css     giao diện (light / dark theo hệ thống)
js/i18n.js        chuỗi chữ VI / EN, nút chuyển ngôn ngữ
js/presets.js     bộ ký tự, giá trị mặc định, các biến thể + bảng màu
js/dragon.js      con rồng demo vẽ bằng canvas
js/app.js         engine render + xử lý UI
```

## Bảng màu các biến thể

Ở chế độ **Palette**, `inks[0]` tô vùng tối nhất, màu cuối tô vùng sáng nhất, nên các màu được xếp từ tối đến sáng. Tỉ lệ tương phản (WCAG) tính trên màu nền.

| Biến thể | Nền | Màu chữ (tối → sáng) | Tương phản |
|---|---|---|---|
| Rose | `#DB2C8A` | `#FFFFFF` | 4.43 |
| Loong | `#1C1838` | `#6A62C4` `#E8615A` `#F2A541` `#F7EBD5` | 3.36 · 5.08 · 8.27 · 14.39 |
| Amber | `#120D06` | `#FFB347` | 10.86 |
| Chroma | `#050505` | màu lấy từ ảnh | — |
| Réseau | `#5EE68A` | `#1B2A8F` `#2E46D6` | 7.42 · 4.44 |
| Strata | `#0D1022` | `#E8613C` `#5BB8E8` `#B8BAC4` `#F5C443` | 5.57 · 8.50 · 9.74 · 11.54 |
| Lồng ảnh / Layered | `#000000` | `#FFFFFF` | 21.00 |
| Paper | `#EFEDE6` | `#151515` | 15.59 |
| Linen | `#F2F0E9` | `#2A2A2A` | 12.59 |
| Scan | `#E3E3DF` | `#111111` | 14.67 |
| Moss | `#EDEDE8` | `#1E5A47` | 6.85 |

Thêm biến thể mới: thêm một mục vào `GL.PRESETS` trong `js/presets.js`.

Bộ ký tự **Bars** và **Shapes** không vẽ bằng font mà vẽ bằng hình học (`GL.SHAPES`), nên thanh ngang và chấm tròn lấp kín ô và nối liền nhau. Thanh **Hạt nhiễu / Grain** phủ một lớp nhiễu tĩnh lên ảnh xuất.

## Ghi chú

- PNG có nền trong suốt: vùng trong suốt sẽ để trống, chỉ vẽ phần có hình.
- Quay video dùng `MediaRecorder`: Chrome/Edge xuất WebM (hoặc MP4 nếu trình duyệt hỗ trợ), Safari xuất MP4.
- Mọi xử lý đều nằm trên máy người dùng, không upload file đi đâu cả.
