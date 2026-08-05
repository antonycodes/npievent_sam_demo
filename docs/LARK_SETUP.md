# Hướng dẫn liên kết dữ liệu từ Lark Base

> **Cập nhật 2026-08-05**: base đã gộp `DS Tư vấn`/`DS thu cũ`/`DS backup`/
> `DS Kho` thành 1 bảng **`DS Master`** (24 dòng — 6 bàn × 4 loại, cột `Loại`
> phân biệt) và `Check in` → **`Master_Check in`** (tên CỘT giữ nguyên 1:1, chỉ
> đổi tên BẢNG). Sơ đồ web vẫn chỉ 2 cụm Kỹ thuật/Tư vấn (11 bàn, không đổi) —
> xem mục 0 dưới để biết cách trỏ 2 route proxy `dsTradein`/`dsConsult` vào
> CÙNG 1 table id (`DS Master`) và lọc theo `Loại` ở phía web.

Dashboard đọc **5 bảng** trong Lark Base (Bitable): `DS Master` (nuôi CẢ 2 cụm
**Kỹ thuật**/**Tư vấn** trên sơ đồ, lọc theo cột `Loại`), `Master_Check in`,
`Danh sách đơn hàng`, và `Master` — log "NV tiếp nhận khách theo bàn", nguồn
xác định khách đang ở bàn nào (mã bàn `TV_MãNV` khớp thẳng bàn trên sơ đồ).
(Không còn cụm Backup trên sơ đồ — dữ liệu Backup/Kho có tồn tại trong `DS
Master`/`Master_Check in`/`Master` nhưng không bàn nào khớp nên bị bỏ qua,
không lỗi. `Master Điều phối` KHÔNG được app đọc — chỉ ảnh hưởng gián tiếp qua
`Sl khách chờ` đã tính sẵn trong `DS Master`.) Có **2 cách** kết nối:

| Cách | Khi nào dùng | Ưu / Nhược |
| ---- | ------------ | ---------- |
| **1. Proxy / Webhook** (khuyến nghị) | Production | Giữ secret ở server, không lộ token, không dính CORS. Cần dựng 1 endpoint nhỏ. |
| **2. Direct API** | Test nhanh nội bộ | Cắm thẳng token vào web. **Lộ token + dính CORS + token hết hạn ~2h** → không nên cho production. |

---

## 0. Chuẩn bị: tên cột phải khớp

App map dữ liệu theo **tên cột hiển thị** trong Lark. Mặc định khớp base hiện
tại (schema "Master", cập nhật 2026-08-05). Nếu base của bạn đặt tên khác →
sửa trong `src/config/larkConfig.ts` (`DEFAULT_DS_FIELDS`,
`DEFAULT_DS_TYPE_FIELD`, `DEFAULT_DS_STATUS_FIELDS`, `DEFAULT_CHECKIN_FIELDS`)
hoặc trực tiếp qua trang **Cài đặt** trong web (không cần sửa code).

**Bảng `DS Master`** (1 bảng, mỗi dòng = 1 bàn, MỌI loại — Tư vấn/Thu cũ/
Backup/Kho — gộp chung) nuôi CẢ 2 cụm trên sơ đồ. Web gọi 2 route proxy
(`dsTradein` cho Kỹ thuật, `dsConsult` cho Tư vấn) — trỏ **CẢ HAI** vào cùng
1 table id của `DS Master` phía proxy, rồi web tự lọc theo cột `Loại`:

| Ý nghĩa | Tên cột (dùng chung) |
| ------- | --------------------- |
| Mã bàn | `STT bàn` |
| Nhân viên | `NV Tư vấn` |
| Đang tiếp nhận | `Sl TV đang tiếp nhận` |
| Hoàn tất | `Sl TV hoàn tất` |
| Khách chờ | `Sl khách chờ` |
| Loại (lọc cụm) | `Loại` — giá trị `Thu cũ` cho Kỹ thuật, `Tư vấn` cho Tư vấn |

**Khối Status** (tên cột không đổi):
`STT gần nhất (helper)` · `Trạng thái gần nhất (helper)` ·
`Khách gần nhất (helper)` · `Trạng thái hiện tại (kết quả chính)`

> `Trạng thái hiện tại` quyết định màu: **"Đang tư vấn"** → Đỏ ·
> **"Rảnh"** → Xanh · **"Chưa có dữ liệu"** → Xám.

**Bảng `Master_Check in`** (trước là `Check in`, tên CỘT giữ nguyên) cần:
`STT` · `Họ và tên` · `SP 1` · `Note UDTT`
(dùng cho số đã check-in + Tên sản phẩm + Ghi chú thanh toán, join theo tên khách).

**Bảng `Master`** — log mỗi lần 1 NV nhận 1 khách tại 1 bàn (khớp đúng luồng
nghiệp vụ: check-in → điều phối → NV tiếp nhận). Cần:

| Ý nghĩa | Tên cột |
| ------- | ------- |
| Mã bàn | `TV_MãNV` — PHẢI khớp đúng mã bàn (`TC1`, `TV2`...), không phải tên loại |
| Trạng thái | `Trạng thái` — `Tiếp nhận` = đang phục vụ, `Hoàn tất` = xong (bỏ qua) |
| Tên khách | `Họ và tên` — join sang `Master_Check in` theo tên để lấy đủ chi tiết |
| Thời gian | `Thời gian` — sắp thứ tự khi 1 bàn phục vụ nhiều khách cùng lúc |

**Bảng `Danh sách đơn hàng`**: chỉ cần **số dòng** = tổng khách đăng ký (Số tổng)
cho phễu check-in ở sidebar. Không cần cột cụ thể.

Mã bàn (`STT bàn`) phải trùng `TC1..TC6 / TV1..TV8` (join key giữ nguyên
"TC"/"TV" dù sơ đồ hiển thị "KT") để khớp 11 node trên sơ đồ — app chỉ dùng
`TC1-TC3` và `TV1-TV8`, các dòng dư (TC4-6, và mọi dòng `Loại`=Backup/Kho) bị
bỏ qua chứ không lỗi.

---

## Cách 1 — Proxy / Webhook (khuyến nghị)

Ý tưởng: web **không** gọi thẳng Lark. Bạn dựng 1 endpoint HTTPS (serverless /
Node / Cloudflare Worker…) đứng giữa: nhận request từ web → tự lấy token → gọi
Lark → trả JSON về. Token/secret nằm ở server, an toàn.

### 1.1 Web gọi endpoint như thế nào

App sẽ `GET ${VITE_LARK_API_URL}/<tableKey>` với `tableKey` ∈
`dsTradein` · `dsConsult` · `checkin` · `orders` · `master` — chỉ 5 route này,
TẤT CẢ đều bắt buộc (không còn route tùy chọn nào).

Mỗi endpoint phải trả về đúng **envelope list-records của Lark**:

```json
{ "code": 0, "msg": "success",
  "data": { "items": [ { "record_id": "rec...", "fields": { "STT bàn": "TV1", ... } } ],
            "has_more": false, "total": 6 } }
```

### 1.2 Cấu hình web (`.env.local`)

```bash
VITE_LARK_API_URL=https://your-proxy.example.com/api/lark
VITE_LARK_POLL_MS=30000
# để trống app token/direct vars ở cách 2
```

### 1.3 Ví dụ proxy — dùng luôn `cloudflare-worker.js` trong repo

File `cloudflare-worker.js` ở gốc repo đã code sẵn đúng 5 route trên, có cache
token, và tự dò/đổi **wiki node token → app_token thật** (xem cảnh báo dưới) —
deploy bằng `npx wrangler deploy cloudflare-worker.js`, đặt các secret:
`LARK_APP_ID`, `LARK_APP_SECRET`, `LARK_HOST`, `LARK_APP_TOKEN`,
`TB_DS_TRADEIN`, `TB_DS_CONSULT`, `TB_CHECKIN`, `TB_ORDERS`, `TB_MASTER`
(`TB_DS_TRADEIN`/`TB_DS_CONSULT` đặt CÙNG 1 giá trị = table id của `DS
Master`). **Tên biến (Name) trong Cloudflare phải khớp CHÍNH XÁC các tên
trên** — lỗi rất hay gặp là gõ nhầm Name thành giá trị (vd đặt Name =
`tblXXXX` thay vì Name = `TB_CHECKIN`), khi đó code không tìm thấy biến,
lỗi im lặng (route trả rỗng) hoặc 404 tùy tầng lỗi ở đâu.

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
- `TABLE_ID` = tham số `table=` (mở lần lượt từng bảng DS Master/Master_Check
  in/Danh sách đơn hàng/Master để lấy 4 id — `dsTradein`/`dsConsult` dùng
  CHUNG 1 id của `DS Master`).

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
VITE_LARK_TABLE_DS_TRADEIN=<table_id DS Master>   # cả 2 dòng dưới trỏ CÙNG 1 id
VITE_LARK_TABLE_DS_CONSULT=<table_id DS Master>   # (web tự lọc theo cột "Loại")
VITE_LARK_TABLE_CHECKIN=<table_id Master_Check in>
VITE_LARK_TABLE_MASTER=<table_id Master>
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
  - **401/403** → token sai/hết hạn hoặc app chưa được share vào base.
  - **field trống / bàn xám hết** → tên cột không khớp → sửa `larkConfig.ts`.

## 4. Bảo mật

- **Không commit** `.env.local` (đã nằm trong `.gitignore`).
- Production: **luôn** dùng Cách 1 để không lộ `App Secret` / token ra client.
- Đổi `VITE_LARK_POLL_MS` nếu muốn refresh nhanh/chậm hơn 30s.
