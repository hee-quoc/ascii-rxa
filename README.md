# Glyph Loom

Hệ thống ASCII generative chạy hoàn toàn trên trình duyệt. Biến các ảnh demo có sẵn (người dùng không tự tải file lên) thành lưới ký tự, có lớp ảnh gốc lồng bên dưới, patchwork, flicker và xuất PNG / SVG / video.
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

- Nếu danh sách không có mục trống nào, app tự thêm một mục trống ở đầu để nền vẫn sạch. Muốn chừa trống chỗ khác thì để `;;`.
- Bảng màu có tối đa 8 màu (kéo **Số màu**). Ở chế độ **Palette**, màu được chia theo thứ tự các mục: 8 mục với 8 màu thì mục thứ *i* luôn mang màu thứ *i*; nhiều mục hơn số màu thì các mục liền nhau dùng chung một màu. Ô xem trước dưới ô nhập cho thấy mục nào mang màu nào.

**Ký tự SVG**: ngay dưới ô xem trước bộ ký tự có hàng **SVG** (các hình đã tải và nút **+ SVG**). Bấm một ký tự trong ô xem trước để chọn nó, rồi bấm một hình SVG, **+ SVG** hoặc một ký tự trong thư viện để thay đúng ký tự đó; có nút xoá ký tự đang chọn. Chưa chọn gì thì hình được thêm vào cuối bộ. Nút **+ SVG** nhận một hay nhiều file SVG bất kỳ (hình con vật, logo, icon…) và biến mỗi file thành một ký tự, tên dạng `svg:ten-file`. File được làm sạch (bỏ script, sự kiện, link ra ngoài), khung hình được cắt sát nét vẽ để hình lấp đầy ô, rồi vẽ thành bóng đặc theo màu ký tự (mono, palette, màu ảnh…). Ký tự SVG được lưu trên trình duyệt (file tới 400 KB), dùng được trong bộ ký tự chính lẫn bộ riêng của từng vùng (mỗi dòng vùng có ô xem trước các ký tự của vùng và hàng **SVG**: bấm một ký tự để chọn rồi bấm một hình hoặc **+** để thay đúng ký tự đó, hay xoá nó; chưa chọn thì hình được thêm vào cuối bộ của vùng). Bình thường độ sáng chọn **một** ký tự trong bộ (thưa → dày), nên hai hình trong cùng một vùng một màu sẽ chỉ hiện hình ứng với độ sáng đó; bật **Trộn** (ở vùng) hoặc **Trộn đều các ký tự** (bộ chính) để mọi ký tự trong bộ đều hiện, rải xen kẽ. Thêm hình SVG thứ hai vào một vùng sẽ tự bật Trộn cho vùng đó, và khi xuất SVG được dò thành nét vector. Bấm × để xoá.

**Thư viện ký tự** (mở ngay dưới ô Tự nhập) gom sẵn ký tự theo nhóm: ASCII, khối, hình, đường, mũi tên, sao & hoa, toán, braille. Bấm một ký tự là nó được thêm vào cuối ô Tự nhập; có nút xoá ký tự cuối, xoá hết và **Lưu bộ này** để giữ bộ ký tự trên trình duyệt (tối đa 24 bộ, bấm để dùng lại, × để xoá).

## Nền

Ở mục Màu, **Tắt nền** bỏ lớp nền phủ cả khung (PNG / SVG xuất ra trong suốt). **Nền từng ô** đặt một ô vuông màu riêng sau các ô có ký tự; những ô trống nằm lọt bên trong hình (ký tự trắng, vùng bị cắt tối) cũng được lấp, nên khi tắt nền hình không bị thủng mà nền chạy theo đúng từng ô của hình. Lớp ảnh gốc giờ chỉ bật / tắt, không còn thanh chỉnh độ mờ của ảnh hay của ASCII.

## Vùng màu

Chế độ màu **Vùng** chia ảnh theo màu thay vì theo độ sáng. Khi mở một ảnh demo, app tự tìm các dải màu chính (2–8 vùng; với video thì lấy từ khung hình đầu tiên). Mỗi vùng có:

- **Màu gốc**: màu app tìm thấy. Bấm vào ô này rồi bấm lên ảnh để chọn lại.
- **Màu xuất**: màu ký tự của vùng đó.
- **Bộ ký tự** riêng: chọn bộ có sẵn, rồi sửa từng ký tự ngay trên ô xem trước của vùng (bấm một ký tự, sau đó bấm một hình SVG, tải SVG mới, mở **Thư viện ký tự** ngay tại vùng để chọn, hoặc gõ ký tự / chữ mới rồi Enter; có nút xoá ký tự).
- **Bật/tắt**: vùng chiếm nhiều viền ảnh nhất (thường là nền) được tắt sẵn.

