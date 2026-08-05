# Hướng dẫn liên kết dữ liệu từ Lark Base

> **Cập nhật 2026-08-05 ("no DS Master")**: `DS Master` (bảng DS gộp 4 loại
> bàn từ lần cập nhật trước) hoá ra là **danh sách nhân sự** (theo xác nhận
> của người vận hành base), KHÔNG phải trạng thái vận hành theo bàn — app
> **không đọc bảng đó nữa**. Occupancy/màu bàn/tên NV giờ đọc từ `Master`; số
> "khách đang chờ" mỗi bàn đọc từ `Master Điều phối`. Sơ đồ web vẫn 11 bàn cố
> định (KT1–3, TV1–8, không đổi) — mapper tính state cho TỪNG VỊ TRÍ đó trực
> tiếp, không còn phụ thuộc "match theo dòng của 1 bảng đăng ký" như trước.

Luồng nghiệp vụ thật: khách check-in ở `Master_Check in` (nhận STT) → điều
phối viên gán bàn trong `Master Điều phối` → NV tại bàn đó tiếp nhận khách,
ghi vào `Master`. Dashboard đọc **4 bảng** trong Lark Base (Bitable):
`Master_Check in`, `Master`, `Master Điều phối`, `Danh sách đơn hàng`. Có
**2 cách** kết nối:

| Cách | Khi nào dùng | Ưu / Nhược |
| ---- | ------------ | ---------- |
| **1. Proxy / Webhook** (khuyến nghị) | Production | Giữ secret ở server, không lộ token, không dính CORS. Cần dựng 1 endpoint nhỏ. |
| **2. Direct API** | Test nhanh nội bộ | Cắm thẳng token vào web. **Lộ token + dính CORS + token hết hạn ~2h** → không nên cho production. |

---

## 0. Chuẩn bị: tên cột phải khớp

App map dữ liệu theo **tên cột hiển thị** trong Lark. Mặc định khớp base hiện
tại. Nếu base của bạn đặt tên khác → sửa trong `src/config/larkConfig.ts`
(`DEFAULT_CHECKIN_FIELDS`, `DEFAULT_MASTER_FIELDS`, `DEFAULT_DISPATCH_FIELDS`)
hoặc trực tiếp qua trang **Cài đặt** trong web (không cần sửa code).

**Bảng `Master_Check in`** (trước là `Check in`, tên CỘT giữ nguyên) cần:
`STT` · `Họ và tên` · `SP 1` · `Note UDTT` · `Check nghiệm thu` ·
`Thu cũ check` · `Done in Flow` · `End flow` · `Thời gian` ·
`Status in thu cũ` · `Status in tư vấn`
(dùng cho số đã check-in + chi tiết khách, join theo tên; 2 cột `Status in
...` chỉ dùng để phát hiện "vừa hoàn tất 1 khâu, chưa được điều phối tiếp").

**Bảng `Master`** — log mỗi lần 1 NV nhận 1 khách tại 1 bàn (nguồn DUY NHẤT
xác định khách đang ở bàn nào + màu bàn + tên NV). Cần:

| Ý nghĩa | Tên cột |
| ------- | ------- |
| Mã bàn | `TV_MãNV` — PHẢI khớp đúng mã bàn (`TC1`, `TV2`...), không phải tên loại |
| Trạng thái | `Trạng thái` — `Tiếp nhận` = đang phục vụ, `Hoàn tất` = xong (bỏ qua khi tính màu, nhưng vẫn cần có dòng — xem lưu ý dưới) |
| Tên khách | `Họ và tên` — join sang `Master_Check in` theo tên để lấy đủ chi tiết |
| NV phụ trách | `Người` (person field) — hiện lên popover "Tên NV" |
| Thời gian | `Thời gian` — sắp thứ tự khi 1 bàn phục vụ nhiều khách cùng lúc |

> ⚠️ **Mọi khách từng được tiếp nhận (kể cả đã "Hoàn tất") đều cần có dòng ở
> đây** — app dùng chính bảng này để biết "khách đã từng xuất hiện chưa" (loại
> khỏi khu "Chờ check-in"). Nếu quy trình Lark của bạn xoá dòng sau khi khách
> xong việc thay vì đổi `Trạng thái` thành "Hoàn tất", khách đó sẽ bị hiện
> nhầm là "chưa từng check-in".

**Bảng `Master Điều phối`** — khách đã được điều phối viên GÁN vào 1 bàn cụ
thể nhưng CHƯA có dòng "Tiếp nhận" tương ứng trong `Master` → nguồn số
"khách đang chờ" hiện ở từng bàn (kể cả bàn đang trống). Cần:

