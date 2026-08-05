# NPI Event · Coordinator Dashboard

Bảng điều khiển sơ đồ **tương tác thời gian thực** cho điều phối viên sự kiện ra
mắt iPhone (cellphoneS). Mô phỏng layout sự kiện thành lưới tọa độ, đồng bộ trạng
thái bàn từ **Lark Base (Bitable)** qua HTTPS, tự cập nhật mỗi 30 giây.

## Tính năng

- **11 bàn tương tác**: 3 Kỹ thuật (KT1–KT3) · 8 Tư vấn (TV1–TV8). Cụm Kỹ thuật
  thay cho "Thu cũ" cũ và đọc đúng bảng Lark đó, không đổi; không còn cụm Backup.
- **Màu trạng thái**: `Sl … tiếp nhận > 0` → **Đỏ** (đang tiếp nhận), ngược lại →
  **Xanh** (trống); **Xám** = chưa có dữ liệu. Badge cam = số khách đang chờ.
- **Click bàn → popover chi tiết**: Tên NV · STT Khách · Tên sản phẩm (SP 1) ·
  Ghi chú thanh toán · Khách đang chờ.
- **Sidebar**: Tổng khách đã Check-in + breakdown Tiếp nhận/Trống/Chờ mỗi cụm.
- **Bộ lọc nhanh**: "Chỉ hiện bàn trống", "Chỉ hiện bàn KT".
- **Auto-refresh 30s** (polling) + thanh trạng thái đồng bộ.
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
   Master + Master Điều phối). Để trống = dùng mặc định.
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

> **Cập nhật 2026-08-05 ("no DS Master")**: `DS Master` (bảng DS cũ, gộp 4
> loại bàn) hoá ra là **danh sách nhân sự**, không phải trạng thái vận hành
> theo bàn — web **không đọc bảng đó nữa**. Occupancy/màu bàn/tên NV giờ đọc
> từ `Master`; số "khách đang chờ" mỗi bàn đọc từ `Master Điều phối`. Sơ đồ
> vẫn 11 bàn cố định (KT1–3, TV1–8) — mapper tính state cho từng vị trí đó
> trực tiếp, không còn "match theo dòng của 1 bảng đăng ký" như trước.

Luồng nghiệp vụ thật: khách check-in ở **`Master_Check in`** (nhận STT) →
điều phối viên gán bàn trong **`Master Điều phối`** → NV tại bàn đó tiếp
nhận khách, ghi vào **`Master`**. App đọc 4 bảng:

| Vai trò       | Bảng                | Dùng cho                                             |
| ------------- | -------------------- | ----------------------------------------------------- |
| Check-in      | `Master_Check in`    | STT, chi tiết khách (SP, ghi chú, nghiệm thu…), join theo tên |
| NV tiếp nhận  | `Master`             | Khách nào đang ở bàn nào (`TV_MãNV`) + tên NV + màu bàn |
| Điều phối     | `Master Điều phối`   | Khách đã gán bàn nhưng chưa được nhận → số "khách đang chờ" mỗi bàn |
| Đăng ký       | `Danh sách đơn hàng` | Tổng số đăng ký (mẫu số phễu)                         |

- **Màu bàn**: có ≥ 1 khách "Tiếp nhận" tại bàn đó trong `Master` → Đỏ, ngược lại → Xanh.
- **Tên NV** ở popover lấy từ `Master.Người` của khách đang được tiếp nhận — bàn trống không hiện tên NV nào.
- **Badge "khách đang chờ"** hiện ở CẢ bàn trống lẫn bàn đang bận — miễn là có khách được `Master Điều phối` gán vào bàn đó mà chưa có dòng "Tiếp nhận" tương ứng.
- **Base nhúng trong Lark Wiki**: nếu link base của bạn là `.../wiki/<token>`
  thay vì `.../base/<token>`, xem cảnh báo trong `docs/LARK_SETUP.md` — cần
  đổi sang app_token thật trước khi gọi API (proxy mẫu trong repo tự làm việc
  này).

## Cấu hình Lark Base

> 📖 Hướng dẫn liên kết chi tiết (lấy token, table id, dựng proxy, xử lý CORS):
> xem **[`docs/LARK_SETUP.md`](docs/LARK_SETUP.md)**.

Copy `.env.example` → `.env.local`:

- **Mode 1 (khuyến nghị):** `VITE_LARK_API_URL` = proxy/webhook HTTPS do bạn kiểm
  soát. Client gọi `${VITE_LARK_API_URL}/<tableKey>` với `tableKey` ∈
  `checkin orders master dispatch` — cả 4 route đều **bắt buộc**; `checkin`
  trỏ vào "Master_Check in", `master` trỏ vào "Master", `dispatch` trỏ vào
  "Master Điều phối". Mỗi endpoint trả JSON list-records của Lark. (Giữ
  secret server-side, tránh CORS. Dùng luôn `cloudflare-worker.js` trong
  repo — đã code sẵn cả 4 route + tự xử lý base nhúng Wiki.)
- **Mode 2 (trực tiếp):** `VITE_LARK_APP_TOKEN` + `VITE_LARK_ACCESS_TOKEN` +
  các biến `VITE_LARK_TABLE_*` (mỗi Table_ID).
- Không cấu hình gì → chạy mock data đi kèm. `VITE_LARK_POLL_MS` mặc định 30000.

Tên cột mặc định khớp schema hiện tại và nằm trong `src/config/larkConfig.ts`
(`DEFAULT_CHECKIN_FIELDS` / `DEFAULT_MASTER_FIELDS` / `DEFAULT_DISPATCH_FIELDS`)
— sửa ở đó nếu base của bạn đặt tên cột khác.

## Cấu trúc

Xem `memory.md` để biết kiến trúc đầy đủ, schema dữ liệu thật, tọa độ layout và
tiến độ từng bước.
