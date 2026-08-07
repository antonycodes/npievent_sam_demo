# NPI Event · Coordinator Dashboard

Bảng điều khiển sơ đồ **tương tác thời gian thực** cho điều phối viên sự kiện ra
mắt iPhone (cellphoneS). Mô phỏng layout sự kiện thành lưới tọa độ, đồng bộ trạng
thái bàn từ **Lark Base (Bitable)** qua HTTPS, mặc định tự cập nhật mỗi 5 giây.

## Tính năng

- **14 node tương tác**: 3 node Kỹ thuật `KT1–KT3`, 1 node `BK.X` và 10 node
  Tư vấn `TV1–TV10`. Khu Tư vấn được dàn 5 cột × 2 hàng; `BK.X` có sức chứa
  hiển thị 5 STT.
- **Màu trạng thái**: có khách "Tiếp nhận" tại bàn trong `Master` → **Đỏ**,
  ngược lại → **Xanh**. Badge cam = số khách đang chờ (có thể hiện cả trên
  bàn trống).
- **Click bàn → popover chi tiết**: Tên NV · STT Khách · Tên sản phẩm (SP 1) ·
  Ghi chú thanh toán · Khách đang chờ (**bấm vào số này để xem "STT tiếp
  theo"** thay vì số lượng).
- **2 khu chờ tách riêng**: "Đã check-in" (chưa được điều phối vào bàn nào) và
  "Chờ điều phối" (vừa hoàn tất 1 khâu, chưa được điều phối tiếp) — xếp chồng
  dọc, mỗi khu 1 lưới 4×3 ô STT riêng.
- **Sidebar**: Tổng khách đã Check-in + breakdown Tiếp nhận/Trống/Chờ mỗi cụm.
- **Bộ lọc nhanh**: "Chỉ hiện bàn trống", "Chỉ hiện bàn KT".
- **Auto-refresh 5s** mặc định (polling) + thanh trạng thái đồng bộ.
- **Chuyển view nhanh**: `Main`, `Tư vấn`, `Kỹ thuật`.
- **Trang Cài đặt Lark** (`#/settings`): nhập key kết nối và ánh xạ tên cột Lark
  ↔ trường web ngay trong web (không cần sửa code/env) — xem mục dưới.

## Trang Cài đặt Lark (`#/settings`)

Mở link **"Cài đặt Lark"** ở header. Cho phép cấu hình **runtime** (lưu vào
`localStorage`, áp dụng ngay, dashboard tự đồng bộ lại):

1. **Nguồn dữ liệu**: Mock (mẫu) hoặc Lark Base (thật).
2. **Kết nối**: chọn **Proxy/Webhook** (nhập API URL, hoặc **📷 Quét QR** để
   điền link bằng camera điện thoại — không cần gõ tay) hoặc **Direct API**
   (Host, App Token, Access Token + Table ID) + chu kỳ làm mới.
3. **Ánh xạ trường**: điền tên cột Lark cho từng trường web (Check in +
   Master + Master Điều phối + DS Master). Để trống = dùng mặc định.
4. **Kiểm tra kết nối** (thử fetch, báo số bàn/check-in/đơn), **Lưu & đồng bộ**,
   **Khôi phục mặc định**.

> Cấu hình `.env` chỉ là **giá trị khởi tạo**; trang Cài đặt ghi đè lúc chạy.
> Chi tiết lấy token/table id + dựng proxy: xem `docs/LARK_SETUP.md`.

## Công nghệ

Vite 6 · React 18 · TypeScript · TailwindCSS 3.

## Chạy dự án

```bash
npm install
npm run dev      # dev server — mặc định chạy mock data (từ file NPI_Testing_2)
npm run build    # typecheck + build production
npm run preview  # xem bản build
```

## Kiến trúc dữ liệu

> `DS Master` là bảng nhân sự và là nguồn công thức `STT tiếp theo`; không dùng
> như bảng trạng thái tiếp nhận. Trạng thái vận hành đọc từ `SS_Master/Master`.

Luồng nghiệp vụ thật: khách check-in ở **`Master_Check in`** (nhận STT) →
điều phối viên gán bàn trong **`Master Điều phối`** → NV tại bàn đó tiếp
nhận khách, ghi vào **`Master`**. App đọc 5 bảng:

| Vai trò       | Bảng                | Dùng cho                                             |
| ------------- | -------------------- | ----------------------------------------------------- |
| Check-in      | `Master_Check in`    | STT, chi tiết khách (SP, ghi chú, nghiệm thu…), join theo tên |
| NV tiếp nhận  | `Master`             | Khách nào đang ở bàn nào (`TV_MãNV`) + tên NV + màu bàn + "Chờ điều phối" |
| Điều phối     | `Master Điều phối`   | Khách đã gán bàn nhưng chưa được nhận → số "khách đang chờ" mỗi bàn |
| STT tiếp theo | `DS Master`          | `STT bàn` + `STT tiếp theo`; giá trị đã tính sẵn cho từng node |
| Đăng ký       | `Danh sách đơn hàng` | Tổng số đăng ký (mẫu số phễu)                         |

- **Màu bàn**: có ≥ 1 khách "Tiếp nhận" tại bàn đó trong `Master` → Đỏ, ngược lại → Xanh.
- **Mã node và mã Lark**:

  | Mã trong Base | Node hiển thị | Ghi chú |
  | --- | --- | --- |
  | `TC1`, `BK11`, `KT1` | `KT1` | `TC1` là mã bàn thật; `KT1` là nhãn giao diện |
  | `TC2`, `BK12`, `KT2` | `KT2` | tương tự |
  | `TC3`, `BK13`, `KT3` | `KT3` | tương tự |
  | `BK.X` | `BK.X` | node Kỹ thuật riêng, tối đa 5 STT |
  | `TV1–TV10` | `TV1–TV10` | mã bàn Tư vấn |
  | `BK1–BK10` | `TV1–TV10` | Backup của nhân sự Tư vấn |

- **Khâu Điều phối**: đọc `Master Điều phối` ở `DS thu cũ`, `DS Tư vấn` và
  `DS Backup`. Mã `TC1`/`BK11` đều quy về node `KT1`; `TV1`/`BK1` đều quy về
  node `TV1`. Khách đã điều phối nhưng chưa có dòng tiếp nhận vẫn nằm trong
  số khách chờ.
- **Khâu Tiếp nhận**: đọc `SS_Master/Master`: `TV_MãNV`, `Người`, `Trạng thái`,
  `Loại 2`, `Thời gian`. Chỉ `Trạng thái = Tiếp nhận` mới làm node đỏ và hiện
  STT bên dưới. Nếu mã bàn là option ID chưa resolve, app fallback qua `Người`
  và đối chiếu `DS Master` để tìm bàn chính.
- **Khâu Hoàn tất**: lấy bản ghi mới nhất theo cặp `(mã node, khách)` dựa trên
  `Thời gian`. Nếu bản ghi mới nhất là `Hoàn tất`, khách được gỡ khỏi node đang
  phục vụ và chuyển sang khu `Chờ điều phối`, trừ khi đã `End flow`.
- **Nhân sự từng khâu**: dùng `Loại 2` trong `SS_Master/Master` để tách `Tư vấn`,
  `Thu cũ`, `Backup`; thông tin hiển thị giữ đủ `(TV)(TC)(BK)` và không gộp
  Backup vào mã bàn chính.
- **STT tiếp theo**: các trang Tư vấn/Kỹ thuật đọc trực tiếp `DS Master.STT tiếp
  theo` theo `STT bàn`; app không tự xếp lại hàng từ `Master Điều phối`.
- **Tên NV** ở popover lấy từ `Master.Người` của khách đang được tiếp nhận — bàn trống không hiện tên NV nào.
- **"Chờ điều phối"**: khách có dòng `Master.Trạng thái` = "Hoàn tất" (đọc TRỰC TIẾP từ `Master`, không qua field riêng ở Check-in nữa).
- **Badge "khách đang chờ"** hiện ở CẢ bàn trống lẫn bàn đang bận — miễn là có khách được `Master Điều phối` gán vào bàn đó mà chưa có dòng "Tiếp nhận" tương ứng. Bấm vào số này để xem "STT tiếp theo" (từ `DS Master`).
- **Thông tin khách từ Check-in**: lấy từ `Master_Check in` theo `Họ và tên` hoặc
  `STT`. `STT`, `SP 1`, `Check UD Thanh toán`, `Check nghiệm thu`, `Thu cũ check`,
  `Backup check`, `Done in Flow` và `End flow` chỉ là dữ liệu chi tiết/hiển thị;
  `Check nghiệm thu` được hiển thị nguyên văn, không đổi thành nhãn mới.
- **Base nhúng trong Lark Wiki**: nếu link base của bạn là `.../wiki/<token>`
  thay vì `.../base/<token>`, xem cảnh báo trong `docs/LARK_SETUP.md` — cần
  đổi sang app_token thật trước khi gọi API (proxy mẫu trong repo tự làm việc
  này).

## Cấu hình Lark Base

> 📖 Hướng dẫn liên kết chi tiết (lấy token, table id, dựng proxy, xử lý CORS):
> xem **[`docs/LARK_SETUP.md`](docs/LARK_SETUP.md)**.

Tạo file `.env` ở thư mục gốc project:

- **Mode 1 (khuyến nghị):** `VITE_LARK_API_URL` = proxy/webhook HTTPS do bạn kiểm
  soát. Client gọi `${VITE_LARK_API_URL}/<tableKey>` với `tableKey` ∈
  `checkin orders master dispatch dsMaster` — cả 5 route đều **bắt buộc**;
  `checkin` trỏ vào "Master_Check in", `master` trỏ vào "Master", `dispatch`
  trỏ vào "Master Điều phối", `dsMaster` trỏ vào "DS Master". Mỗi endpoint trả
  JSON list-records của Lark. (Giữ secret server-side, tránh CORS. Dùng luôn
  `cloudflare-worker.js` trong repo — đã code sẵn cả 5 route + tự xử lý base
  nhúng Wiki.)
- **Mode 2 (trực tiếp):** `VITE_LARK_APP_TOKEN` + `VITE_LARK_ACCESS_TOKEN` +
  các biến `VITE_LARK_TABLE_*` (mỗi Table_ID).
- Không cấu hình gì → chạy mock data đi kèm. `VITE_LARK_POLL_MS` mặc định 5000.

Ví dụ proxy mặc định:

```env
VITE_LARK_API_URL=https://your-worker.workers.dev
VITE_LARK_POLL_MS=5000
```

Tên cột mặc định khớp schema hiện tại và nằm trong `src/config/larkConfig.ts`
(`DEFAULT_CHECKIN_FIELDS` / `DEFAULT_MASTER_FIELDS` / `DEFAULT_DISPATCH_FIELDS`
/ `DEFAULT_DS_MASTER_FIELDS`) — sửa ở đó nếu base của bạn đặt tên cột khác.

## Cấu trúc

Xem `memory.md` để biết lịch sử thay đổi và schema dữ liệu thật. Các phần chính:

- `src/config/larkConfig.ts`: tên bảng, tên cột và giá trị trạng thái mặc định.
- `src/services/larkMapper.ts`: chuẩn hóa mã node, điều phối, tiếp nhận, hoàn tất
  và map nhân sự.
- `src/services/queueMapper.ts`: các trang Tư vấn/Kỹ thuật và STT tiếp theo.
- `src/config/layoutConfig.ts`: tọa độ 14 node và nhãn KT/TV/BK.X.
- `src/components/ViewSwitcher.tsx`: nút chuyển Main/Tư vấn/Kỹ thuật.
- `cloudflare-worker.js`: proxy Lark, resolve Wiki token và option value.