| Ý nghĩa | Tên cột |
| ------- | ------- |
| Tên khách | `Họ và tên` |
| Mã bàn — cụm Kỹ thuật | `DS thu cũ` — chứa mã bàn (vd `TC1`) khi khách được gán vào cụm này |
| Mã bàn — cụm Tư vấn | `DS Tư vấn` — chứa mã bàn (vd `TV3`) khi khách được gán vào cụm này |

Mỗi dòng chỉ có ĐÚNG 1 trong 2 cột mã bàn ở trên khác rỗng (tuỳ khách được
gán cụm nào) — app tự đọc cả 2 cột trên mọi dòng nên không cần cột "Phân
loại" riêng.

**Bảng `Danh sách đơn hàng`**: chỉ cần **số dòng** = tổng khách đăng ký (Số tổng)
cho phễu check-in ở sidebar. Không cần cột cụ thể.

---

## Cách 1 — Proxy / Webhook (khuyến nghị)

Ý tưởng: web **không** gọi thẳng Lark. Bạn dựng 1 endpoint HTTPS (serverless /
Node / Cloudflare Worker…) đứng giữa: nhận request từ web → tự lấy token → gọi
Lark → trả JSON về. Token/secret nằm ở server, an toàn.

### 1.1 Web gọi endpoint như thế nào

App sẽ `GET ${VITE_LARK_API_URL}/<tableKey>` với `tableKey` ∈
`checkin` · `orders` · `master` · `dispatch` — chỉ 4 route này, TẤT CẢ đều
bắt buộc (không còn route tùy chọn nào).

Mỗi endpoint phải trả về đúng **envelope list-records của Lark**:

```json
{ "code": 0, "msg": "success",
  "data": { "items": [ { "record_id": "rec...", "fields": { "TV_MãNV": "TV1", ... } } ],
            "has_more": false, "total": 6 } }
```

### 1.2 Cấu hình web (`.env.local`)

```bash
VITE_LARK_API_URL=https://your-proxy.example.com/api/lark
VITE_LARK_POLL_MS=30000
# để trống app token/direct vars ở cách 2
```

### 1.3 Ví dụ proxy — dùng luôn `cloudflare-worker.js` trong repo

File `cloudflare-worker.js` ở gốc repo đã code sẵn đúng 4 route trên, có cache
token, và tự dò/đổi **wiki node token → app_token thật** (xem cảnh báo dưới) —
deploy bằng `npx wrangler deploy cloudflare-worker.js`, đặt các secret:
`LARK_APP_ID`, `LARK_APP_SECRET`, `LARK_HOST`, `LARK_APP_TOKEN`,
`TB_CHECKIN`, `TB_ORDERS`, `TB_MASTER`, `TB_DISPATCH`.

**Tên biến (Name) trong Cloudflare phải khớp CHÍNH XÁC các tên trên** — lỗi
rất hay gặp là gõ nhầm Name thành giá trị (vd đặt Name = `tblXXXX` thay vì
Name = `TB_CHECKIN`), khi đó code không tìm thấy biến, lỗi im lặng (route trả
rỗng) hoặc 404 tùy tầng lỗi ở đâu. **Không cần** `TB_DS_TRADEIN`/
`TB_DS_CONSULT` nữa (bản cũ trước 2026-08-05) — có thể xoá cho gọn.

⚠️ **Base nhúng trong Wiki**: nếu link bạn lấy `app_token`/table id có dạng
`.../wiki/<token>?table=...` (không phải `.../base/<token>?table=...`), giá
trị sau `/wiki/` là **wiki node token**, KHÔNG PHẢI app_token thật của
Bitable — dùng thẳng sẽ luôn lỗi Lark `NOTEXIST` (code 91402) dù table id
đúng 100%. Worker mẫu trong repo **tự dò và đổi sang app_token thật** (gọi
`wiki/v2/spaces/get_node`) nên bạn cứ dán nguyên token lấy từ URL `/wiki/`
vào `LARK_APP_TOKEN`, không cần tự tra cứu. Nếu bạn tự viết proxy riêng (không
dùng file mẫu), phải tự làm bước dò này.

Nếu muốn tự viết proxy khác (Node/Express…), tham khảo logic trong
`cloudflare-worker.js` — 3 phần chính: lấy `tenant_access_token` (cache
~1h55), dò/đổi wiki token → app_token (cache luôn, không đổi trong suốt vòng
đời base), rồi gọi `bitable/v1/apps/{appToken}/tables/{tableId}/records`.

---

## Cách 2 — Direct API (chỉ để test)

Web gọi thẳng Lark bằng `tenant_access_token`. ⚠️ Token sẽ **lộ trong trình
duyệt**, hết hạn ~2h, và thường **bị CORS** khi gọi từ domain khác. Chỉ dùng để
thử nhanh.

