# Glyph Loom

Hệ thống ASCII generative chạy hoàn toàn trên trình duyệt. Upload ảnh, SVG hoặc video (MP4/WebM) và chuyển thành lưới ký tự, có lớp ảnh gốc lồng bên dưới, patchwork, flicker và xuất PNG / SVG / video.
*A browser-only ASCII generative system: turn images, SVG and video into character grids, layered over the source, with patchwork, flicker and PNG / SVG / video export. UI in Vietnamese and English.*

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
js/zones.js       tìm vùng màu (k-means trong Oklab) + gán ô vào vùng
js/dragon.js      con rồng demo vẽ bằng canvas
js/mode2.js       mode 2: mây generative (đang thử nghiệm)
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
| Lagoon | `#F4FAFB` | `#1A93AE` · `#2F6FE0` · `#1A20D8` · `#0B1690` | 3.42 · 4.45 · 8.88 · 13.00 |

## Bộ ký tự tự nhập

Ô **Tự nhập** nhận một danh sách cách nhau bằng `;`, mỗi mục là một ký tự, emoji hoặc một từ ngắn: `a;b;c;d`, `·;AI;★;LOVE`. Thứ tự từ trái sang phải ứng với vùng tối → vùng sáng (bật **Đảo sáng / tối** để lật lại). Không có `;` thì mỗi ký tự là một mục, như các bộ có sẵn.

**Thư viện ký tự** (mở ngay dưới ô Tự nhập) gom sẵn ký tự theo nhóm: ASCII, khối, hình, đường, mũi tên, sao & hoa, toán, braille. Bấm một ký tự là nó được thêm vào cuối ô Tự nhập; có nút xoá ký tự cuối, xoá hết và **Lưu bộ này** để giữ bộ ký tự trên trình duyệt (tối đa 24 bộ, bấm để dùng lại, × để xoá).

## Nền

Ở mục Màu, **Tắt nền** bỏ lớp nền phủ cả khung (PNG / SVG xuất ra trong suốt). **Nền từng ô** đặt một ô vuông màu riêng sau mỗi ký tự được vẽ, nên khi tắt nền khung hình không bị thủng mà nền chạy theo đúng từng ô ký tự. Lớp ảnh gốc giờ chỉ bật / tắt, không còn thanh chỉnh độ mờ của ảnh hay của ASCII.

- Nếu danh sách không có mục trống nào, app tự thêm một mục trống ở đầu để nền vẫn sạch. Muốn chừa trống chỗ khác thì để `;;`.
- Bảng màu có tối đa 8 màu (kéo **Số màu**). Ở chế độ **Palette**, màu được chia theo thứ tự các mục: 8 mục với 8 màu thì mục thứ *i* luôn mang màu thứ *i*; nhiều mục hơn số màu thì các mục liền nhau dùng chung một màu. Ô xem trước dưới ô nhập cho thấy mục nào mang màu nào.

## Vùng màu

Chế độ màu **Vùng** chia ảnh theo màu thay vì theo độ sáng. Khi tải ảnh hoặc video lên, app tự tìm các dải màu chính (2–8 vùng; với video thì lấy từ khung hình đầu tiên). Mỗi vùng có:

- **Màu gốc**: màu app tìm thấy. Bấm vào ô này rồi bấm lên ảnh để chọn lại.
- **Màu xuất**: màu ký tự của vùng đó.
- **Bộ ký tự** riêng: chọn bộ có sẵn hoặc tự gõ kiểu `a;b;c`.
- **Bật/tắt**: vùng chiếm nhiều viền ảnh nhất (thường là nền) được tắt sẵn.

Mỗi ô ký tự thuộc về vùng có màu gốc gần nhất (so theo sắc độ nhiều hơn độ sáng, nên mặt sáng và mặt tối của một đám mây vẫn chung một vùng). Trong vùng đó, độ sáng chọn ký tự thưa hay dày. **Độ rộng vùng** dưới 100% sẽ bỏ trống những chỗ không đủ giống vùng nào. Bấm thẳng lên ảnh để thêm vùng mới. Đổi preset không làm mất các vùng.

Trang mở sẵn ảnh mây `assets/cloud.jpg` ở chế độ Vùng; nút **Mây demo** mở lại ảnh này. Con rồng demo (`js/dragon.js`) đã ẩn khỏi giao diện và chỉ dùng khi không tải được ảnh mây.

Thêm biến thể mới: thêm một mục vào `GL.PRESETS` trong `js/presets.js`.

Bộ ký tự **Bars** và **Shapes** không vẽ bằng font mà vẽ bằng hình học (`GL.SHAPES`), nên thanh ngang và chấm tròn lấp kín ô và nối liền nhau. Thanh **Hạt nhiễu / Grain** phủ một lớp nhiễu tĩnh lên ảnh xuất.

## Mode 2 (thử nghiệm)

Nút **Mode 2** sinh cụm mây kiểu tường vân. Mỗi cụm gồm bướu chính có xoắn ốc, bướu vai và bướu hai bên, nối mềm với nhau và cắt phẳng theo đường nền. Các sọc là những đường viền lùi vào trong: viền sáng ở ngoài, đậm dần vào tâm. **Dải mây** mọc từ giữa ra hai phía, uốn chữ S với góc rẽ mỗi bước có giới hạn, và luôn bị kéo về hướng ban đầu nên không trôi ra ngoài khung. Mỗi đầu dải hoặc vuốt nhọn, hoặc cuộn thành móc xoắn (độ cong tăng dần, bề dày giữ dưới một phần ba bán kính cuộn để các vòng không dính nhau). Dải nằm sau các cụm và dùng cùng kiểu sọc. Bảng Mode 2 ở đầu cột phải chỉnh số hàng, số cụm, số sọc, số vòng xoắn, số dải mây, độ uốn và tạo mây mới. Toàn bộ code nằm trong `js/mode2.js`; xoá dòng `<script src="js/mode2.js">` trong `index.html` là mode này ẩn hoàn toàn.

## Ghi chú

- PNG có nền trong suốt: vùng trong suốt sẽ để trống, chỉ vẽ phần có hình.
- **Xuất SVG** mặc định chuyển mọi ký tự thành nét vector (như "Create Outlines"), nên mở trong Figma / Illustrator / trình duyệt đều giống bản PNG. Nét lấy từ font Geist Mono đóng gói trong `assets/fonts` (giấy phép OFL, xem `assets/fonts/OFL.txt`); ký tự font không có thì được dò nét từ chính canvas. Mỗi ký tự là một symbol dùng lại, gom nhóm theo màu nên vẫn đổi màu cả nhóm dễ dàng. Riêng `░▒▓` được giữ đúng từng điểm ảnh như trên canvas (font vẽ các ký tự này thành chấm tròn to khi phóng lớn, chỉ ở cỡ ô mới thành hoa văn). Tick **SVG giữ chữ** nếu cần ký tự là chữ sửa được (máy cần cài Geist Mono). Lớp ảnh gốc (nếu bật) được nhúng dạng PNG; hạt nhiễu thành filter SVG và chế độ blend có thể bị Figma bỏ qua, nên hai phần này trông hơi khác.
- Quay video dùng `MediaRecorder`: Chrome/Edge xuất WebM (hoặc MP4 nếu trình duyệt hỗ trợ), Safari xuất MP4.
- Mọi xử lý đều nằm trên máy người dùng, không upload file đi đâu cả.

## Tác giả / Author

Hy Nguyen