Mỗi ô ký tự thuộc về vùng có màu gốc gần nhất (so theo sắc độ nhiều hơn độ sáng, nên mặt sáng và mặt tối của một đám mây vẫn chung một vùng). Trong vùng đó, độ sáng chọn ký tự thưa hay dày. **Độ rộng vùng** dưới 100% sẽ bỏ trống những chỗ không đủ giống vùng nào. Bấm thẳng lên ảnh để thêm vùng mới. Đổi preset không làm mất các vùng.

Trang mở sẵn ảnh mây `assets/cloud.jpg` ở chế độ Vùng; nút **Mây demo** mở lại ảnh này. Con rồng demo (`js/dragon.js`) đã ẩn khỏi giao diện và chỉ dùng khi không tải được ảnh mây.

Thêm biến thể mới: thêm một mục vào `GL.PRESETS` trong `js/presets.js`.

Bộ ký tự **Bars** và **Shapes** không vẽ bằng font mà vẽ bằng hình học (`GL.SHAPES`), nên thanh ngang và chấm tròn lấp kín ô và nối liền nhau. Thanh **Hạt nhiễu / Grain** phủ một lớp nhiễu tĩnh lên ảnh xuất.

## Mode 2 (thử nghiệm)

Nút **Mode 2** mở một bầu trời có mây bay ngang, làm từ các ảnh mây trong `assets/mode2/` (hiện có `cloud-1.png`; thêm ảnh mới thì ghi tên file vào danh sách `SPRITES` đầu `js/mode2.js`). Ảnh mây có nền sáng trơn sẽ được tự tách nền khi tải, nên các đám mây chồng lên nhau gọn gàng.

- **Sinh ngẫu nhiên**: mỗi đám mây có một độ xa gần ngẫu nhiên. Mây gần to hơn, bay nhanh hơn và nằm trên; mây xa nhỏ, chậm (hiệu ứng chiều sâu). Mây bay ra khỏi khung sẽ quay lại từ phía bên kia với kích thước, độ cao và chiều lật mới.
- **Chuyển động**: bật / tắt **Mây bay**, **Tốc độ**, **Hướng bay** (sang phải / sang trái), **Gió thổi không đều** (tốc độ lúc nhanh lúc chậm) và **Bồng bềnh** (nhấp nhô lên xuống).
- **Mây**: **Số mây**, **Mây nhỏ nhất**, **Mây to nhất**, **Lật ngẫu nhiên**, màu **Nền trời**, và **Tạo mây mới** để ra một bố cục khác.
- **Hiển thị**: mặc định là **Mây gốc**; bấm **ASCII** để xem bản ký tự (màu ký tự lấy từ mây). Quay video bằng nút Quay để lưu chuyển động.

Toàn bộ code nằm trong `js/mode2.js`; xoá dòng `<script src="js/mode2.js">` trong `index.html` là mode này ẩn hoàn toàn.

## Ghi chú

- PNG có nền trong suốt: vùng trong suốt sẽ để trống, chỉ vẽ phần có hình.
- **Xuất SVG** mặc định chuyển mọi ký tự thành nét vector (như "Create Outlines"), nên mở trong Figma / Illustrator / trình duyệt đều giống bản PNG. Nét lấy từ font Geist Mono đóng gói trong `assets/fonts` (giấy phép OFL, xem `assets/fonts/OFL.txt`); ký tự font không có thì được dò nét từ chính canvas. Mỗi ký tự là một symbol dùng lại, gom nhóm theo màu nên vẫn đổi màu cả nhóm dễ dàng. Riêng `░▒▓` được giữ đúng từng điểm ảnh như trên canvas (font vẽ các ký tự này thành chấm tròn to khi phóng lớn, chỉ ở cỡ ô mới thành hoa văn). Tick **SVG giữ chữ** nếu cần ký tự là chữ sửa được (máy cần cài Geist Mono). Lớp ảnh gốc (nếu bật) được nhúng dạng PNG; hạt nhiễu thành filter SVG và chế độ blend có thể bị Figma bỏ qua, nên hai phần này trông hơi khác.
- Quay video dùng `MediaRecorder`: Chrome/Edge xuất WebM (hoặc MP4 nếu trình duyệt hỗ trợ), Safari xuất MP4.
- Mọi xử lý đều nằm trên máy người dùng, không gửi file đi đâu cả. Người dùng không mở được file riêng: app chỉ chạy các demo đóng gói sẵn trong `assets/` (thêm demo mới bằng `loadDemo(url, look)` trong `js/app.js`).

## Tác giả / Author

Hy Nguyen