### 2.1 Lấy `app_token` và `table_id`

Mở base trên trình duyệt, URL dạng:

```
https://xxx.larksuite.com/base/<APP_TOKEN>?table=<TABLE_ID>&view=...
                                ^^^^^^^^^^^        ^^^^^^^^^^
```

- `APP_TOKEN` = đoạn sau `/base/`.
- `TABLE_ID` = tham số `table=` (mở lần lượt `Master_Check in`/`Master`/
  `Master Điều phối`/`Danh sách đơn hàng` để lấy 4 id).

⚠️ **Nếu URL của bạn là `.../wiki/<token>?table=...`** (base nhúng trong Lark
Wiki, không phải `.../base/<token>`) thì đoạn sau `/wiki/` là **wiki node
token**, KHÔNG dùng trực tiếp làm `APP_TOKEN` được — chế độ Direct API
(không qua proxy) trong web này KHÔNG tự đổi token wiki→bitable, nên bạn phải
tự lấy app_token thật bằng cách gọi:

```bash
curl "https://open.larksuite.com/open-apis/wiki/v2/spaces/get_node?token=<WIKI_TOKEN>" \
  -H "Authorization: Bearer <tenant_access_token>"
# → data.node.obj_token = app_token thật (chỉ dùng khi data.node.obj_type = "bitable")
```

Dùng `data.node.obj_token` (không phải `<WIKI_TOKEN>`) làm `APP_TOKEN` cho các
bước dưới. Nếu bạn dùng Cách 1 (Proxy) với `cloudflare-worker.js` mẫu trong
repo, bước này được tự làm sẵn — không cần tự gọi API này.

### 2.2 Lấy `tenant_access_token`

1. Vào **Lark Developer Console** → tạo **Custom App**.
2. Lấy `App ID` + `App Secret`.
3. Cấp quyền (Permissions): **`bitable:app:readonly`** (đọc Bitable).
4. Thêm app làm **collaborator** của base (Share → thêm app, quyền xem).
5. Gọi API lấy token (hết hạn ~2h → phải lấy lại):

```bash
curl -X POST https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal \
  -H 'Content-Type: application/json' \
  -d '{"app_id":"cli_xxx","app_secret":"yyy"}'
# → { "tenant_access_token": "t-xxxx", "expire": 7200 }
```

### 2.3 Cấu hình web (`.env.local`)

```bash
VITE_LARK_HOST=https://open.larksuite.com        # hoặc open.feishu.cn (bản CN)
VITE_LARK_APP_TOKEN=<APP_TOKEN>
VITE_LARK_ACCESS_TOKEN=<tenant_access_token>
VITE_LARK_TABLE_CHECKIN=<table_id Master_Check in>
VITE_LARK_TABLE_MASTER=<table_id Master>
VITE_LARK_TABLE_DISPATCH=<table_id Master Điều phối>
VITE_LARK_TABLE_ORDERS=<table_id Danh sách đơn hàng>
VITE_LARK_POLL_MS=30000
```

App tự gọi: `GET {HOST}/open-apis/bitable/v1/apps/{APP_TOKEN}/tables/{TABLE_ID}/records?page_size=500`
với header `Authorization: Bearer {token}`.

---

## 3. Chạy & kiểm tra

```bash
npm install
npm run dev        # hoặc npm run build && npm run preview
```

- Góc phải header đổi từ **"Mock data"** (vàng) sang **"Lark Base (live · 30s)"**
  (xanh) khi có `VITE_LARK_API_URL` hoặc `VITE_LARK_APP_TOKEN`.
- Thấy **"Cập nhật: hh:mm:ss"** → đã đồng bộ thành công; tự làm mới mỗi **30s**.
- Nếu hiện **"Lỗi đồng bộ"** → mở DevTools > Network xem lỗi:
  - **CORS** → dùng Cách 1 (proxy) hoặc bật CORS ở proxy.
  - **404** → proxy chưa có route đó, hoặc route ở tầng Cloudflare (custom
    domain) chưa khớp path — xem mục 1.3.
  - **`NOTEXIST` (code 91402)** → table id sai, hoặc base nhúng trong Wiki mà
    chưa đổi wiki token → app_token — xem cảnh báo ở mục 1.3/2.1.
  - **401/403** → token sai/hết hạn hoặc app chưa được share vào base.
  - **field trống / bàn xám hết** → tên cột không khớp → sửa `larkConfig.ts`.

## 4. Bảo mật

- **Không commit** `.env.local` (đã nằm trong `.gitignore`).
- Production: **luôn** dùng Cách 1 để không lộ `App Secret` / token ra client.
- Đổi `VITE_LARK_POLL_MS` nếu muốn refresh nhanh/chậm hơn 30s.
