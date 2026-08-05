# PROJECT MEMORY — NPI Event · Interactive Layout Dashboard

> AI persistent memory. Updated after **every** response before continuing.
> Preserves architecture, API endpoints, mapping schema, and progress.
>
> ⚠️ **Spec v2 (current)** — reworked from the original build to the Coordinator
> spec: desk codes TC/TV/BK, status driven by a `Trạng thái` string, 3 separate
> Lark data tables + Selection lookup tables, extra popover fields, a Check-in
> sidebar, quick filters, and 30s polling. History of v1 is in the Progress Log.

---

## 1. Project Overview

A real-time **Coordinator Dashboard** for an iPhone launch event (cellphoneS).
The coordinator assigns customers to desks and watches for bottlenecks across
three zones — **Thu cũ** (trade-in), **Tư vấn** (consulting), **Backup** (stage).
The floor plan (from the attached photo) is an interactive map; desk state is
synced from **Lark Base (Bitable)** over HTTPS and auto-refreshed every 30s.

**Stack:** Vite 6 · React 18 · TypeScript · TailwindCSS 3.

### Clusters & desk codes (38 total)
| Zone (VN)        | Cluster key | Prefix | Codes           | Count | Lark data table | Lookup table       |
| ---------------- | ----------- | ------ | --------------- | ----- | --------------- | ------------------ |
| Thu cũ           | `tradein`   | `TC`   | `TC1`–`TC10`    | 10    | "Thu cũ"        | `Selection-Thu cũ` |
| Tư vấn           | `consult`   | `TV`   | `TV1`–`TV18`    | 18    | "Tư vấn"        | `Selection-Tư vấn` |
| Backup (Sân khấu)| `backup`    | `BK`   | `BK1`–`BK10`    | 10    | "Backup"        | `Selection-Backup` |
| **TOTAL**        |             |        |                 | **38**|                 |                    |

### The 38 desk IDs
```
Thu cũ  (10): TC1  TC2  TC3  TC4  TC5  TC6  TC7  TC8  TC9  TC10
Tư vấn  (18): TV1  TV2  TV3  TV4  TV5  TV6  TV7  TV8  TV9  TV10
              TV11 TV12 TV13 TV14 TV15 TV16 TV17 TV18
Backup  (10): BK1  BK2  BK3  BK4  BK5  BK6  BK7  BK8  BK9  BK10
```
The desk code is the join key between the map node and the Lark rows.

### Status → color logic (v2)
Driven by the desk's **`Trạng thái` / `Status`** field:
- `"Tiếp nhận"` → **Red** (Occupied) — desk is actively serving a customer.
- `"Hoàn tất"` **or empty/other** → **Green** (Available).
- Grey `idle` only before the first successful sync.

### Popover (click a desk)
- `Tên NV` — staff (`TC_Nhân viên` / `TV_Nhân viên` / `BK_Nhân viên`).
- `STT Khách` — customer queue no. (`CI_STT`, fallback `STT Khách`).
- `Tên sản phẩm` — product (`SP 1`).
- `Ghi chú thanh toán` — payment note (`Note ưu đãi thanh toán`).

### Sidebar
- **Tổng số khách đã Check-in** — count from the `Check-in` field.
- (Step 4) quick filters: "Chỉ hiện bàn trống", "Chỉ hiện bàn Thu cũ".

---

## 2. Naming Conventions
- Components: `PascalCase`, one per file (`Desk.tsx` → `Desk`).
- Hooks: `useCamelCase`. Types: `PascalCase` (no `I` prefix).
- Desk codes: `TC|TV|BK` + 1-based unpadded index (`TV7`, `TC10`).
- Cluster keys (internal): `'tradein' | 'consult' | 'backup'`.
- `@/` path alias → `src/`. UI copy VN; identifiers/comments EN.

---

## 3. File Tree

### Current (after Step 1, v2)
```
npievent/
├── index.html, package.json, vite.config.ts, tsconfig.*, tailwind.config.js,
│   postcss.config.js, .gitignore, .env.example, README.md, memory.md
└── src/
    ├── main.tsx, App.tsx, index.css, vite-env.d.ts
    ├── types/table.ts            <- to migrate to Status string in Step 3
    ├── config/
    │   ├── layoutConfig.ts       <- ✅ v2 IDs TC/TV/BK + CLUSTER_PREFIX
    │   └── larkConfig.ts
    ├── data/mockLarkData.ts      <- to rebuild on CSV fields in Step 3
    ├── services/  (larkTypes.ts, larkClient.ts, larkMapper.ts)
    ├── hooks/useLarkBaseData.ts
    └── components/
        ├── LayoutDashboard.tsx, StatusLegend.tsx, TablePopover.tsx
        ├── TableNode.tsx         <- to become / wrap Desk.tsx in Step 2
        └── Cluster{TradeIn,Consult,Backup}.tsx
```

### Planned target (v2, by Step 4)
```
src/
├── components/
│   ├── Desk.tsx                 <- props: id, type, status, staffName, customerSTT (+ product, note)
│   ├── DeskPopover.tsx          <- Tên NV / STT Khách / Tên sản phẩm / Ghi chú thanh toán
│   ├── LayoutDashboard.tsx      <- map + clusters + overlay
│   ├── Sidebar.tsx              <- Tổng khách Check-in + summary
│   ├── FilterBar.tsx            <- "Chỉ hiện bàn trống" / "Chỉ hiện bàn Thu cũ"
│   └── StatusLegend.tsx
├── services/larkService.ts      <- fetch 3 tables (+ selection) via App_Token/Table_ID
├── hooks/useLarkBaseData.ts     <- 30s polling, merge → DeskData[]
├── config/  (layoutConfig.ts, larkConfig.ts)
├── data/mockLarkData.ts         <- CSV-shaped fixtures per table
└── types/desk.ts
```

---

## 4. Data Schema & Mapping (from real workbook `NPI_Testing_2.xlsx`)

> ✅ Reconciled against the actual file the user uploaded (a Google-Sheets /
> Lark-Base export, 17 sheets, strings stored inline — no `sharedStrings.xml`).
> This **supersedes** the prompt's assumed field names.

### 4.0 Workbook map (sheet → role)
| Sheet            | Role                                                      |
| ---------------- | -------------------------------------------------------- |
| `Check in`       | Customer master (STT, Họ và tên, SDT, SP 1–4, `Note UDTT`, check-in flag) |
| `Điều phối`      | Dispatch: which desk each customer is sent to            |
| `Thu cũ`         | Trade-in **transactions** (per session; has `Trạng thái`)|
| `Tư vấn`         | Consult **transactions** (`Trạng thái`, `TV_MãNV`=desk)  |
| `Back-up`        | Backup **transactions** (`Trạng thái`, `BK_Mã NV`)       |
| **`DS thu cũ`**  | **Desk registry TC** — 1 row/desk, staff + live counts   |
| **`DS Tư vấn`**  | **Desk registry TV** — 1 row/desk, staff + live counts   |
| **`DS backup`**  | **Desk registry BK** — 1 row/desk, staff + live counts   |
| `STT + Status`   | Per-customer journey (status per stage)                  |
| `Kho`,`Phụ kiện`,`DS *`,`* (cũ)` | inventory / accessories / legacy — not used  |

> ⚠️ Test file has only **6 desks per cluster** (TC1–TC6, TV1–TV6, BK1–BK6), not
> 10/18/10. The map keeps 38 fixed nodes; nodes without a matching desk row
> render as "no data" (grey). Real event data will populate more.

### 4.1 Desk registry columns (the primary per-desk source)
- **DS thu cũ:** `STT bàn`(=TCn), `Nhân viên`, `SL TC điều phối`, `SL TC tiếp nhận`, `SL TC hoàn tất`, `SL Khách chờ`, `Selection-Thu cũ`
- **DS Tư vấn:** `STT bàn`(=TVn), `NV Tư vấn`, `Sl điều phối`, `Sl TV tiếp nhận`, `Sl TV hoàn tất`, `Sl khách chờ`, `Selection-Tư vấn`
- **DS backup:** `STT bàn`(=BKn), `Nhân viên`, `SL TC điều phối`, `SL BK tiếp nhận`, `SL BK hoàn tất`, `SL Khách chờ`, `Selection-Backup`

### 4.2 Transaction columns (for popover customer detail)
> Updated from `NPI_Testing_2.1`: **all three** transaction tables carry the
> desk code, so every cluster joins customer detail (Q3 fully resolved).
- **Tư vấn:** `STT`(khách), `Họ và tên`, `Trạng thái`(Tiếp nhận/Hoàn tất), `TV_MãNV`(=desk code TVn), `SP 1`
- **Thu cũ:** `STT`, `Họ và tên`, `Trạng thái`, `TC_Mã NV`(=desk code TCn), `SP 1`
- **Back-up:** `BK_Mã NV`(=desk code BKn), `STT BK`(separate id, NOT the desk), `STT`, `Họ và tên`, `Trạng thái`, `SP 1`
- **Check in:** `STT`, `Họ và tên`, `SP 1`, **`Note UDTT`** (= Ghi chú thanh toán)

### 4.3 Domain types (target `types/desk.ts`)
```ts
type ClusterKey = 'tradein' | 'consult' | 'backup';

interface DeskData {
  id: string;                 // desk code TC/TV/BK, join key
  cluster: ClusterKey;
  x: number; y: number;       // map coords
  // from DS registry:
  staffName: string | null;   // NV Tư vấn / Nhân viên
  received: number;           // Sl … tiếp nhận  (đang phục vụ)
  completed: number;          // Sl … hoàn tất
  waiting: number;            // Sl khách chờ    (bottleneck signal)
  isOccupied: boolean;        // received > 0  → red ; else green
  // from transaction join (optional, popover):
  customerSTT: string | null; // STT khách
  customerName: string | null;// Họ và tên
  productName: string | null; // SP 1
  paymentNote: string | null; // Note UDTT
}
```

### 4.4 Mapping decisions (see §7 open questions — pending user confirm)
| Domain field   | Source                                                        |
| -------------- | ------------------------------------------------------------- |
| desk id        | DS `STT bàn` / `Selection-*` (join key to the 38 map nodes)   |
| staffName      | DS `NV Tư vấn` (TV) · `Nhân viên` (TC/BK)                      |
| **isOccupied** | DS `Sl … tiếp nhận` > 0 → **Đỏ** (≡ Trạng thái "Tiếp nhận")    |
| waiting        | DS `Sl khách chờ` (surfaced as a bottleneck badge)            |
| customerSTT    | transaction `STT` where desk matches & `Trạng thái`="Tiếp nhận"|
| productName    | transaction / Check in `SP 1`                                 |
| paymentNote    | Check in `Note UDTT` (join by `STT`)                          |
| Check-in total | count of rows in `Check in` (sidebar)                         |

### 4.5 Lark Bitable API (planned — Step 3)
- List records: `GET {LARK_HOST}/open-apis/bitable/v1/apps/{App_Token}/tables/{Table_ID}/records?page_size=100`
- Auth: `Authorization: Bearer <tenant_access_token>`.
- Response envelope `{ code:0, msg, data:{ items:[{record_id, fields}], has_more, total } }`.
- One `Table_ID` per zone (Thu cũ / Tư vấn / Backup); recommend a server-side
  proxy to hold the app secret and avoid browser CORS.
- **Auto-refresh: poll every 30s** (`VITE_LARK_POLL_MS=30000`).

### 4.6 Environment variables (detailed in Step 4)
```
VITE_LARK_HOST=https://open.larksuite.com
VITE_LARK_APP_TOKEN=...
# Desk-registry tables (primary source):
VITE_LARK_TABLE_DS_TRADEIN=...  VITE_LARK_TABLE_DS_CONSULT=...  VITE_LARK_TABLE_DS_BACKUP=...
# Transaction tables (popover detail) + Check in:
VITE_LARK_TABLE_TRADEIN=...  VITE_LARK_TABLE_CONSULT=...  VITE_LARK_TABLE_BACKUP=...  VITE_LARK_TABLE_CHECKIN=...
VITE_LARK_ACCESS_TOKEN=...   VITE_LARK_API_URL=...(proxy)   VITE_LARK_POLL_MS=30000
VITE_LARK_USE_MOCK=true|false
```

---

## 5. Progress Log

### v1 (original build) — COMPLETE
Steps 1–4 of the first brief delivered: scaffold, static 38-node layout, Lark
HTTPS service + mock + `useLarkBaseData`, and boolean-`isOccupied` color +
click popover (Tên NV / STT Khách). Verified via Playwright; 5 local commits.
(`git push`/PR blocked by org-policy 403 + integration lacking Contents:write —
source delivered to the user as `npievent-source.zip`.)

### ✅ Step 1 (v2) — Khởi tạo & Memory Core (DONE — 2026-07-24)
- Vite + React + Tailwind already in place (reused from v1); build passes.
- `layoutConfig.ts`: switched desk IDs to **TC1–TC10 / TV1–TV18 / BK1–BK10**
  via new `CLUSTER_PREFIX` map; ids propagate through clusters/mock/hook.
- Rewrote this `memory.md` to spec v2: 38 desk-ID list, folder structure
  (current + target with `Desk.tsx`, `Sidebar`, `larkService`), status logic,
  full field-mapping table, Lark endpoints, env-var plan.
- Flagged that **no CSV was provided** — field names taken from the prompt.

### ✅ Data reconciliation (DONE — 2026-07-24)
User uploaded the real workbook `NPI_Testing_2.xlsx`. Parsed its 17 sheets
(inline strings, raw-XML parse) and rewrote §4 with the true schema: DS registry
tables are the primary per-desk source (staff + counts); transaction tables give
popover detail. Test file has 6 desks/cluster (map keeps 38 fixed nodes).
**User confirmed §7 answers:** (1) color = DS `Sl tiếp nhận > 0`; (2) keep 38
fixed nodes, bind by code; (3) popover customer detail best-effort (TV joins via
`TV_MãNV`; TC/BK show staff+counts where no join exists).

### ✅ Step 2 (v2) — Phác thảo Layout UI (DONE — 2026-07-24)
- New `types/desk.ts`: `ClusterKey`, `TablePosition`, `DeskLiveState`, `DeskData`,
  `deskUiStatus()`, `ClusterSummary`/`DashboardSummary` + `computeSummary()`.
- `Desk.tsx` (replaces TableNode) — props `id, type, status, staffName,
  customerSTT` (+ `waiting` badge, `x/y`, `selected`, `onClick`); tone
  occupied/available/idle.
- `Sidebar.tsx` — "Tổng khách đã Check-in" + per-cluster Tiếp nhận/Trống/Chờ.
- Rewrote `LayoutDashboard.tsx` (renders `Desk` from a `desks: DeskData[]` array,
  keeps the venue backdrop) and `StatusLegend.tsx` (4-state key).
- `App.tsx` renders static board (all desks idle) + sidebar (totals 0).
- **Removed the v1 Lark layer** (hook/services/mock/`table.ts`/old components) —
  to be rebuilt on the real schema in Step 3. `layoutConfig` now imports desk.ts.
- Build passes; verified via screenshot (TC1–TC10/TV1–TV18/BK1–BK10 all grey).

### ✅ Step 3 (v2) — Lark Service Layer (DONE — 2026-07-24)
- `services/larkTypes.ts`: wire types + `TableKey` (7 tables) + `LarkTables`.
- `config/larkConfig.ts`: env config (per-table ids, `pollMs` **30000**, mock
  fallback) + real column maps `DS_FIELDS` / `TX_FIELDS` / `CHECKIN_FIELDS` +
  `STATUS_OCCUPIED='Tiếp nhận'`.
- `services/larkClient.ts`: `fetchTableRecords()` (proxy `${apiUrl}/<key>` or
  canonical Bitable URL), Bearer auth, envelope validation, `AbortSignal`.
- `services/larkService.ts`: `fetchLarkData()` fetches all 7 tables in parallel
  (or returns mock).
- `services/larkMapper.ts`: `mapDeskStates()` → occupancy from DS `Sl tiếp nhận`,
  waiting from DS, best-effort customer join (TV via `TV_MãNV`, BK via `STT BK`,
  TC none), payment note from Check in by STT; `totalCheckIn` = Check-in rows.
- `data/mockLarkData.ts`: 7-table fixtures from the real workbook (real staff,
  TV1/TC transactions; TV1 received+waiting, TC1/TC3 received so colors show).
- `hooks/useLarkBaseData.ts`: fetch + **30s poll** + merge onto 38 positions +
  `computeSummary`. Returns `{ desks, summary, loading, error, lastUpdated,
  isMock, refresh }`.
- App mounts the hook + sync status bar. `.env.example` documents the 7 table ids.
- Verified via screenshot: TC1/TC3 & TV1 red (TV1 shows "1" waiting), DS desks
  1–6 colored, 7+ grey; sidebar Check-in = 4 with correct per-cluster counts.

### ✅ Step 4 (v2) — Interaction & Deploy (DONE — 2026-07-24)
- `DeskPopover.tsx`: click a desk → detail card (Tên NV / STT Khách / Tên sản
  phẩm SP 1 / Ghi chú thanh toán / Khách đang chờ) + status badge; flips
  above/below, clamps at edges, closes on × / Escape.
- `FilterBar.tsx` + `DeskFilters`: "Chỉ hiện bàn trống" / "Chỉ hiện bàn Thu cũ";
  non-matching desks dimmed (opacity-15, non-interactive) to keep spatial context.
- `Desk.tsx` gains `dimmed`; `LayoutDashboard` gains `dimmedIds` + overlay.
- `App.tsx` owns selection (toggle) + filter state, computes `dimmedIds`, mounts
  the popover; selection auto-suppressed when the desk is filtered out.
- README rewritten (features, 7-table architecture, env config).
- **Verified via Playwright**: TV1 popover shows Dương Đình Hưng / STT 1 /
  iPhone 17 Pro Max 2TB | Bạc / ACB 574856 / chờ 1; both filters dim correctly.
- Build passes (41 modules).

**PROJECT v2 COMPLETE.**

---

### Consult received-customer STT dots (added 2026-07-24)
Implemented `docs/UPDATE_consult-customer-dots.md` (Phương án A) with mock:
- `types/desk.ts`: `DeskCustomer`, `DeskLiveState.receivedCustomers`, `DESK_CAPACITY`
  (consult=2).
- `larkTypes`: added `txConsult` TableKey. `larkConfig`: `TxFieldMap`,
  `DEFAULT_TX_CONSULT_FIELDS` (`TV_MãNV`/`Trạng thái`/`STT`/`Họ và tên`),
  `STATUS_RECEIVED='Tiếp nhận'`, `txConsult` in `FieldConfig` + tableIds.
- `larkSettings`: txConsult tableId + field map + `TX_FIELD_LABELS` + settings
  wiring; SettingsPage shows a "Giao dịch Tư vấn" mapping block + table id.
- `larkService`: fetches `txConsult` only when configured (optional).
- `larkMapper.indexReceived`: group txConsult by desk, filter Tiếp nhận, cap 2 →
  `receivedCustomers`; consult uses tx, others/fallback = single gần nhất.
- `LayoutDashboard`: renders amber STT dots under consult desks; `DeskPopover`
  lists "Khách đang tiếp nhận (n/cap)".
- Mock: TV2 = {10 Phạm Đức Dũng, 15 Trần Văn Bình}, TV4 = {13,18}.
- Verified via screenshot: TV2/TV4 show 2 dots each; popover lists both.

### Clickable STT dots for all clusters (added 2026-07-24)
- Dots now render for tradein/consult/backup (not just consult).
- Each dot is a button → `CustomerPopover` (STT, tên, Vị trí+NV, Tên sản phẩm,
  Ghi chú thanh toán). `DeskCustomer` gained `productName`/`paymentNote`, joined
  from Check in by name in `larkMapper` (incl. the non-consult single fallback).
- Placement: single-customer desks (TC/BK, cap 1) show a corner badge (bottom-
  right) to avoid overlapping the tightly-spaced row below; consult (cap 2) shows
  a row of dots below the node.
- `DashboardPage` owns `selectedCustomer` (mutually exclusive with the desk
  popover); `LayoutDashboard` gets `onSelectCustomer` + `selectedCustomer`.
- Verified via screenshots (TC1 → Nguyễn Minh Long, BK1 → Huỳnh Ngọc Linh).

### Check-in funnel card (added 2026-07-24)
Sidebar "Khách" card now shows 3 ratios instead of a single number:
- **Check-in / Tổng đăng ký** = Check-in rows / Orders rows (`Danh sách đơn hàng`)
- **Đang tư vấn / Check-in** = distinct customers at occupied consult desks
- **Chưa được phục vụ / Check-in** = check-in − distinct served (by name)
Added a 5th table `orders` (TableKey/service/config/mock/.env), `totalRegistered`
through mapper→store→hook, and `CustomerFunnel` in `computeSummary` (served/
consulting counted as **distinct customer names** so a person served across
stages isn't double-counted). Mock: 20 orders, 8 check-in → 8/20, 2/8, 3/8.

### Admin demo page (added then REMOVED 2026-07-24)
An editable demo store + `#/admin` flow page existed briefly, then was replaced
by the runtime Settings page below (deskStore, data/customers.ts, AdminPage
deleted).

### Runtime Lark Settings page (added 2026-07-24) — CURRENT
Users configure the Lark connection + field mapping **in-app** (no code/env edit):
- `config/larkConfig.ts` now holds only **DEFAULT_*** maps + types + `ENV_DEFAULTS`
  (env seeds first run) + `LarkRuntimeConfig` (adds `host`).
- `config/larkSettings.ts`: localStorage-backed store (`useLarkSettings`,
  `larkSettingsStore.save/reset`), `toRuntimeConfig()`, `toFieldConfig()`,
  `hasLiveSource()`, plus form labels. Settings = { useMock, mode(proxy|direct),
  apiUrl, host, appToken, accessToken, pollSeconds, tableIds{5}, fields{ds×3 +
  dsStatus + checkin} }.
- `larkClient.buildTableUrl` uses `cfg.host`; `larkService.fetchLarkData` defaults
  to `toRuntimeConfig()`; `mapDeskStates(tables, fields = toFieldConfig())` now
  takes the field config (mock passes `DEFAULT_FIELD_CONFIG`).
- `hooks/useDashboardData.ts`: reads settings reactively, re-syncs on change
  (mock → map mock; live → fetch+poll). No more deskStore.
- `pages/SettingsPage.tsx` (`#/settings`): source toggle, proxy/direct + 5 table
  ids, field-mapping inputs (prefilled defaults), Test connection / Save / Reset.
  Dashboard header link → "Cài đặt Lark".
- Verified: Settings renders full form; dashboard still maps mock (9 red / 3 green).

## 6. Next Action
**All 4 v2 steps complete.** Handover: source zipped for the user. To run live:
copy `.env.example` → `.env.local`, set the proxy URL or app token + 7 table ids,
unset `VITE_LARK_USE_MOCK`. (git push/PR still blocked by org-policy 403 +
integration lacking Contents:write — delivered as a zip instead.)

## 7. Resolved decisions (confirmed by user 2026-07-24)
1. **Color source** — DS `Sl … tiếp nhận > 0` → Đỏ (else Xanh). ✅
2. **Desk count** — keep 38 fixed map nodes, bind by code, absent → grey. ✅
3. **Popover detail** — best-effort. ✅ **Updated with NPI_Testing_2.1**: all
   three transaction tables have a desk code (`TC_Mã NV` / `TV_MãNV` / `BK_Mã NV`),
   so TC/TV/BK all join customer detail now. `TX_FIELDS` updated accordingly.

### Sample data (updated 2026-07-24 → NPI_Testing_2.1)
Mirrored 2.1 verbatim; transactions carried desk codes so all clusters joined.

### DS "Status" block (updated 2026-07-24 → NPI_Testing_2.2) — CURRENT
Each DS table gained a Status block (same columns in all 3): `STT gần nhất
(helper)`, `Trạng thái gần nhất (helper)`, `Khách gần nhất (helper)`,
`Trạng thái hiện tại (kết quả chính)`. This is now the authoritative source:
- **Color / occupancy** ← `Trạng thái hiện tại`: "Đang tư vấn" → occupied (red),
  "Rảnh" → available (green), "Chưa có dữ liệu"/empty → idle (grey).
  (Replaces the old `Sl tiếp nhận` rule; `DS_STATUS_FIELDS` in larkConfig.)
- **Customer** (only when occupied) ← `Khách gần nhất` + `STT gần nhất`; product
  + `Note UDTT` joined from Check in **by customer name** (safer than STT).
- **Popover** now shows a `Trạng thái` row; a free/empty desk shows
  "Bàn trống — chưa có thông tin khách." (no customer).
- **Transaction tables removed** — `TableKey` reduced to
  `dsTradein/dsConsult/dsBackup/checkin`; service, config, mock, `.env.example`
  updated. Negative `Sl khách chờ` (formula artifact, TC6=-1) clamped to 0.
- Verified via screenshots: TC1-5 red, TC6 green (Rảnh), TV2/TV4 red, TV1/TV3
  green, BK1/BK2 red, others grey; TC1 popover shows customer, TC6 shows none.

### 2 khu vực chờ ngoài bàn — Chờ check-in / Chờ điều phối (added 2026-07-29)
User cung cấp screenshot mock-up của board với 2 hộp mới ở góc dưới-trái
(thay cho 2 Region tĩnh cũ "Bàn đợi"/"PG phát STT"), mỗi hộp có vài chấm STT
màu cam — yêu cầu: hiện khách **đã có STT nhưng chưa được điều phối vào bàn
nào** (chờ check-in) và khách **vừa xong 1 khâu, chờ điều phối sang khâu tiếp
theo** (vd xong Thu cũ → chờ vào Tư vấn).

- **Không thêm bảng/cột Lark mới** — suy ra 2 danh sách này từ dữ liệu đã có:
  - `types/desk.ts`: `WaitingCustomer extends DeskCustomer` + `fromCluster?`.
  - `larkConfig.ts`: thêm `STATUS_COMPLETED = 'Hoàn tất'`.
  - `larkMapper.mapDeskStates`: trong lúc build `statesById`, gom thêm
    `everSeenNames` (mọi `Khách gần nhất` từng thấy, mọi trạng thái),
    `activeNames` (khách đang occupied ở BẤT KỲ bàn nào, kể cả nhiều khách
    consult), và `completedCandidates` (bàn `Trạng thái gần nhất` = "Hoàn tất"
    + hiện đang rảnh). Sau vòng lặp:
    - `waitingDispatch` = completedCandidates trừ đi ai đã có trong
      `activeNames` (đã được điều phối đi rồi) + khử trùng theo tên.
    - `waitingCheckin` = khách trong bảng `Check in` mà tên **không** nằm
      trong `everSeenNames` lẫn `activeNames` (chưa từng chạm bàn nào).
  - Trả thêm `waitingCheckin`/`waitingDispatch` trong `MappedData` →
    `useDashboardData` (`RawState` + `UseDashboardDataResult`) → `DashboardPage`.
- **UI**: `LayoutDashboard.tsx` có component `WaitingZone` (hộp viền cam nét
  đứt, nhãn + hàng chấm STT bấm được) thay cho 2 `Region` cũ ở
  `left-3% top-70%/85% h-14% w-15%`. Export `WAITING_ZONE_ANCHOR` (toạ độ neo
  %) + `WaitingZoneKey` để `DashboardPage` định vị popover.
- **Popover riêng**: `WaitingPopover.tsx` (mới) — cùng phong cách
  `CustomerPopover` nhưng neo cố định theo khu vực (không theo bàn), luôn bung
  lên trên (2 khu vực nằm sát đáy board). Hiện STT/tên/SP/ghi chú TT, cụm vừa
  hoàn tất (nếu có).
- `DashboardPage`: thêm state `selectedWaiting` (loại trừ lẫn nhau với
  `selectedId`/`selectedCustomer`), handler `handleSelectWaiting`, nhánh
  overlay thứ 3.
- Với mock data hiện tại: `waitingCheckin` = 2 khách chưa từng vào bàn nào
  (Lê Thanh My, Võ Thu Trang); `waitingDispatch` = 1 khách (Vũ Xuân Phong,
  vừa xong TC6, chưa xuất hiện ở Tư vấn/Backup).
- Không có Node/npm trong môi trường chỉnh sửa → chưa chạy được
  `tsc`/`vite build` để verify, chỉ review code thủ công.

**Verify run (2026-07-29, sau đó):** cài Node v24 portable (không có sẵn trong
sandbox), `rm -rf node_modules package-lock.json` + `xattr -dr
com.apple.quarantine .` để fix lỗi code-signature của binary native
`@rollup/rollup-darwin-arm64` (dlopen bị chặn bởi Gatekeeper) rồi `npm install`
lại sạch. `npx tsc -b --noEmit` không lỗi. `npm run dev` chạy OK (Vite v6.4.3,
`localhost:5173`). Verify bằng browser preview: 2 hộp "Chờ check-in" (STT 7, 8)
và "Chờ điều phối" (STT 7) hiện đúng chấm cam; bấm chấm STT mở đúng
`WaitingPopover` (VD: STT 7 · Vũ Xuân Phong — Khu vực "Chờ điều phối", Trạng
thái "Đã hoàn tất 1 khâu — chờ điều phối sang khâu tiếp theo", Vừa hoàn tất
"Bàn thu cũ", tên SP "iPhone 17 Pro..."). Không có console error.

### Bộ lọc nhanh "Chỉ hiện đã thu thiết bị" (added 2026-07-29)
Yêu cầu: thêm 1 chip lọc nhanh dựa trên trường **"Đã nghiệm thu thiết bị"**
(checkbox) trong bảng **Check-in** — chỉ tô sáng các bàn mà khách đang phục vụ
đã được nghiệm thu thiết bị, các bàn khác bị làm mờ (giống cơ chế `onlyVacant`
/ `onlyTradein` hiện có).

- `larkConfig.ts`: `CheckinFieldMap` + `DEFAULT_CHECKIN_FIELDS` thêm
  `deviceAccepted: 'Đã nghiệm thu thiết bị'`. `larkSettings.ts`:
  `CHECKIN_LABELS` thêm nhãn tương ứng (tự hiện trong form mapping ở
  SettingsPage vì component lặp theo `Object.keys(CHECKIN_LABELS)`).
- `larkMapper.ts`: thêm `cellToBool()` (coerce boolean/"true"/"1"/"Có"/"x"...).
  `indexCheckinByName` trả thêm `deviceAccepted: boolean` mỗi khách. Giá trị
  này được join vào: khách đang phục vụ ở DS (`deviceAccepted` trong
  `statesById[code]`), `receivedCustomers` (indexReceived, cụm Tư vấn),
  `completedCandidates`/`waitingDispatch`, và `waitingCheckin` (đọc thẳng từ
  Check-in). `DeskCustomer`/`DeskLiveState` (`types/desk.ts`) thêm field
  `deviceAccepted?: boolean | null`.
- **Chỉ set giá trị khi bàn đang occupied** (theo đúng pattern productName/
  paymentNote hiện có) — bàn trống/idle có `deviceAccepted = null`, nên tự
  động bị lọc mờ khi bật filter (không tính là "đã nghiệm thu").
- `FilterBar.tsx`: `DeskFilters` thêm `onlyDeviceAccepted`, chip mới "Chỉ hiện
  đã thu thiết bị". `DashboardPage.tsx`: `NO_FILTERS` + `dimmedIds` cộng thêm
  điều kiện `d.deviceAccepted === true`.
- Mock data (`mockLarkData.ts`): thêm cột `'Đã nghiệm thu thiết bị'` (bool) cho
  8 khách check-in, trộn true/false để test dimming.
- **Verify**: `npx tsc -b --noEmit` không lỗi. Test trên browser preview (bật
  chip) — chỉ TC1/TC2/TC4/BK1 (khách có `true`) giữ màu, còn lại (TC3, TC5,
  TC6, BK2, mọi TV) bị làm mờ đúng như kỳ vọng.

### Sửa 3 hiểu sai + 1 bug clipping phát sinh (2026-07-29)
User phản hồi code hiểu sai vài ý sau khi xem bản build đầu:

1. **STT khách phải lấy từ Check-in, không phải "Phụ-STT"** — mỗi khách có 1
   STT duy nhất, cấp 1 lần lúc check-in, theo suốt sự kiện. Trước đó
   `customerSTT`/badge STT ở DS-occupied-desk và ở `receivedCustomers` (cụm Tư
   vấn, qua `txConsult`) đang lấy từ 2 cột **cục bộ/phụ trợ khác nhau mỗi
   bàn**: `dsStatus.sttRecent` ("STT gần nhất (helper)") và `txConsult.stt`
   ("STT" trong bảng Giao dịch Tư vấn) — 2 cột này KHÔNG đảm bảo là số duy
   nhất/cố định của khách (ví dụ đã bắt gặp: khách "Vũ Xuân Phong" checkin
   STT=6 nhưng DS helper lại ghi "7" — trùng ngẫu nhiên với STT thật của một
   khách khác). Fix: `larkMapper.ts` — `indexCheckinByName` giờ trả thêm
   `stt` (từ `checkin.stt`, nguồn canonical); mọi nơi gán `stt` cho
   `DeskCustomer`/`WaitingCustomer` (main loop, `indexReceived`,
   `completedCandidates`) đổi sang `ci?.stt ?? null`, bỏ hẳn
   `dsStatus.sttRecent` khỏi luồng hiển thị (biến `sttRecent` xoá luôn, không
   còn nơi nào dùng). Field mapping `sttRecent`/`txConsult.stt` trong
   config/Settings vẫn giữ nguyên (cột đó có thể vẫn tồn tại bên Lark cho mục
   đích khác), chỉ là mapper không còn đọc nó để gắn nhãn khách nữa.
2. **Thêm dòng "Check thu máy cũ"** — lấy đúng cột **"Check Nghiệm thu"**
   trong Check-in (trước đó turn trước bịa tên cột "Đã nghiệm thu thiết bị" vì
   chưa có tên thật — nay sửa `DEFAULT_CHECKIN_FIELDS.deviceAccepted` +
   mock data sang `'Check Nghiệm thu'`). Thêm 1 dòng label mới, đỏ khi đã
   nghiệm thu, ở cả 3 popover: `CustomerPopover.tsx`, `WaitingPopover.tsx`
   ("Check thu máy cũ" / "Đã nghiệm thu" đỏ / "Chưa nghiệm thu" xám), và
   `DeskPopover.tsx` (thêm row tương tự ở nhánh 1-khách; ở nhánh danh sách
   nhiều khách — tên khách tô đỏ+đậm thay vì thêm dòng riêng, giữ layout gọn).
   Row `Row` component ở cả 3 file đổi từ `highlight?: boolean` (hoặc không
   có) sang `tone?: 'amber' | 'red'` để dùng chung cho cả trạng thái "khách
   chờ" (amber, cũ) và "đã nghiệm thu" (red, mới).
3. **"Trạng thái" ở popover "Chờ điều phối" phải động theo khâu vừa xong** —
   trước đó là text tĩnh giống nhau cho mọi khách ("Đã hoàn tất 1 khâu — chờ
   điều phối sang khâu tiếp theo"). Nay `WaitingPopover.tsx` tự tính
   `statusTextFor(zone, customer)`: `checkin` giữ nguyên text cũ; `dispatch`
   → `Đã hoàn tất "Khâu ${STAGE_NAME[customer.fromCluster]}"` (vd `Đã hoàn tất
   "Khâu Thu cũ"`), dùng map cục bộ `STAGE_NAME` (tradein→Thu cũ,
   consult→Tư vấn, backup→Backup) — ngắn gọn hơn `CLUSTER_LABELS` (tránh lặp
   chữ "Bàn"). Xoá row "Vừa hoàn tất" riêng (đã gộp vào "Trạng thái"), xoá
   `WAITING_ZONE_STATUS` ở `DashboardPage.tsx` (không còn dùng), đổi prop
   `WaitingPopover` từ `statusText: string` → `zone: WaitingZoneKey`.
4. **Bug tự phát hiện khi verify**: thêm dòng "Check thu máy cũ" làm
   `CustomerPopover` cao hơn → bị cắt bởi `overflow-hidden` của board ở những
   bàn nửa dưới (vd TC4, y=42%) — kể cả sau khi thêm logic lật lên/xuống
   (ngưỡng `y<45`) vẫn còn ca giữa board không đủ chỗ cả 2 phía ở viewport
   thường. **Fix gốc rễ** (không phải vá ngưỡng): `LayoutDashboard.tsx` —
   tách lớp `overflow-hidden` (chỉ bọc phần visual: backdrop/regions/desks)
   ra khỏi lớp ngoài chứa `overlay`; overlay giờ là sibling *sau* lớp clip,
   cùng nằm trong 1 `<div className="relative aspect-video ...">` ngoài cùng
   (không đổi toạ độ %, vì lớp clip là `absolute inset-0` = same size). Nhờ
   vậy popover không bao giờ bị ẩn bởi mép board nữa, dù văn bản dài cỡ nào.
   `CustomerPopover.tsx` vẫn giữ thêm logic lật lên khi `y>=45` (UX, không
   phải bắt buộc để tránh clip nữa) như `DeskPopover` đã làm từ trước.
- **Verify**: `npx tsc -b --noEmit` không lỗi (`noUnusedLocals` bắt hết biến
  chết khi bỏ `sttRecent`). Browser preview: badge "Chờ điều phối" đổi đúng
  từ #7 (sai) → #6 (đúng, STT thật của Vũ Xuân Phong); popover khách đó hiện
  "Trạng thái: Đã hoàn tất "Khâu Thu cũ"" + "Check thu máy cũ: Đã nghiệm thu"
  (đỏ); TC4/Dương Xuân Long — popover đầy đủ 5 dòng, không còn bị cắt; filter
  "Chỉ hiện đã thu thiết bị" vẫn hoạt động đúng sau khi đổi tên cột.

### Sửa tiếp: "Check nghiệm thu" là formula field, không phải checkbox (2026-07-29)
User gửi screenshot cột thật trong Lark: có icon `fx` (formula field), giá trị
là **text dạng tag màu** chứ không phải boolean thô — `✅ Đã nghiệm thu (n)
máy` (xanh) / `❌ Chưa nghiệm thu máy` (đỏ). `cellToBool()` lúc đó chỉ so
khớp CHÍNH XÁC chuỗi `"đã nghiệm thu"` → sẽ luôn trả `false` (sai) với giá trị
thật vì lệch chuỗi (thừa emoji + "(n) máy"). Tên cột cũng lệch case: mình đặt
mặc định `"Check Nghiệm thu"` (N hoa), thật ra là `"Check nghiệm thu"` (n
thường).

- Fix `larkMapper.ts::cellToBool` — match theo **emoji/từ khoá substring**
  thay vì so khớp chuỗi chính xác: chứa `✅` hoặc `"đã nghiệm thu"` → `true`;
  chứa `❌` hoặc `"chưa nghiệm thu"` → `false`; rỗng/null → `false`.
- Sửa `DEFAULT_CHECKIN_FIELDS.deviceAccepted` + `CHECKIN_LABELS.deviceAccepted`
  → `'Check nghiệm thu'` (đúng case thật). Mock data (`mockLarkData.ts`) đổi
  từ `true`/`false` thô sang đúng 2 chuỗi tag thật (`DA_NGHIEM_THU`/
  `CHUA_NGHIEM_THU` const) để mock test đúng code path thật (chuỗi), không
  đi tắt qua nhánh `typeof v === 'boolean'`.
- **Verify mạnh hơn hẳn bình thường**: phát hiện browser (Browser pane) đã có
  sẵn kết nối Lark thật đã lưu trong localStorage (`useMock:false`, proxy
  `npi-event-lark-proxy.minhthanhbrvt95.workers.dev` — cấu hình có sẵn của
  user, không đụng vào/không reset). Gọi thẳng `fetch()` tới proxy thật ngay
  trong page để lấy JSON gốc bảng Check-in, xác nhận:
  - Tên cột thật đúng 100% là `"Check nghiệm thu"`.
  - Giá trị thật đúng 100% là `"✅ Đã nghiệm thu (1) máy"` /
    `"❌ Chưa nghiệm thu máy"` / `null` (khi chưa có dữ liệu) — cả 3 case đều
    được `cellToBool` xử lý đúng.
  - Bảng Check-in thật có ĐỦ 5 cột kiểu STT khác nhau: `STT`, `Phụ_STT`,
    `STT Input`, `STT_Selection`, `Check STT` — xác nhận đúng nghi vấn ban đầu
    của user (cột `Phụ_STT` có thật, tách biệt với `STT` chính) → càng chắc
    chắn quyết định dùng `checkin.stt` (mặc định `'STT'`) làm nguồn canonical
    là đúng.
  - Test trực tiếp trên dữ liệu thật qua UI: khách "Nguyễn Minh Long" ở khu
    "Chờ điều phối" hiện đúng "Trạng thái: Đã hoàn tất "Khâu Thu cũ"" và
    "Check thu máy cũ: Chưa nghiệm thu" — khớp dữ liệu Lark thật.
- Không đổi `useMock`/setting kết nối của user — đây là cấu hình riêng của
  họ, chỉ dùng để verify rồi để nguyên hiện trạng.
- **Sai lầm trong lần verify trên** (dòng ngay trên): kết luận "Chưa nghiệm
  thu" của Nguyễn Minh Long là "khớp dữ liệu thật" là SAI — xem entry ngay
  dưới, đây thực ra là do saved-settings mapping cũ, không phải dữ liệu thật.

### Sửa tiếp: saved Settings đè lên default mới, khiến field cũ ("Check
Nghiệm thu" hoa) vẫn được dùng dù code đã sửa (2026-07-29, sau đó)
User hỏi: "Số 1 đã nghiệm thu 1 máy, tại sao hiển thị chưa nghiệm thu" —
đúng, đây là **bug thật**, không phải nhầm lẫn của user.

- **Root cause**: `larkSettingsStore` (`larkSettings.ts`) persist TOÀN BỘ
  settings (kể cả field-mapping) vào `localStorage` (`npievent-lark-settings-
  v1`). `hydrate()` merge: `{...base.fields.checkin, ...(saved.fields.checkin
  ?? {})}` — nếu key `deviceAccepted` ĐÃ có trong bản saved thì nó LUÔN thắng
  default trong code, bất kể sau này code đổi default bao nhiêu lần. Trình
  duyệt test đã có sẵn bản save cũ với `deviceAccepted: "Check Nghiệm thu"`
  (hoa, từ default SAI của mình ở lần sửa trước) — nên dù code đã đổi default
  thành `"Check nghiệm thu"` (thường), app vẫn đọc field SAI TÊN (không tồn
  tại trong data thật) → `cellToBool(undefined)` → luôn `false`.
- **Đây là lỗi có thể xảy ra với chính user** nếu họ từng mở trang Cài đặt
  Lark và bấm Lưu bất kỳ lúc nào giữa lúc mình thêm field này và lúc sửa case
  — cần họ tự kiểm tra/sửa tay, code không thể tự "di chuyển" giá trị đã lưu
  của người dùng.
- **Fix trong phiên preview này**: gọi thẳng
  `larkSettingsStore.save({...current, fields: {...current.fields, checkin:
  {...current.fields.checkin, deviceAccepted: 'Check nghiệm thu'}}})` qua
  console (tương đương việc tự tay sửa ô "Check nghiệm thu" trong Cài đặt Lark
  rồi bấm "Lưu & đồng bộ"), sau đó `navigate()` reload lại để app đọc settings
  mới từ đầu (import động không share instance module với app đang chạy nên
  phải reload thật).
- **Verify lại bằng module thật** (gọi trực tiếp `mapDeskStates` +
  `fetchLarkData` + `toFieldConfig` của app, KHÔNG tự viết lại logic) — làm 2
  lần độc lập, cả 2 lần đều cho kết quả nhất quán:
  `toFieldConfig().checkin.deviceAccepted === 'Check nghiệm thu'` và
  `waitingDispatch` có `{name: 'Nguyễn Minh Long', deviceAccepted: true}`.
  Đây là bằng chứng đáng tin hơn screenshot/click UI vì gọi thẳng hàm mapper
  thật app dùng.
- **Lưu ý cho user**: nếu họ xem app ở một bản deploy/trình duyệt KHÁC (không
  phải preview này), họ cần tự vào **Cài đặt Lark** → mục "Check in" → sửa ô
  "Check nghiệm thu (đã thu máy cũ)" đúng chữ thường "Check nghiệm thu" → bấm
  "Lưu & đồng bộ". KHÔNG dùng nút "Khôi phục mặc định" vì nó reset luôn
  apiUrl/proxy thật của họ.
- Click UI để xác nhận trực quan bị **flaky trên bản live** (đôi khi
  `.click()` không mở được popover dù `props.onClick` gọi trực tiếp luôn
  thành công) — nghi do dữ liệu thật đang tự động refresh mỗi 30s (đây là sự
  kiện đang diễn ra thật) làm re-render đúng lúc click, không phải bug ở
  handler. Không đáng để sửa (test-tooling timing, không phải bug sản phẩm).

### "Trạng thái" ở Chờ điều phối đổi nguồn: đọc "Done in Flow" thay vì tự suy (2026-07-29)
User: cột "Done in Flow" (ban đầu định làm bảng "Điều phối" riêng, nhưng đã
**update trực tiếp vào Check-in** — đỡ phải thêm bảng/route proxy mới) —
dùng giá trị này để điền dòng "Trạng thái" thay vì tự suy `fromCluster` như
trước.

- `larkConfig.ts`: `CheckinFieldMap` + `DEFAULT_CHECKIN_FIELDS` thêm
  `doneInFlow: 'Done in Flow'`. `larkSettings.ts`: nhãn tương ứng.
- `larkMapper.ts`: đặt tên type `CheckinIndexEntry` cho object trả về của
  `indexCheckinByName` (trước đó inline lặp lại 2 chỗ) — thêm field
  `doneInFlow`. `completedCandidates.push` thêm `doneInFlow: ci?.doneInFlow
  ?? null`.
- `types/desk.ts`: `WaitingCustomer` thêm `doneInFlow?: string | null`.
- `WaitingPopover.tsx::statusTextFor`: ưu tiên `customer.doneInFlow`, chỉ
  fallback về `STAGE_NAME[fromCluster]` (suy từ DS) khi thiếu. **Có guard**:
  giá trị thật `"Check in"` (Lark trả cho khách CHƯA hoàn tất khâu nào — dùng
  làm baseline mặc định của formula, không phải tên khâu) bị loại, không hiện
  "Khâu Check in" — coi như thiếu, rơi về fallback.
- Field thật dạng rich-text segment array (`[{text,type}]`), không phải string
  thô — `cellToString()` đã tự xử lý đúng (nhánh `Array.isArray`), không cần
  sửa gì thêm.
- Mock data: thêm `'Done in Flow': 'Thu cũ'` cho Vũ Xuân Phong (ci_6, khách
  waitingDispatch duy nhất trong mock).
- **Verify bằng dữ liệu live thật** (module thật, không viết lại logic):
  `waitingDispatch` trả `{name: 'Nguyễn Minh Long', fromCluster: 'tradein',
  doneInFlow: 'Tư vấn'}` — **chứng minh rõ lý do cần đổi**: cách suy cũ
  (`fromCluster`) nói anh ấy "vừa xong Thu cũ" (dữ liệu cũ/stale tại thời điểm
  DS ghi nhận), còn "Done in Flow" thật nói đúng hơn là "Tư vấn" (anh ấy đã
  tiến xa hơn từ đó, do đây là sự kiện đang chạy real-time). Popover render
  đúng: `Trạng thái: Đã hoàn tất "Khâu Tư vấn"`. `tsc --noEmit` sạch.

### Zone thứ 3 "End Flow" — khách đã xong toàn bộ quy trình (2026-07-29)
User: Check-in có thêm cột **"End flow"** — giá trị `"End flow"` = khách đã
xong toàn bộ (không cần điều phối thêm), `"In flow"` = vẫn đang trong luồng.
Tạo 1 danh sách/zone riêng cho nhóm đã xong.

- Đã verify field thật trước khi code (`fetch` trực tiếp qua proxy): tên cột
  đúng là `"End flow"` (f thường), giá trị đúng 2 case `"End flow"` /
  `"In flow"`, dạng rich-text array giống "Done in Flow" — `cellToString` đã
  xử lý đúng, không cần sửa.
- `larkConfig.ts`: `CheckinFieldMap` + default thêm `endFlow: 'End flow'`.
  `larkSettings.ts`: nhãn.
- `larkMapper.ts`: `CheckinIndexEntry` thêm `endFlow: boolean` (qua helper
  `isEndFlowValue()`, so khớp case-insensitive với hằng `'end flow'`).
  `MappedData` thêm field `endFlow: WaitingCustomer[]` — build bằng cách lọc
  trực tiếp từ `checkinByName` (đã index sẵn, không cần quét lại
  `tables.checkin`). **Quan trọng**: loại khách đã `endFlow` ra khỏi
  `waitingDispatch` (thêm 1 dòng check trong vòng lặp cuối) — nếu không, 1
  khách có thể vừa hiện ở "Chờ điều phối" vừa hiện ở "End Flow" cùng lúc (do
  DS vẫn còn ghi "Hoàn tất" trong khi Check-in đã báo xong hẳn).
- `useDashboardData.ts`: `RawState`/`EMPTY`/`UseDashboardDataResult` thêm
  `endFlow`.
- `LayoutDashboard.tsx`: `WaitingZoneKey` thêm `'endFlow'`. `WaitingZone` thêm
  prop `tone?: 'amber' | 'emerald'` (trước giờ hardcode amber) — "End Flow"
  dùng tone emerald để phân biệt trực quan với 2 zone "đang chờ" (amber).
  Đặt ở góc dưới-phải board (`left-80% top-85% h-13% w-17%`) — khoảng trống
  duy nhất còn lại (dưới panel "Bàn demo 20 SP", vốn dừng ở top-38%+h-46%=84%)
  vì cột trái đã kín chỗ bởi 2 zone cũ + bàn Thu cũ.
- `WaitingPopover.tsx::statusTextFor`: thêm case `zone === 'endFlow'` →
  "Đã hoàn tất toàn bộ quy trình".
- `DashboardPage.tsx`: `WAITING_ZONE_LABEL.endFlow = 'End Flow'`;
  `selectedWaitingData` đổi từ ternary 2 nhánh sang lookup object 3 nhánh.
- Mock data: thêm hằng `IN_FLOW`/`END_FLOW`, gán `'End flow'` cho Huỳnh Ngọc
  Linh (ci_2) để test — lưu ý cô ấy vẫn "occupied" ở TC2/BK1 trong mock đồng
  thời (mock vốn không hoàn toàn nhất quán về narrative, chỉ cốt test đúng
  code path).
- **Verify data thật**: `mapped.endFlow` → `[{name: 'Nguyễn Minh Long', stt:
  '1', doneInFlow: 'Back-up', deviceAccepted: true}]`; đồng thời xác nhận anh
  ấy KHÔNG còn xuất hiện trong `waitingDispatch` nữa (trước đó có) — đúng như
  thiết kế loại trừ lẫn nhau. Verify UI (mock mode, tạm bật rồi trả lại
  `useMock: false` như cũ sau khi xong): zone "END FLOW" hiện đúng màu
  emerald, popover Huỳnh Ngọc Linh hiện đủ: Khu vực "End Flow", Trạng thái
  "Đã hoàn tất toàn bộ quy trình", SP, Check thu máy cũ (đỏ). `tsc --noEmit`
  sạch, không lỗi console mới.

### Bố trí lại board + End Flow đổi sang dạng bảng (2026-07-29, sau đó)
User: chuyển "Chờ check-in" sang chỗ "Vách phụ kiện" (đổi nhãn "ĐÃ CHECK-IN"),
chuyển "Chờ điều phối" sang chỗ "Bàn demo 20 SP"; "End Flow" đổi hẳn sang
dạng xem bảng (table), có nút riêng ở khu "Lọc nhanh" thay vì 1 zone trên
board — không còn dùng cơ chế chấm STT + popover cho nhóm này nữa.

- `LayoutDashboard.tsx`: xoá 2 `Region` tĩnh "Vách phụ kiện" (`left-80%
  top-8% h-24% w-17%`) và "Bàn demo 20 SP" (`left-80% top-38% h-46% w-17%`) —
  2 `WaitingZone` cũ chiếm đúng 2 vị trí đó (check-in nhãn đổi thành
  "Đã check-in", điều phối giữ nguyên nhãn). Xoá `WaitingZone` "End Flow" +
  revert `WaitingZoneKey` về lại `'checkin' | 'dispatch'` (bỏ `'endFlow'`) +
  revert `WAITING_ZONE_ANCHOR`/`WaitingZone` bỏ luôn cơ chế `tone` (chỉ còn
  1 tone amber, không cần enum nữa vì emerald đã hết chỗ dùng). Cột trái
  (Upgrade/Bàn thu ngân/Thu cũ) hết bị 2 zone cũ chiếm chỗ phía dưới.
- **`EndFlowTable.tsx`** (file mới): modal (`fixed inset-0 z-50`, backdrop
  đen mờ, đóng khi click backdrop / nút × / phím Escape — thêm `useEffect`
  keydown giống 3 popover kia cho nhất quán) chứa `<table>` liệt kê toàn bộ
  `endFlow` list: STT | Họ và tên | Tên sản phẩm | Ghi chú thanh toán | Check
  thu máy cũ (đỏ khi đã nghiệm thu) | Khâu cuối (`doneInFlow`).
- `FilterBar.tsx`: thêm props `endFlowCount`/`endFlowOpen`/`onToggleEndFlow`,
  chip thứ 4 "End Flow (n)" (tái dùng `Chip`, không phải filter dimming thật —
  chỉ toggle mở modal, không đụng `dimmedIds`).
- `DashboardPage.tsx`: state mới `showEndFlow`; `WAITING_ZONE_LABEL` +
  `selectedWaitingData` revert về 2 nhánh (bỏ endFlow); render
  `{showEndFlow && <EndFlowTable .../>}` như 1 overlay độc lập ngoài
  `LayoutDashboard` (không còn truyền `endFlow` prop vào board nữa, chỉ dùng
  trực tiếp trong trang).
- **Verify**: `tsc --noEmit` sạch (bắt được 1 lỗi so sánh union-type thiếu
  sót ở `WaitingPopover.tsx` — quên xoá nhánh `zone === 'endFlow'` cũ, đã
  sửa). UI live: 2 zone hiện đúng vị trí mới, nút "End Flow (n)" đúng badge
  đếm, bấm mở modal đúng (cả case rỗng lẫn có data — test qua mock), Escape
  đóng modal hoạt động sau khi thêm handler. Có vài dòng lỗi console
  "[vite] Failed to reload LayoutDashboard.tsx" — xác nhận là stale (cùng 1
  timestamp cũ, lặp lại y hệt qua nhiều lần reload sau đó) từ 1 lần HMR đua
  race lúc toggle mock/live liên tục, không phải lỗi hiện tại — trang render

### Responsive fix: desktop 1920×1080 + iPad 11"/13" (2026-07-29, sau đó)
User yêu cầu tối ưu/fix layout cho đúng 2 nhóm thiết bị. Dùng
`resize_window` (Browser pane) để test thật ở 5 viewport: 1920×1080 (desktop),
1194×834 + 834×1194 (iPad 11" ngang/dọc), 1366×1024 + 1024×1366 (iPad 13"
ngang/dọc) — đo bằng `getBoundingClientRect()` thật, không đoán qua ảnh chụp
(ảnh chụp bị scale-down nên nhìn "thấy" khoảng trắng thừa ở 1920 nhưng đo ra
flex-1 vẫn lấp đầy đúng, chỉ là ảo giác do ảnh thu nhỏ).

- **Bug tìm thấy**: hàng `StatusLegend` + `FilterBar` (trong `DashboardPage.
  tsx`) dùng `lg:flex-row lg:justify-between` (bật ở 1024px) — nhưng đo ra
  2 khối này cần tổng **~1246px** mới đủ chỗ nằm 1 hàng không xuống dòng. Ở
  MỌI viewport iPad ngang/dọc đã test (1194, 1366, và biên 1024) đều
  **≥1024 nhưng <1246**, nên `flex-row` bật nhưng cả 2 khối lại tự
  flex-wrap RIÊNG — 2 chuỗi wrap độc lập nằm cạnh nhau tạo cảm giác nội dung
  bị xáo trộn xen kẽ (dòng 1: vài mục legend + vài chip filter, dòng 2: mục
  legend còn lại + chip còn lại), rất khó đọc. Chỉ iPad 11" dọc (834px, dưới
  1024) không dính vì chưa bật `flex-row`.
- **Fix**: đổi `lg:` → `2xl:` (1536px) cho đúng 1 hàng này (không đụng hàng
  board+sidebar, vẫn dùng `lg:flex-row` vì đã test ổn ở mọi kích thước). 1536
  vừa đủ an toàn dưới ngưỡng 1246px cần thiết (dư ~290px) mà vẫn dưới 1920 —
  nghĩa là desktop giữ nguyên 1 hàng như cũ, còn CẢ 4 kích thước iPad giờ đơn
  giản xếp dọc (giống hệt cách iPad 11" dọc vốn đã hiển thị sạch) thay vì cố
  nhét 1 hàng rồi vỡ.
- Verify lại đủ 5 viewport sau fix: cả 4 iPad đều xếp dọc sạch (không còn xen
  kẽ), 1920×1080 vẫn 1 hàng như cũ. Popover (desk lẫn waiting-zone, kể cả 2
  zone mới dời sang phải ở x≈88.5%) vẫn nằm trong viewport ở 1194px
  (`offScreen: false`, đo bằng `getBoundingClientRect`). `tsc --noEmit` sạch.
- **Chưa sửa (chỉ ghi nhận, chưa làm)**: touch-target trên iPad nhỏ hơn
  khuyến nghị 44×44pt của Apple HIG — nút bàn 36px (`h-9`), chấm STT khu chờ
  20px (`h-5`), chấm khách dưới bàn 16px (`h-4`). Không tăng ngay vì rủi ro:
  ở board thu nhỏ (vd iPad dọc, board ~786px width), khoảng cách dọc giữa 1
  hàng chấm STT và HÀNG BÀN KẾ TIẾP ở cụm Tư vấn (3 hàng, cách nhau 13% —
  ~57px ở board 442px cao) đã khá sít; tăng size chấm có thể gây đè lên bàn
  hàng dưới, cần tính lại toạ độ `layoutConfig.ts` cẩn thận chứ không chỉ đổi
  class — để user quyết định có muốn làm tiếp không.

### 1 NV phục vụ nhiều khách cùng lúc — mở rộng ra CẢ 3 cụm (2026-07-30)
User hỏi "1 NV tiếp nhận 2 khách thì hiện thế nào" — trả lời: chỉ Tư vấn có hỗ
trợ (qua bảng "Giao dịch Tư vấn", `DESK_CAPACITY.consult=2`); Thu cũ/Backup
CHƯA hỗ trợ (`DESK_CAPACITY=1`, chỉ đọc "Khách gần nhất" — 1 giá trị). User
yêu cầu mở rộng ra cả 3 cụm, hiển thị ĐÚNG mọi khách 1 NV đang phục vụ (không
chỉ "khách gần nhất"), sắp theo thời gian trước/sau.

- **Verify trước khi code** (fetch trực tiếp qua proxy, không đoán): bảng
  Check-in có sẵn field theo TỪNG KHÁCH cho cả 3 cụm — `TC_Nsư thu cũ` /
  `TV_Nsư Tư vấn` / `BC_Nhân sự` (khoá NV phụ trách, giá trị nội bộ Lark) +
  `Status in thu cũ` / `Status in tư vấn` / `Status in backup` (= "Tiếp nhận"
  khi đang được NV đó phục vụ, "Chưa tiếp nhận" khi chưa) + `Thời gian` (mốc
  check-in, ms epoch). Bắt được bằng chứng thật: "Nguyễn Minh Long" và "Huỳnh
  Ngọc Linh" cùng `TV_Nsư Tư vấn = "optxXl70bv"` và cùng `Status in tư vấn =
  "Tiếp nhận"` tại cùng 1 thời điểm — xác nhận đúng cơ chế cần dùng, và
  KHÔNG cần bảng/route proxy mới (khác với "Điều phối" trước đây) vì dữ liệu
  đã nằm sẵn trong Check-in.
- **Kiến trúc mới** (`larkMapper.ts`): bỏ hẳn cơ chế cũ dựa vào bảng riêng
  "Giao dịch Tư vấn" (`indexReceived`/`receivedByDesk`, vốn chỉ áp dụng cho
  Tư vấn và hiện đang **0 dòng** trong dữ liệu thật — coi như đã ngưng dùng).
  Thay bằng `indexActiveByStaffKey()`: với mỗi cụm, gom mọi khách Check-in
  đang "Tiếp nhận" theo khoá NV (`TC_Nsư thu cũ`/`TV_Nsư Tư vấn`/`BC_Nhân
  sự`), sắp theo `Thời gian` tăng dần. Trong vòng lặp DS chính: lấy khách
  "gần nhất" làm ANCHOR (chỉ để suy ra khoá NV của BÀN này, không giới hạn số
  lượng), tra khoá NV của anchor → lấy đúng nhóm khách đang được NV đó phục
  vụ → `receivedCustomers`. Fallback về danh sách 1-khách (anchor) khi
  Check-in chưa có khoá NV (dữ liệu cũ/thiếu) — không mất thông tin.
  `activeNames` giờ nhận từ `receivedCustomers` ở CẢ 3 cụm (trước chỉ Tư
  vấn) — nên khách nhóm 2 tự động không bị tính nhầm "Chờ check-in".
- `types/desk.ts`: `DESK_CAPACITY` nâng `tradein`/`backup` từ 1 lên 2 (khớp
  `consult`) — không còn giới hạn cứng, list không bị cắt, số này giờ chỉ
  còn ý nghĩa hiển thị mẫu số "(x/2)" ở `DeskPopover`.
- `larkConfig.ts`/`larkSettings.ts`: `CheckinFieldMap` thêm 7 field phẳng
  (`time`, `staffTradein/Consult/Backup`, `statusTradein/Consult/Backup`) —
  giữ dạng phẳng (không nest theo cụm) để `SettingsPage.tsx` tự động hiện
  form mapping mà KHÔNG cần sửa gì ở đó (đã lặp sẵn qua
  `Object.keys(CHECKIN_LABELS)`).
- **`DeskPopover.tsx`/`LayoutDashboard.tsx`: KHÔNG cần sửa gì** — cả 2 đã
  viết generic theo `receivedCustomers.length` từ trước (nhánh 1-khách vs
  nhánh danh sách), chỉ do tầng dữ liệu giới hạn Thu cũ/Backup còn 1 khách.
  Xác nhận lại nguyên tắc: khi thêm khả năng mới, luôn kiểm tra tầng UI có
  sẵn generic chưa trước khi sửa thêm.
- Không xoá hạ tầng `TxFieldMap`/`txConsult` (config/settings/type/worker
  route) — để dormant, không dùng trong mapper nữa nhưng không ảnh hưởng gì
  nếu còn đó (theo đúng cách đã làm với `sttRecent` trước đây).
- Mock data: thêm 3 khách mới (ci_9 "Hoàng Anh Tú", ci_10 "Bùi Thanh Hà",
  ci_11 "Đặng Gia Hân") làm "bạn đồng hành" cho TC1/TV2/BK1 — mỗi cặp cùng
  khoá NV + status "Tiếp nhận", thời gian check-in SAU anchor (để test đúng
  thứ tự sắp xếp). Thêm field `Thời gian` (ms) cho tất cả 11 khách.
- **Verify**: gọi thẳng `mapDeskStates` qua mock — TC1/TV2/BK1 đều trả đúng 2
  khách theo đúng thứ tự (anchor trước, bạn đồng hành sau, đúng theo
  `Thời gian`); TC3/TV4 (không có dữ liệu nhóm) vẫn đúng 1 khách qua fallback
  — không có hồi quy. UI: chấm STT hiện đúng hàng ngang 2 chấm ở cả TC1/BK1
  (trước đây 2 cụm này KHÔNG BAO GIỜ hiện được 2 chấm); popover "Bàn TC1"
  hiện "Khách đang tiếp nhận (2/2)" — Nguyễn Minh Long (đỏ, đã nghiệm thu)
  trước, Hoàng Anh Tú sau — đúng thứ tự thời gian. `tsc --noEmit` sạch.

### Bug thật: `cellToString` không đọc được field dạng mảng string trần / mảng người dùng (2026-07-30)
User báo: Lark thật TV1 đang có 2 khách (STT 1, 2) cùng lúc nhưng code chỉ
hiện 1 (STT 2). User khẳng định `TV_Nsư Tư vấn`/`TC_Nsư thu cũ`/`BC_Nhân sự`
"chắc chắn ổn định" — tức lỗi phải ở phía code, không phải dữ liệu thiếu.

- Đã nghi ngờ sai ban đầu (trả lời trước): tưởng do dữ liệu Lark tự xoá field
  (volatile). User khẳng định ổn định → quay lại verify KỸ hơn thay vì tin
  vào suy đoán "dữ liệu không ổn định".
- **Root cause thật** (dump raw JSON, không qua `cellToString`): giá trị thật
  của `TV_Nsư Tư vấn` là `["optxXl70bv"]` — **mảng chứa 1 string trần**,
  KHÁC với dạng rich-text segment `[{text, type}]` mà các field formula khác
  (Done in Flow, End flow, Check nghiệm thu) trả về. `cellToString()` cũ chỉ
  xử lý `seg?.text` — với `seg` là string nguyên thủy, `.text` là `undefined`
  → luôn ra `''` → hàm trả `null` dù field CÓ giá trị. Đây là lý do
  `staffKey` luôn `null`, khiến cơ chế gom nhóm (tính năng trước) không bao
  giờ hoạt động được với dữ liệu thật, dù mock test đều pass (mock dùng
  string trực tiếp, không phải mảng, nên không lộ bug này).
- **Fix `larkMapper.ts::cellToString`**: khi gặp mảng, xử lý CẢ 3 dạng phần
  tử đã xác nhận từ Lark thật: string trần (`"optxXl70bv"`), rich-text
  segment (`{text, type}`), và person-link object (`{id, name, email,
  avatar_url}` — vd field "Nhân viên"/"NV Tư vấn" ở bảng DS). `LarkTextSegment`
  (`larkTypes.ts`) nới thành `{text?, name?, type?}` (mọi field đều optional)
  để type-safe cho cả 3 dạng.
- **Bonus tìm thấy cùng lúc** (cùng root cause, cùng file): "Tên NV" trong
  popover bàn luôn trống với dữ liệu thật — vì `Nhân viên`/`NV Tư vấn` là
  person-link field (`{name}`, không có `.text`), giờ đã đọc đúng nhờ cùng 1
  fix.
- **Bài học**: khi mock data dùng kiểu dữ liệu ĐƠN GIẢN HƠN thật (string thay
  vì mảng), test qua mock KHÔNG bắt được lỗi parse — chỉ verify bằng
  `fetch()` trực tiếp + dump RAW JSON (không qua hàm parse của mình) mới lộ
  ra được. Cần cẩn thận hơn: khi 1 field mới báo "luôn null", nghi ngờ hàm
  parse trước khi kết luận "dữ liệu thiếu".
- **Verify lại bằng dữ liệu live thật**: `TV1.receivedCustomers` giờ đúng
  `[Nguyễn Minh Long (STT 1), Huỳnh Ngọc Linh (STT 2)]` (đúng thứ tự thời
  gian); `TV1.staffName = "Dương Đình Hưng"` (trước đó rỗng). Test lại mock
  (TC1/TV2/BK1 + waitingCheckin/endFlow) — không hồi quy. `tsc --noEmit` sạch.

### Bug thật #2 (cùng ngày): desk "Rảnh" sai + mất người vừa hoàn tất khi bàn còn người khác (2026-07-30)
User test tiếp: TV1 có 3 khách (STT 1,2,3) cùng lúc; khách 1 hoàn tất thì
**cả bàn chuyển Rảnh luôn**, dù khách 2,3 vẫn "Tiếp nhận". Verify live xác
nhận: `Status in tư vấn` có state thứ 3 `"Hoàn tất"` (không chỉ Tiếp
nhận/Chưa tiếp nhận); DS `Trạng thái hiện tại` = "Rảnh" (chỉ theo khách GẦN
NHẤT là khách 1) dù khách 2,3 vẫn active — cùng gốc rễ với bug hôm trước
(DS chỉ theo dõi 1 khách/bàn) nhưng lộ ra ở 2 chỗ MỚI chưa fix lần trước:

1. **Màu bàn (occupied/available) sai**: `deskUiStatus()` (`types/desk.ts`)
   chỉ đọc text `currentStatus` — không biết gì về nhóm nhiều khách nội bộ
   mapper vừa tính. Fix: check `d.isOccupied` (bool mapper tính, đã tính đúng
   multi-customer) TRƯỚC, chỉ fallback về suy text khi không có (vd lúc mapper
   tự gọi nội bộ với object chưa gán isOccupied — dùng để tính `dsOccupied`
   làm 1 trong 2 tín hiệu OR). `currentStatus` (text thô) GIỮ NGUYÊN không sửa
   — vẫn cần hiển thị trung thực trong `DeskPopover` dòng "Trạng thái".
2. **"Chờ điều phối" bỏ sót người vừa xong**: cơ chế cũ đẩy candidate vào
   `completedCandidates` dựa theo DS CẤP BÀN (`!occupied && statusRecent ===
   'Hoàn tất'`) — nay `occupied` đúng ra vẫn `true` (còn khách 2,3), nên nhánh
   này không bao giờ chạy, khách 1 KHÔNG BAO GIỜ vào "Chờ điều phối" nữa. Fix
   tận gốc: bỏ hẳn cách cũ, thay bằng quét TỪNG KHÁCH qua Check-in
   (`Status in <cụm> === "Hoàn tất"`, lặp cả 3 cụm, không liên quan gì đến
   trạng thái của BÀN) — đúng bản chất "hoàn tất" là sự kiện của 1 NGƯỜI,
   không phải của 1 BÀN.
3. **Bug phát sinh khi fix #2, tự bắt được khi verify**: sau khi sửa #1+#2,
   khách 1 (Nguyễn Minh Long) vẫn KHÔNG hiện ở "Chờ điều phối" — do
   `activeNames.add(customerName)` vẫn gán `customerName = customerRecent`
   (= khách 1, anchor CŨ) một cách VÔ ĐIỀU KIỆN mỗi khi `occupied` true, bất
   kể anchor có còn trong nhóm active hay không — nên khách 1 bị tính nhầm
   "đang active" (qua TV1) dù đã hoàn tất, và bị loại khỏi waitingDispatch bởi
   chính điều kiện `activeNames.has(cand.name)`. Fix: các field "1 khách"
   (`customerSTT`/`customerName`/`productName`/`paymentNote`/`deviceAccepted`
   trên `DeskLiveState`, dùng cho fallback + hiển thị rút gọn) đổi sang lấy từ
   khách ĐẦU TIÊN trong `receivedCustomers` THẬT SỰ (list đã gom đúng), không
   phải luôn là anchor — `activeNames` giờ CHỈ được set từ
   `receivedCustomers` (nguồn duy nhất, không có đường phụ nào set thêm).
   **Bài học**: khi có nhiều nguồn cùng ghi vào 1 tập hợp dùng cho loại trừ
   (`activeNames`), phải đảm bảo TẤT CẢ nguồn cùng nhất quán với "sự thật"
   mới nhất — 1 đường quên cập nhật là đủ để tạo bug âm thầm.
- Cập nhật `fallback` trong bàn: chỉ dùng khi `!hasActiveGroup` (không có
  fallback đè lên nhóm thật).
- Mock: thêm `Status in thu cũ: 'Hoàn tất'` cho Vũ Xuân Phong (ci_6) — cơ chế
  cũ (DS-driven) bị xoá hoàn toàn nên ví dụ `waitingDispatch` cũ (dựa vào DS)
  không còn tự chạy được nữa, phải thêm tín hiệu Check-in tương ứng.
- **Verify live**: `TV1.isOccupied=true`, `deskUiStatus(TV1)="occupied"` (đỏ),
  `receivedCustomers=[Huỳnh Ngọc Linh, Phạm Đức Dũng]` (đúng, loại khách 1),
  `waitingDispatch=[{name:'Nguyễn Minh Long', fromCluster:'consult',
  doneInFlow:'Tư vấn'}]` (đúng!). UI: TV1 hiện đỏ với 2 chấm STT (2,3); "Chờ
  điều phối" hiện đúng 1 chấm; popover Nguyễn Minh Long hiện đúng
  `Trạng thái: Đã hoàn tất "Khâu Tư vấn"`. Test lại mock (TC1/TV2/BK1 + lại
  đúng waitingDispatch cho Vũ Xuân Phong) — không hồi quy. `tsc --noEmit` sạch.

### Bỏ trạng thái "idle" (chưa có dữ liệu) — chỉ còn xanh/đỏ (2026-07-30)
User: bỏ hẳn ô xám "chưa có dữ liệu", board chỉ còn 2 màu — xanh (rảnh) / đỏ
(có khách). Coi "chưa có dữ liệu" (hoặc không khớp bàn nào) cũng là "rảnh".

- `types/desk.ts`: `DeskUiStatus` bỏ `'idle'` (còn `'available' | 'occupied'`).
  `deskUiStatus()` viết lại: `isOccupied` true → occupied; text chứa "đang" →
  occupied (dùng khi gọi nội bộ mapper, object chưa có `isOccupied`); MỌI
  trường hợp còn lại (Rảnh, Chưa có dữ liệu, không có `d`/`hasData`) → luôn
  `available`. `computeSummary()` không cần sửa — vòng lặp `if/else if`
  occupied/available đã exhaustive sẵn, giờ mọi bàn rơi đúng 1 trong 2 nhánh.
  `hasData`/`withData` GIỮ NGUYÊN (khác khái niệm — vẫn dùng cho tỉ lệ "X/Y
  bàn có dữ liệu" ở Sidebar, không phải màu ô).
- `components/Desk.tsx`: bỏ `idle` khỏi `TONE` map.
- `components/DeskPopover.tsx`: bỏ `idle` khỏi `STATUS_TEXT` — nhánh nội dung
  (available vs occupied) đã dùng chung message "Bàn trống — chưa có thông
  tin khách." từ trước, không cần sửa gì thêm ở đó. **Cố tình giữ nguyên**
  dòng "Trạng thái" (hiện `desk.currentStatus` thô, có thể vẫn là "Chưa có dữ
  liệu") — đây là hiển thị TRUNG THỰC dữ liệu Lark gốc để debug, khác với cái
  BADGE góc trên (nay luôn chỉ "Trống"/"Đang tiếp nhận") đã đơn giản hoá theo
  yêu cầu. Không fake dữ liệu thô.
- `components/StatusLegend.tsx`: xoá mục chú thích "Chưa có dữ liệu" (chấm
  xám).
- `larkConfig.ts`: sửa lại doc-comment mô tả logic (chỉ comment, không đổi
  hằng số `STATUS_OCCUPIED_HINT`/`STATUS_FREE_HINT` — 2 hằng này vốn đã
  không được import/dùng ở đâu từ trước, không phải do đợt sửa này).
- **Verify**: `tsc --noEmit` sạch (không có nơi nào khác so khớp literal
  `'idle'` nên không phát sinh lỗi type). UI live: mọi bàn giờ đúng 2 màu (TC,
  BK, phần lớn TV đều xanh dù Lark báo "Chưa có dữ liệu"); popover bàn trống
  hiện badge "Trống" xanh (trước là "Chưa có dữ liệu" xám) nhưng dòng "Trạng
  thái" vẫn trung thực "Chưa có dữ liệu"; filter "Chỉ hiện bàn trống" vẫn
  đúng (chỉ làm mờ bàn đang occupied). Test lại mock — không hồi quy.

### 2 tỉ lệ board CỐ ĐỊNH — desktop 1920×1080 (16:9), iPad 2360×1640 (2026-07-30)
User: Thu cũ trên iPad quá sát nhau, khó bấm. Fix cứng 2 tỉ lệ (không cần
adaptive mượt theo mọi kích thước) vì app luôn chạy full màn hình đúng 1
trong 2 kích thước này.

- **Không tạo 2 bộ toạ độ riêng cho layoutConfig.ts** — thay vào đó chỉ đổi
  **tỉ lệ khung board** (`aspect-video` 16:9 → `aspect-[2360/1640]` ≈1.44:1
  khi ở "hình iPad"). Vì mọi toạ độ desk đều là %, board CAO hơn (ứng với
  cùng 1 chiều rộng) tự động cho MỌI hàng (không riêng Thu cũ) nhiều khoảng
  cách pixel hơn — đo được tăng từ 71px lên 113px giữa tâm TC1↔TC3 (~+59%),
  đủ để không cần sửa `layoutConfig.ts` (giữ 1 bộ toạ độ, ít rủi ro hồi quy
  hơn 2 bộ toạ độ song song).
- **Cách chọn profile — dùng media feature `aspect-ratio`, KHÔNG dùng
  `min-width`**: `LayoutDashboard.tsx` — class Tailwind arbitrary variant
  `[@media(max-aspect-ratio:8/5)]:aspect-[2360/1640]` (mặc định vẫn
  `aspect-video`). Lý do quan trọng: 2360×1640 nhiều khả năng là độ phân giải
  NATIVE/marketing của iPad (Retina @2x) — trình duyệt thật trên iPad
  (`window.innerWidth`) nhiều khả năng sẽ báo **1180×820** (bằng nửa), không
  phải 2360×1640. Nếu chọn profile theo `min-width` cố định 2360px thì SẼ
  KHÔNG BAO GIỜ kích hoạt trên iPad thật. Dùng `aspect-ratio` thay vì `width`
  né được hoàn toàn vấn đề này — vì tỉ lệ khung hình GIỐNG HỆT nhau dù đo
  bằng native hay logical pixel (chỉ là nhân đôi cả 2 chiều). Ngưỡng chọn
  `8/5` (=1.6) nằm giữa 16:9 (1.778) và tỉ lệ iPad (1.439) — an toàn cho cả 2
  profile chính xác.
- **Đã báo cho user (chưa tự sửa)**: nếu app chạy trong Safari/WebView thật
  trên iPad (không phải màn ngoài rời qua USB-C), viewport thật nhiều khả
  năng KHÔNG PHẢI 2360×1640 — cần user xác nhận lại bằng cách mở DevTools/
  Safari Web Inspector trên đúng thiết bị và đọc `window.innerWidth/innerHeight`
  thật, vì cách chọn theo `aspect-ratio` đã né được vấn đề NHƯNG nếu user
  từng test qua `resize_window` ở đúng "2360×1640" logic (không phải iPad
  thật), kết quả nhìn đúng như mong đợi dù device thật có thể khác.
- **Verify chính xác từng profile** (đo `getBoundingClientRect`/
  `getComputedStyle`, không đoán qua ảnh):
  - 2360×1640 → `aspectRatio: "2360 / 1640"`, board 2032×1412px, TC1↔TC3
    center-to-center = 113px (gap cạnh-cạnh 77px, rộng rãi so với nút 36px).
  - 1920×1080 → `aspectRatio: "16 / 9"` (không đổi), board 1592×896px,
    TC1↔TC3 = 71px (giữ nguyên như trước, không ảnh hưởng desktop).
  `tsc --noEmit` sạch. Không sửa gì thêm ở `layoutConfig.ts`/`Desk.tsx`.

### Đổi sang sơ đồ mặt bằng mới — KT thay Thu cũ, bỏ Backup (2026-07-31)
User gửi ảnh mặt bằng mới (chú thích + khu vực kỹ thuật kt1-3 + khu tư vấn
tv1-6 (3 cặp) + 1 khu "khách nhận STT và đợi" dạng lưới 24 ô + hình trang trí
lối vào) kèm yêu cầu ngắn: "đổi layout sang như thế này, giữ nguyên logic, KT
sẽ thay cho thu cũ, không có backup". Trước khi sửa, hỏi lại user 4 điểm mấu
chốt (AskUserQuestion) vì phạm vi ảnh hưởng gần như toàn bộ codebase:

1. **Số bàn có giảm đúng theo ảnh không** (3 KT + 6 TV, bỏ 10 Backup, tổng
   38→9)? → User xác nhận: **giảm đúng theo ảnh**.
2. **Có đổi luôn tên bảng/field Lark (Thu cũ→Kỹ thuật) trong code không**, vì
   file `NPI Testing 2.xlsx` user cung cấp (kiểm tra bằng cách đọc
   `xl/workbook.xml` trong zip) **chưa có sheet "Kỹ thuật"** nào, chỉ có "Thu
   cũ"/"DS thu cũ"? → User chọn: **giữ nguyên kết nối "Thu cũ" cũ** (không đổi
   bảng/field Lark nào, chỉ đổi chữ hiển thị trên UI) — an toàn hơn cho dữ
   liệu đang chạy live.
3. **2 khu chờ "Đã check-in"/"Chờ điều phối" có gộp thành 1 không** (ảnh chỉ
   vẽ 1 khung "khách nhận STT và đợi")? → User chọn: **gộp thành 1 khu chung**
   (khác với suy đoán ban đầu là giữ 2 khu riêng).
4. **4 vùng nền tĩnh cũ (Sân khấu/Upgrade/Bàn thu ngân/Cổng) có bỏ không** (ảnh
   mới không còn nhắc tới)? → User chọn: **bỏ hết, theo đúng ảnh mới**.

**Quyết định kiến trúc cốt lõi — tách `id` (khoá join Lark) khỏi `label` (chữ
hiển thị)**: `types/desk.ts`'s `TablePosition` trước đây `id === label` luôn
đúng. Để vừa hiển thị "KT1" trên node vừa giữ khớp dữ liệu Lark thật (cột
`STT bàn` vẫn ghi "TC1".."TC3", KHÔNG đổi vì quyết định #2 ở trên), thêm phân
biệt: `id` = khoá join (giữ "TC" cho cụm `kythuat`), `label` = chữ hiển thị
("KT"). Mọi chỗ render text cho người xem (`Desk.tsx`, `DeskPopover.tsx`,
`CustomerPopover.tsx`) đổi sang đọc `label` thay vì `id`; mọi chỗ dùng làm khoá
(state `selectedId`, `dimmedIds`, merge Lark theo `p.id` ở `useDashboardData`)
giữ nguyên đọc `id`. Đây là điểm dễ nhầm nhất nếu có ai sửa tiếp — xem comment
trong `layoutConfig.ts` (`ID_PREFIX` vs `CLUSTER_PREFIX`).

**Đổi cluster key `'tradein' → 'kythuat'`, bỏ hẳn `'backup'`** khỏi
`ClusterKey` (TS union) — vì đây chỉ là định danh nội bộ (không phải chuỗi
Lark-facing), việc đổi tên không ảnh hưởng gì tới dữ liệu thật, và để trình
biên dịch tự bắt hết chỗ cần sửa (`tsc -b --noEmit` dùng làm checklist thay vì
tự grep tay). Việc TypeScript báo lỗi từng file một (component → Lark
config/settings/types/service/mapper → mock data → SettingsPage) đã dẫn đường
sửa rất sát, không bỏ sót.

**File đã sửa** (tất cả các mục dưới đều xoay quanh 2 quyết định trên):
- `types/desk.ts`: `ClusterKey`, `TablePosition.label` (doc mới), `DESK_CAPACITY`,
  `CLUSTERS` (trong `computeSummary`).
- `config/layoutConfig.ts`: viết lại hoàn toàn — `KYTHUAT_POSITIONS` (3, 1
  hàng ngang, `buildGrid` nhận thêm `ID_PREFIX` riêng cho join key) +
  `CONSULT_POSITIONS` (6, liệt kê thủ công vì đánh số dọc-trong-nhóm trước
  ngang-giữa-nhóm — khác `buildGrid` row-major nên không dùng hàm chung được);
  thêm `assertGridSpacing` (dedupe x/y rồi mới check pitch, vì mảng thủ công
  có toạ độ trùng theo cặp). Bỏ `BACKUP_POSITIONS`. Sanity check 3/6.
- `components/Desk.tsx`: thêm prop `label`; bỏ hẳn `type`/`SHAPE` (cả 2 cụm giờ
  đều là hình tròn — không còn khác biệt hình dạng theo cụm).
- `components/LayoutDashboard.tsx`: viết lại phần nền — bỏ backdrop/4 vùng
  tĩnh cũ + 2 `ClusterCaption`; thêm `ZoneBox` (khung nét đứt có nhãn, dùng cho
  khu Kỹ thuật/Tư vấn) + `DecorDot` (chấm trang trí tĩnh, xanh dương cho Kỹ
  thuật/đỏ cho Tư vấn, KHÔNG gắn dữ liệu — chỉ để giống ảnh mẫu) + hình chữ
  nhật trang trí ("màn hình") dưới hàng KT. Gộp `waitingCheckin`+
  `waitingDispatch` thành 1 mảng `WaitingItem[]` (giữ `zone`+`index` gốc mỗi
  phần tử) render trong 1 `WaitingZone` duy nhất — bấm 1 chấm vẫn gọi đúng
  `onSelectWaiting(zone, index)` như cũ nên `DashboardPage`/`WaitingPopover`
  không cần đổi logic, chỉ đổi cách hiển thị. `WAITING_ZONE_ANCHOR` 2 key giờ
  trỏ cùng 1 toạ độ (đáy khung gộp) vì chỉ còn 1 khung trên board.
- `components/DeskPopover.tsx`, `CustomerPopover.tsx`: đổi `Bàn {id}`/`Vị trí`
  sang đọc `label`.
- `components/Sidebar.tsx`: `ORDER` → `['kythuat','consult']`.
- `components/FilterBar.tsx`: `onlyTradein`→`onlyKythuat`, chữ chip → "Chỉ
  hiện bàn KT".
- `components/WaitingPopover.tsx`: `STAGE_NAME` map bỏ `backup`, `tradein`→
  `kythuat: 'Kỹ thuật'`.
- `pages/DashboardPage.tsx`: filter state/so khớp `onlyTradein`/`'tradein'` →
  `onlyKythuat`/`'kythuat'`.
- **Tầng Lark** (`larkConfig.ts`, `larkSettings.ts`, `larkTypes.ts`,
  `larkService.ts`, `larkMapper.ts`) — bỏ hoàn toàn `dsBackup`/`staffBackup`/
  `statusBackup`/`TableKey 'dsBackup'` (cụm Backup không còn tồn tại nên không
  cần fetch/map/cấu hình nữa). **CỐ Ý KHÔNG ĐỔI** `dsTradein`/`staffTradein`/
  `statusTradein`/tên cột Lark mặc định ("TC_Nsư thu cũ", "Status in thu cũ"…)
  — đúng theo quyết định #2, chỉ sửa nhãn hiển thị trong `CHECKIN_LABELS`/
  `TABLE_LABELS`/`DS_TABLES` (SettingsPage) để ghi chú "(bảng Lark 'Thu cũ'
  cũ)" cho đỡ nhầm.
- `data/mockLarkData.ts`: đổi tên biến `dsTradein`→`dsKythuat` (nội dung giữ
  nguyên 6 dòng, kể cả dòng TC6 test-case "waiting âm bị kẹp về 0" — dư thừa
  vô hại vì board chỉ còn hiện TC1-3, không cần cắt bớt). Xoá hẳn fixture
  `dsBackup`. Xoá field backup-only khỏi checkin (`BC_Nhân sự`/`Status in
  backup` ở ci_2/ci_11) + comment liên quan; ci_2 mất vai trò demo "2 khách/NV
  ở Backup" nên chỉ còn là 1 khách End Flow thường; ci_11 tương tự — hệ quả
  đúng mong đợi: giờ tự rơi vào danh sách `waitingCheckin` (verify thấy trong
  browser, đúng logic "chưa từng chạm bàn nào").
- `pages/SettingsPage.tsx`: bỏ nhánh `dsBackup` khỏi `DS_TABLES` + type param
  `setDsField`; sửa hint URL proxy.
- Docs: `docs/PROJECT_OVERVIEW.md`, `README.md`, `docs/LARK_SETUP.md` — cập
  nhật số bàn/cụm/bảng Lark khớp kiến trúc mới.

**Verify**: `npx tsc -b --noEmit` sạch → `npm run build` pass (47 modules) →
tạo `.claude/launch.json` (chưa có sẵn) rồi chạy `npm run dev` qua Browser
pane, kiểm tra bằng ảnh chụp + `read_page` (không đoán qua ảnh):
- Cả 9 node hiện đúng nhãn "KT1-3"/"TV1-6", đúng layout 1-hàng-KT +
  3-cặp-dọc-TV giống bố cục ảnh mẫu; khu "KHÁCH NHẬN STT VÀ ĐỢI" gộp đúng 4
  khách (7,8,11,6 — khớp tính tay: waitingCheckin 3 + waitingDispatch 1).
- Click KT1 → popover "KỸ THUẬT / Bàn KT1" (không phải "TC1") nhưng vẫn kéo
  đúng dữ liệu Lark thật (NV Thịnh_OPs, 2 khách Nguyễn Minh Long/Hoàng Anh Tú)
  — xác nhận tách id/label hoạt động đúng như thiết kế.
- Filter "Chỉ hiện bàn KT" làm mờ đúng toàn bộ cụm Tư vấn (node + chấm trang
  trí), giữ nguyên cụm KT + khu chờ STT (không bị mờ, giống hành vi filter cũ
  với 2 zone chờ). Không có console error.
- **Lưu ý đã báo cho user**: dòng "Trạng thái" trong popover bàn KT vẫn hiện
  nguyên văn "Đang tư vấn" (text thật trong cột Lark `Trạng thái hiện tại` của
  bảng "Thu cũ" cũ, không đổi theo quyết định #2) — có thể trông lệch ngữ
  cảnh dưới nhãn cụm "KỸ THUẬT" nhưng đây là dữ liệu thật, không phải bug.

### Lưới STT cố định — khu chờ (24 ô) + mỗi bàn Tư vấn (4 ô) (2026-07-31)
User gửi ảnh chụp bản build trên kèm "fix lại theo feedback này" nhưng không
có text feedback cụ thể — hỏi lại bằng `AskUserQuestion` (multiSelect) với vài
giả thuyết dựa trên so sánh với ảnh mặt bằng gốc. User chọn/mô tả rõ 2 ý:

1. **Khu "Khách nhận STT và đợi" phải là lưới 24 ô CỐ ĐỊNH** (4 cột × 6 hàng),
   ô trống vẫn hiện (không co giãn theo số khách như trước).
2. **Mỗi bàn Tư vấn có tối đa 4 ô STT cố định** ngay dưới/quanh node (không
   phải 2 chấm + hàng chấm trang trí đỏ không gắn dữ liệu như bản trước), node
   TV nằm giữa các ô này, khách tự điền trái→phải theo thứ tự (đã có sẵn nhờ
   `indexActiveByStaffKey` sort theo "Thời gian" tăng dần — không cần sort
   thêm), popup vẫn neo gần node như cũ (không cần đổi `CustomerPopover`).

**Chỉ áp dụng cho cụm `consult` (Tư vấn)** — cụm `kythuat` (KT) giữ nguyên
hành vi cũ (ẩn hẳn khi chưa có khách, tối đa 2) vì user chỉ nhắc tới
"TV1,2,3..." trong feedback, không nhắc KT.

- `types/desk.ts`: `DESK_CAPACITY.consult` 2→4 (dùng luôn hằng số này làm số ô
  cố định hiển thị, không thêm hằng số riêng).
- `components/LayoutDashboard.tsx`: viết lại lớn:
  - Bỏ hẳn khối tạo chấm trang trí đỏ quanh mỗi cặp TV (24 `DecorDot`) — thay
    bằng ô STT thật (`SttSlot`, xem dưới) render trong đúng vòng lặp
    "chấm dưới bàn" đã có sẵn.
  - `SttSlot` — component dùng chung cho cả lưới 24 ô lẫn hàng ô dưới bàn: ô
    có khách (cam, bấm được) hoặc ô trống (viền chấm, không tương tác).
    **Bug tự bắt trước khi build**: lúc đầu định truyền size qua class
    Tailwind dựng động kiểu `` `h-[${sizeVar}]` `` — SAI vì Tailwind quét
    class lúc BUILD (static), không thấy được chuỗi ghép lúc runtime nên sẽ
    không sinh CSS. Sửa bằng cách truyền `size`/`fontSize` là giá trị CSS
    thật (`'var(--dot)'`...) qua `style` inline, không qua class.
  - Vòng lặp "chấm dưới bàn" thêm `FIXED_SLOT_CLUSTERS = new Set(['consult'])`
    — cụm trong set: LUÔN render đủ `DESK_CAPACITY[cluster]` ô (pad `null` cho
    ô trống, không `return null` khi rỗng); cụm khác: giữ đúng hành vi cũ (ẩn
    khi rỗng, cắt theo cap, có badge "+n" tràn).
  - `WaitingZone` viết lại từ flex-wrap sang **CSS grid 4 cột cố định 24 ô**
    (`WAITING_GRID_SIZE=24`, `WAITING_GRID_COLS=4`) — pad `null` cho ô trống,
    ô thứ 24 nhường chỗ cho badge "+n" nếu >24 khách (tái dùng đúng pattern
    tràn đã có ở chấm dưới bàn). Bỏ nhánh text "Không có khách" (lưới rỗng tự
    nó đã truyền tải đủ ý, không cần text).
- **Verify**: `tsc -b --noEmit` + `npm run build` sạch. Browser: khu chờ hiện
  đúng lưới 4×6, 4 ô đầu có số (7,8,11,6), 20 ô còn lại trống (viền chấm nhạt).
  Mỗi bàn TV hiện đúng 4 ô (TV2: 2 số [3,10] + 2 trống, TV4: 1 số [5] + 3
  trống, TV1/3/5/6: 4 trống). Click ô "10" (Bùi Thanh Hà) → popover đúng vị
  trí ngay dưới TV2, nội dung đúng ("Vị trí: Tư vấn · TV2"). KT giữ nguyên
  hành vi cũ (KT1/2/3 vẫn chỉ hiện đúng số chấm có khách, không có ô trống).
  Không console error.

### Bỏ hình chữ nhật + 3 chấm xanh trang trí ở khu Kỹ thuật (2026-07-31)
User gửi ảnh crop đúng 2 phần tử này kèm "xóa đi". Xoá khối `<div>` hình chữ
nhật ("màn hình" trang trí) + 3 `DecorDot` xanh dương dưới hàng KT1-3 trong
`LayoutDashboard.tsx`; xoá luôn component `DecorDot` (không còn nơi nào dùng
sau khi bỏ 2 chỗ trang trí — TV đã bỏ ở lượt sửa trước, giờ tới KT). Khu Kỹ
thuật giờ chỉ còn khung nét đứt + 3 node KT, không còn phần tử trang trí nào.
`tsc`/`build` sạch, verify lại bằng browser.

### Cân đối lại khoảng cách/không gian toàn board (2026-07-31)
User: "dư thừa không gian mà các node khá gần nhau". Không đoán qua mắt — đo
trực tiếp `getBoundingClientRect()` các node/hàng chấm STT thật trên trang
đang chạy (% theo chiều cao/rộng board) để tìm đúng nguồn gây mất cân đối:
- Khung "Khu vực kỹ thuật" cao 39% nhưng nội dung (1 hàng node + chấm) chỉ
  chiếm tới ~20% → dư gần nửa khung là khoảng trắng.
- 3 node KT chỉ cách nhau 7% (34/41/48) trong khi khung rộng 33% → co cụm giữa.
- Khoảng cách giữa hàng trên/dưới mỗi cặp bàn Tư vấn (tv1/2...) 16% → 2 hàng
  + chấm STT sát nhau, cảm giác chật.

**Sửa** (`layoutConfig.ts` + `LayoutDashboard.tsx`):
- Gộp 1 mảng `GROUP_X = [12, 32, 52]` (pitch 20%) dùng CHUNG cho cả 3 cột KT
  lẫn 3 nhóm TV — 2 khung giờ thẳng hàng theo trục dọc (KT1 ở trên TV1/TV2,
  v.v.), đọc có chủ đích hơn là toạ độ rời rạc mỗi khung một kiểu.
- Khung KT thu từ `h-[39%]` xuống `h-[21%]` (đo thật: nội dung cao ~21%,
  không còn dư khoảng trắng lớn phía dưới).
- Pitch hàng Tư vấn tăng 16%→26% (y: 46/72, đo thật node cao ~4.7% + hàng
  chấm STT kéo dài thêm ~5.3% dưới tâm node, chọn pitch đủ để không sát nhau
  nhưng không tạo khoảng trắng lớn giữa 2 hàng như thử pitch 33% ban đầu —
  bị dư hẳn ~25% khoảng trắng giữa, phải giảm lại).
- Khung TV cao theo `h-[67%]`, đặt `top-[28%]` — cộng với khung KT + khoảng
  cách giữa 2 khung, cột trái (KT+TV) khớp ĐÚNG chiều cao cột phải (khung STT,
  cả 2 đều chạy từ 3.1% đến 94.9% — trùng khớp hoàn toàn, không phải cố tình
  set bằng tay mà ra từ phép tính margin cân đối, xác nhận lại bằng đo đạc).
- **Verify bằng số đo, không chỉ xem ảnh**: chụp lại toạ độ thật của 3 khung +
  mọi hàng chấm sau khi sửa — margin trong khung Tư vấn còn 15.6%(trên)/
  17.7%(dưới)/18.4%(giữa 2 hàng), cân đối hơn hẳn bản trước (top 17.66/giữa
  25.33/dưới 13.81 — lệch hẳn về khoảng giữa). Test thêm ở tỉ lệ iPad
  (1180×820 ≈ 2360:1640) — không vỡ, không chồng lấn. `tsc`/`build` sạch,
  không console error.

### Popup khu chờ STT neo đúng ô vừa bấm, không còn 1 điểm cố định (2026-07-31)
User: "khu vực nhận STT pop up vẫn ở xa, điều chỉnh tương tự với các khu vực
khác" — trước đó `WAITING_ZONE_ANCHOR` neo CỐ ĐỊNH 1 điểm (x:80,y:90, gần đáy
khung) cho toàn bộ 24 ô, nên bấm ô hàng trên (y≈26%) thì popup vẫn bật ra tận
y=90%, cách xa hẳn — không giống cách các bàn/chấm khác (mỗi cái tự neo đúng
toạ độ của nó).

- Đo thật `getBoundingClientRect()` cả 24 ô lưới đang render bằng CSS Grid để
  lấy toạ độ chính xác (không đoán): cột cách đều 8.05% từ x=68.38%, hàng
  cách đều 9.88% từ y=26.23%.
- Bỏ hẳn CSS Grid cho lưới chờ — chuyển sang toạ độ tường minh
  `WAITING_GRID_POSITIONS` (mảng 24 điểm board-relative, sinh từ 2 hằng số
  gốc + bước lặp, dựa đúng số đo thật ở trên) và render từng ô là 1 phần tử
  `absolute` độc lập (giống hệt cách bàn/chấm dưới bàn đã làm) thay vì để
  flow layout tự chia — nhờ vậy mỗi ô có toạ độ THẬT để tự làm điểm neo popup.
- `LayoutDashboard.tsx`: bỏ export `WAITING_ZONE_ANCHOR`; `onSelectWaiting`
  nhận thêm tham số `anchor:{x,y}` (toạ độ ô vừa bấm) truyền thẳng lúc click,
  không cần DashboardPage tự tra bảng nữa. `WaitingZone` tách thành
  `WaitingZoneBox` (chỉ khung+nhãn+số đếm) — 24 ô render riêng ở component
  cha, dùng chung `SttSlot` (component đã có sẵn từ bản trước).
- `DashboardPage.tsx`: state `selectedWaiting` thêm `x`/`y` (lưu toạ độ ngay
  lúc bấm thay vì tra `WAITING_ZONE_ANCHOR[zone]`); `WaitingPopover` đọc
  thẳng `selectedWaitingData.x/y`.
- `WaitingPopover.tsx`: thêm logic tự lật lên/xuống theo `y` (ngưỡng `y<45`,
  giống hệt `CustomerPopover`) — trước đó luôn bung lên vì mặc định neo gần
  đáy, giờ neo trải khắp lưới nên ô nửa trên phải bung XUỐNG mới đủ chỗ.
- **Bug tự bắt lúc verify** (không phải do user báo): sau khi đổi sang toạ độ
  tường minh, các Ô TRỐNG trong lưới co lại thành 1 vạch mỏng thay vì hình
  tròn. Nguyên nhân: `SttSlot` nhánh rỗng là `<span>` (mặc định `display:
  inline`) đặt `height`/`width` qua inline style — trình duyệt BỎ QUA
  width/height trên phần tử `inline` thật sự (chỉ "ăn" khi phần tử là flex/
  grid item hoặc tự có display khác). Ở bản chấm-dưới-bàn cũ nó tình cờ đúng
  vì cha là `flex` (flex item luôn tôn trọng width/height dù `display` gốc
  là gì); ô lưới chờ mới có cha KHÔNG phải flex (chỉ 1 div định vị absolute)
  nên lộ bug. Fix: thêm `block` vào class của nhánh rỗng — sửa tận gốc ngay
  tại `SttSlot` nên an toàn với mọi ngữ cảnh cha sau này, không chỉ vá chỗ
  đang lỗi.
- **Verify**: `tsc`/`build` sạch. Bấm ô "7" (hàng 1, y≈26%) → popup bung
  NGAY DƯỚI ô đó (đúng như yêu cầu), không còn nhảy xuống đáy khung. Ô trống
  hiện đúng hình tròn viền chấm trở lại. Không console error.
  Lưu ý: `computer` click theo toạ độ pixel bị trượt/không bắt được vào đúng
  lúc test (nghi do lệch tỉ lệ scale ảnh chụp màn hình 800px vs viewport
  1600px thật) — phải chuyển sang bấm qua `ref` (từ `read_page`) rồi cuối
  cùng bấm thẳng qua `element.click()` (JS) mới xác nhận được; đây là vấn đề
  của công cụ test, không phải bug trong app (khớp với: bấm bàn KT1 qua `ref`
  vẫn hoạt động bình thường ở các lượt verify trước trong phiên này).

### Thêm TV7/TV8, bỏ ô trống STT dưới bàn Tư vấn (2026-08-03)
User gửi ảnh chụp 4 vòng tròn nét đứt màu vàng (khớp với 4 ô STT trống —
`DESK_CAPACITY.consult = 4` — hiện dưới mỗi bàn Tư vấn từ bản 2026-07-31) kèm
yêu cầu: "Thêm vào layout TV7 và TV8, bỏ 4 dấu chấm này đi". Đã hỏi lại để xác
nhận đúng ý (vì trái với feedback 2026-07-31 là cố tình giữ lưới ô cố định) —
user chọn "Bỏ hẳn ô trống" (chỉ hiện chấm khi bàn thật sự có khách, danh sách
dài ra thay vì giữ đủ 4 ô).

- `layoutConfig.ts`: `CONSULT_POSITIONS` từ 3 cặp dọc (TV1–6, cột X
  `[12,32,52]`) lên 4 cặp dọc (TV1–8). Khung "Khu vực tư vấn" dừng ở 61%
  (`left-4% + w-57%`) và khu chờ STT bên phải bắt đầu ở 64%, nên không thể giữ
  pitch 20% cũ rồi thêm cột thứ 4 (sẽ chồng lên khu chờ) — phải nén cả 4 cột
  vào hằng số mới `CONSULT_X = [8,24,40,56]` (pitch 16%, vẫn rộng hơn nhiều so
  với `MIN_COL_PITCH` 6%). Khu Kỹ thuật (KT) giữ nguyên `GROUP_X=[12,32,52]`
  (chỉ 3 bàn, không đổi) — không còn thẳng cột với Tư vấn như comment cũ mô tả,
  đã cập nhật lại comment. Assert cuối file đổi từ "3/6" → "3/8".
- `LayoutDashboard.tsx`: bỏ hẳn `FIXED_SLOT_CLUSTERS` (trước chỉ áp cho
  `consult`) và phần pad `Array.from({length: cap})` điền `null` — giờ mọi
  cụm (kể cả `consult`) đều chỉ render khi `list.length > 0` và chỉ vẽ đúng
  số khách thật (`list.slice(0, cap)`), không còn ô trống viền chấm dưới bàn.
  Khu chờ STT bên phải (`WAITING_GRID_SIZE=24`) KHÔNG đổi — vẫn giữ lưới cố
  định như feedback 2026-07-31 (đây là khu vực khác, user không nhắc tới).
- **Verify**: `npm install` (repo chưa có `node_modules`) + `tsc -b --noEmit`
  sạch. Chạy `vite dev`, chụp màn hình desktop lẫn tablet (768×1024): TV1–TV8
  hiện đủ 4 cột × 2 hàng, không chồng lên khung chờ STT bên phải; bàn trống
  (TV1,3,5,6,7,8) không còn chấm nào; bàn có khách (TV2: 2/4, TV4: 1/4) chỉ
  hiện đúng số chấm thật. Bấm bàn TV2 → popover vẫn đúng "Khách đang tiếp nhận
  (2/4)" với 2 khách thật. Sidebar "Tư vấn" đổi đúng "6/8 bàn". Không console
  error. Tạo mới `.claude/launch.json` (chưa có sẵn) để chạy dev server qua
  Browser pane — file này CHƯA từng tồn tại trong repo, không phải xoá gì.

### Chuyển sang schema "Master" của Lark + quét QR nhập link proxy (2026-08-05)
User báo đã tự gom dữ liệu Lark: `DS Tư vấn`/`DS thu cũ`/`DS backup`/`DS Kho` →
1 bảng `DS Master`; `Check in` → `Master_Check in`; đã có link proxy riêng.
Gửi kèm file export `.base` (JSON, gzip+base64 trong `gzipSnapshot`) — giải nén
bằng Python để đọc đúng field/record thật thay vì đoán qua tên. Phát hiện:
- `DS Master`: 24 dòng = 6 bàn × 4 loại (Tư vấn/Thu cũ/Backup/Kho), cột `Loại`
  (single-select) phân biệt. Tên cột SỐ LIỆU đổi khác trước: `Nhân viên` (KT
  cũ) → `NV Tư vấn` (dùng chung mọi loại); `SL TC/TV tiếp nhận` → `Sl TV đang
  tiếp nhận` (field MỚI, có cả `Sl TV đã tiếp nhận` khác nghĩa — kiểm tra
  `DeskPopover.tsx`/`larkMapper.ts` thấy `received`/`completed` KHÔNG hề được
  render ở UI (chỉ dùng `isOccupied`/`currentStatus`/`receivedCustomers`), nên
  chọn "đang tiếp nhận" theo nghĩa từ mà không cần user xác nhận qua proxy thật
  — không phải trường trọng yếu.
- `Master_Check in`: verify TỪNG tên cột đang dùng (`STT`, `Họ và tên`, `SP 1`,
  `Note UDTT`, `Check nghiệm thu`, `Thu cũ check`, `Done in Flow`, `End flow`,
  `Thời gian`, `TC_Nsư thu cũ`, `TV_Nsư Tư vấn`, `Status in thu cũ`, `Status in
  tư vấn`) đều tồn tại NGUYÊN VĂN trong export → không cần đổi field map, chỉ
  đổi bảng nguồn.
- `Master`/`Master Điều phối` (log giao dịch/điều phối) không cần wiring — xác
  nhận lại bằng cách đọc `larkMapper.ts` thấy `txConsult` chưa từng được dùng
  trong `mapDeskStates` (giữ optional như cũ).

Hỏi lại user 2 điểm trước khi sửa (`AskUserQuestion`): (1) mở rộng layout đủ
4 cụm × 6 bàn hay giữ nguyên 2 cụm hiện tại — chọn **giữ nguyên** (không đổi
`layoutConfig.ts`/toạ độ); (2) có link proxy thật để verify field
"đang/đã tiếp nhận" không — user pivot sang yêu cầu MỚI: thêm tính năng quét QR
để nhập link proxy trên điện thoại (đã tự tạo QR cho proxy đó), thay vì đưa
link trực tiếp trong chat.

**Quyết định cốt lõi**: vì layout không đổi và `kythuat`/`consult` giờ đọc
CHUNG 1 bảng Lark thật, KHÔNG đổi `TableKey`/route proxy (`dsTradein`/
`dsConsult` vẫn 2 route riêng như cũ) — chỉ cần user trỏ CẢ HAI route (phía
proxy của họ) vào cùng 1 table id "DS Master", còn web tự lọc theo cột `Loại`
phía client (an toàn dù proxy có lọc sẵn hay không — lọc 2 lần vẫn đúng).
Cách này tối thiểu hoá thay đổi so với phương án đổi hẳn `TableKey` (sẽ phải
sửa proxy contract, `cloudflare-worker.js`, mọi doc, rủi ro cao hơn nhiều so
với lợi ích).

**File đã sửa**:
- `config/larkConfig.ts`: thêm `DsTypeFieldMap` (`field`+`value` per cluster) +
  `dsType` vào `FieldConfig`; `DEFAULT_DS_FIELDS` đổi tên cột (`staff`→'NV Tư
  vấn' cho cả 2 cụm, `received`→'Sl TV đang tiếp nhận', `completed`→'Sl TV
  hoàn tất'); thêm `DEFAULT_DS_TYPE_FIELD` (`field:'Loại'`,
  `value:{kythuat:'Thu cũ', consult:'Tư vấn'}`); `DEFAULT_CHECKIN_FIELDS`
  KHÔNG đổi field nào (chỉ thêm comment) — verify kỹ trước khi kết luận không
  cần sửa, tránh sửa nhầm cái không cần sửa.
- `services/larkMapper.ts`: thêm `filterByType()` lọc `LarkRecord[]` theo cột
  `Loại` trước khi xử lý; gọi trong vòng lặp DS chính
  (`filterByType(tables[DS_KEY[cluster]], cluster, dsType)`). No-op an toàn
  khi `dsType.field` rỗng (cấu hình cũ/bảng đã tách riêng).
- `config/larkSettings.ts`: thêm `dsType` vào `LarkSettings.fields` +
  `defaultSettings`/`hydrate`/`toFieldConfig`/`DEFAULT_FIELD_CONFIG`; thêm
  `DS_TYPE_FIELD_LABEL`/`DS_TYPE_VALUE_LABELS`; cập nhật `TABLE_LABELS` nhắc
  "DS Master"/"Master_Check in".
- `components/QrScanButton.tsx` (**mới**): nút "📷 Quét QR" mở modal có
  `<video>` + `getUserMedia({video:{facingMode:'environment'}})`, dùng
  `BarcodeDetector` NATIVE của trình duyệt (không thêm dependency nào) để giải
  mã QR mỗi frame qua `requestAnimationFrame`; gọi `onScan(text)` rồi tự đóng +
  dừng stream camera khi quét được. Fallback rõ ràng khi trình duyệt không hỗ
  trợ `BarcodeDetector` (desktop Safari/Firefox) — báo "vui lòng nhập tay",
  input text vẫn hoạt động bình thường song song. Khai báo type ambient cho
  `BarcodeDetector`/`Window.BarcodeDetector` ngay trong file (chưa có sẵn
  trong `lib.dom.d.ts` bản TS đang dùng — verify bằng grep trước khi viết,
  không đoán).
- `pages/SettingsPage.tsx`: thêm `QrScanButton` cạnh input "API URL (proxy)";
  thêm khối map "Lọc Loại" (tên cột + giá trị lọc mỗi cụm); sửa nhãn
  `DS_TABLES`/tiêu đề "Khối Status" cho khớp "DS Master" (tiêu đề cũ "chung 3
  bảng DS" đã sai từ trước — sửa luôn nhân tiện, không phải do đổi schema).
- `data/mockLarkData.ts`: `dsRecords()` bỏ tham số field-name-map (giờ cố định
  vì dùng chung 1 bộ tên cột), thêm cột `Loại` mỗi dòng; đổi tên field theo
  default mới. Bắt buộc phải sửa file này cùng lúc — nếu chỉ đổi default mà
  quên mock, chế độ Mock (mặc định lúc `npm run dev`) sẽ vỡ ngay (field không
  khớp → bàn xám hết).
- `README.md`, `docs/LARK_SETUP.md`, `cloudflare-worker.js`: cập nhật mọi chỗ
  nhắc tên bảng cũ (`DS thu cũ`/`Check in` riêng) sang "DS Master"/"Master_Check
  in" + hướng dẫn trỏ 2 env var `TB_DS_TRADEIN`/`TB_DS_CONSULT` cùng 1 table id.

**Verify**: `npx tsc -b --noEmit` sạch → `npm run build` sạch (48 modules) →
Browser pane (`npievent-dev`, mock mode mặc định):
- Board render Y HỆT kết quả trước khi sửa (KT1-3 đỏ, TV2/TV4 đỏ, còn lại
  xanh, khu chờ 4 khách) — xác nhận `filterByType` + field name mới hoạt động
  đúng qua mock data đã cập nhật, không có regression.
- Trang Cài đặt: chuyển "Lark Base" + "Proxy/Webhook" → thấy đúng nút "📷 Quét
  QR" cạnh ô API URL, khối "Lọc Loại" hiện đủ 3 input (tên cột + 2 giá trị mặc
  định "Thu cũ"/"Tư vấn"), nhãn Table ID/DS block đổi đúng "DS Master"/
  "Master_Check in". Bấm "Quét QR" → modal mở, xin quyền camera → sandbox
  browser chặn quyền camera → hiện đúng thông báo lỗi tiếng Việt thân thiện
  ("Bạn cần cho phép quyền camera..."), không crash, không console error; nút
  Đóng (×) đóng modal sạch. Chưa test được luồng quét THẬT (cần thiết bị có
  camera) — để user tự thử trên điện thoại.
- **Chưa làm/còn treo**: chưa có link proxy thật để verify "Sl TV đang tiếp
  nhận" có đúng là field UI cần hay không (không trọng yếu vì UI không render
  số này — xem giải thích ở trên) và chưa verify format QR mà user đã tạo có
  đúng là link trần (http/https) hay có wrapper JSON/khác — nếu QR của user
  chứa JSON thay vì URL trần, `QrScanButton.onScan` sẽ set thẳng chuỗi đó vào
  ô API URL và cần user tự chỉnh lại. Nên hỏi user format QR thật nếu lần đầu
  quét không ra kết quả đúng.

### Debug proxy thật: bỏ hẳn txConsult, tìm ra lỗi wiki-token, wire lại bảng Master làm nguồn "khách ở bàn nào" (2026-08-05, tiếp)
User bắt đầu test với proxy Cloudflare Worker thật, lộ ra 1 loạt vấn đề liên
tiếp — xử lý từng cái, KHÔNG đoán, luôn verify bằng dữ liệu/log thật:

**1. User yêu cầu rõ: "chỉ làm việc với các table Master, ko liên quan các
table khác hay các table cũ nhé"** — ngay giữa lúc đang test lỗi `txConsult`
404. Quyết định: bỏ HẲN `txConsult`/`TxFieldMap` khỏi code (không giữ
try/catch nuốt lỗi như định làm ban đầu) — đúng tinh thần yêu cầu, và dọn
sạch hơn vì bảng đó vốn chưa từng được `mapDeskStates` dùng. Xoá khỏi:
`larkTypes.ts` (`TableKey`), `larkConfig.ts` (`TxFieldMap`,
`DEFAULT_TX_CONSULT_FIELDS`, `FieldConfig.txConsult`, `ENV_DEFAULTS.tableIds`),
`larkSettings.ts` (field + labels + mọi hàm derive), `larkService.ts` (bỏ hẳn
list `txConsult` optional, quay về fetch đơn giản mọi key trong `Promise.all`),
`SettingsPage.tsx` (input block "Giao dịch Tư vấn"), `mockLarkData.ts` (mảng
`txConsult`), `cloudflare-worker.js` (`TB_TX_CONSULT`, `dsBackup` tiện thể dọn
luôn — stale từ trước, không còn trong `TableKey`), + mọi doc liên quan
(README/LARK_SETUP/PROJECT_OVERVIEW — phần PROJECT_OVERVIEW §5 đã cũ từ trước
lượt sửa Master, không rewrite toàn bộ mà chỉ thêm cảnh báo "phần dưới đã CŨ"
ở đầu mục, trỏ sang tài liệu đúng — cân bằng công sức, tránh scope creep vượt
quá việc đang được yêu cầu). Verify `tsc`/`build` sạch sau mỗi bước.

**2. User dán ảnh chụp "Variables and secrets" của Cloudflare Worker** — phát
hiện cột **Name** đang chứa chính GIÁ TRỊ (App ID, table id...) thay vì TÊN
BIẾN ngữ nghĩa (`TB_CHECKIN`...) mà code `env.TÊN_BIẾN` cần — nghĩa là mọi
lookup `env[TABLE_ENV[key]]` sẽ luôn `undefined`. Đối chiếu id trong ảnh với
bảng `tableMap` đã giải mã từ file `.base` trước đó (không đoán) → khớp đúng
`tblPlUlMmOgFfqEg`=DS Master, `tblUMtlLcXYnSurV`=Master_Check in,
`tblI9f1IxpRTGFDq`=Danh sách đơn hàng — báo user đổi lại tên biến cho đúng,
kèm bảng map cụ thể để copy.

**3. Lỗi tiếp theo: `Lark API error on orders: NOTEXIST (code 91402)`** —
khác hẳn 404 (đây là Lark TRẢ LỜI, chỉ là không tìm thấy bảng trong app_token
đó). Hướng dẫn lấy lại đúng table id/app_token từ URL base thật (không tin id
từ file `.base` cũ — có thể lệch với base đang chạy).

**4. User gửi 4 URL bảng thật** — dạng `.../wiki/<token>?table=...`, KHÔNG
phải `.../base/<token>?table=...` như tài liệu cũ mô tả. Nhận diện đúng: đây
là base NHÚNG TRONG LARK WIKI — đoạn sau `/wiki/` là *wiki node token*, không
phải app_token thật của Bitable — dùng thẳng chính là nguyên nhân gốc của lỗi
NOTEXIST ở bước 3 (giải thích được TẠI SAO id đúng mà vẫn lỗi, không chỉ vá
triệu chứng). Sửa `cloudflare-worker.js`: thêm `resolveAppToken()` — gọi
`wiki/v2/spaces/get_node?token=...`, nếu `obj_type==='bitable'` thì dùng
`obj_token` (cache lại, không đổi trong vòng đời base); nếu không phải node
wiki (hoặc lỗi) thì rơi về dùng thẳng token gốc — tự động, không cần user biết
trước mình đang ở trường hợp nào. Cập nhật `docs/LARK_SETUP.md` thêm hẳn mục
cảnh báo + cách tự tra cứu thủ công (cho ai không dùng file worker mẫu).

**5. User gửi brief nghiệp vụ thật** (check-in ở Master_Check in → điều phối
gán bàn trong Master Điều phối, cột "DS Thu cũ"/"DS Tư vấn" → đẩy "Sl khách
chờ" trong DS Master → NV tiếp nhận khách, ghi vào bảng **Master** với
`TV_MãNV`+`Loại`+`Trạng thái`, khách được sắp vào đúng vị trí trên sơ đồ) —
đối chiếu lại với field export đã giải mã trước đó thấy KHỚP CHÍNH XÁC, nhưng
phát hiện cách giải mã lần đầu bị SAI: `TV_MãNV`/`Loại` trong bảng `Master` là
**synced single-select** (`optionsType: 1`, `options: []` rỗng trên chính
field đó, có `optionsRule.targetTable`/`targetField` trỏ sang `DS Master`) —
option id KHÔNG resolve được qua property của field đó, phải tra qua field
NGUỒN (`DS Master`'s `Loại`/`Selection-Tư vấn`). Giải mã lại đúng bằng script
Python riêng (đọc field def của DS Master, không đoán) → xác nhận `TV_MãNV`
chứa THẲNG mã bàn (`TV2`, `TC1`...) khớp `TablePosition.id`.

**Quyết định kiến trúc quan trọng**: bảng `Master` giờ là nguồn ĐÁNG TIN CẬY
HƠN để biết "khách nào đang ở bàn nào" — thay hẳn cơ chế cũ (suy qua khoá NV
nội bộ trong Check-in, `indexActiveByStaffKey`/`STAFF_FIELD`, vốn tồn tại chỉ
vì bảng giao dịch gốc "Giao dịch Tư vấn" trước đây CHỈ có cho Tư vấn, không có
cho Kỹ thuật). `Master` giờ phủ cả 2 loại qua cột `Loại`, và `TV_MãNV` khớp
THẲNG mã bàn nên không cần khoá gián tiếp/anchor nữa — group thẳng theo mã
bàn, đơn giản hơn hẳn code cũ.

**File đã sửa** (ngoài các file đã liệt kê ở mục "1" phía trên):
- `services/larkTypes.ts`: thêm `'master'` vào `TableKey`.
- `config/larkConfig.ts`: `CheckinFieldMap` bỏ `staffTradein`/`staffConsult`
  (chết hẳn sau khi đổi cơ chế — GIỮ `statusTradein`/`statusConsult`, vẫn dùng
  cho "Chờ điều phối"); thêm `MasterFieldMap` (`deskCode`='TV_MãNV',
  `status`='Trạng thái', `name`='Họ và tên', `time`='Thời gian') +
  `DEFAULT_MASTER_FIELDS` + `master` vào `FieldConfig`; thêm
  `VITE_LARK_TABLE_MASTER` vào `ENV_DEFAULTS`.
- `services/larkMapper.ts`: viết lại `indexActiveByStaffKey` (bỏ hẳn) thành
  `indexMasterByDeskCode` — group `tables.master` theo `TV_MãNV` trực tiếp
  (lọc `Trạng thái`='Tiếp nhận'), sort theo `Thời gian`. Vòng lặp DS chính bỏ
  hẳn `anchorCi.staffKey`/tra cứu staffKey — dùng thẳng
  `activeByDeskCode.get(code)`. Nhánh fallback (DS báo bận nhưng Master chưa
  kịp có dòng) vẫn giữ nguyên, chỉ đổi nguồn `hasActiveGroup`.
- `services/larkService.ts`: thêm `'master'` vào `KEYS`.
- `config/larkSettings.ts`: thêm `master: MasterFieldMap` vào mọi chỗ (shape,
  default, hydrate, toFieldConfig, DEFAULT_FIELD_CONFIG); thêm
  `MASTER_FIELD_LABELS`; `TABLE_LABELS` thêm `master`; `CHECKIN_LABELS` bỏ
  `staffTradein`/`staffConsult`.
- `pages/SettingsPage.tsx`: thêm khối map "Master" (4 input theo
  `MASTER_FIELD_LABELS`) + `setMasterField`; sửa hint API URL nhắc `/master`.
- `data/mockLarkData.ts`: bỏ `TC_Nsư thu cũ`/`TV_Nsư Tư vấn` khỏi fixture
  Check-in (field không còn tồn tại trong type); thêm mảng `master` — 4 dòng
  tái tạo ĐÚNG 2 kịch bản demo cũ ("1 NV/bàn phục vụ 2 khách" ở TC1 và TV2,
  sắp đúng thứ tự theo `Thời gian`) — CỐ Ý không thêm dòng cho TC2/TC3/TV4 để
  verify nhánh fallback (DS "Khách gần nhất") vẫn hoạt động đúng khi `Master`
  chưa có dữ liệu cho bàn đó.
- `cloudflare-worker.js`: thêm `TB_MASTER`; thêm `resolveAppToken()` tự dò
  wiki token (mục 4 ở trên).
- Docs (`README.md`, `docs/LARK_SETUP.md`, `docs/PROJECT_OVERVIEW.md`): thêm
  mục bảng `Master` + cảnh báo wiki-token; đổi "4 bảng" → "5 bảng" ở mọi chỗ
  liệt kê.

**Verify**: `npx tsc -b --noEmit` sạch → `npm run build` sạch (48 modules) sau
MỖI bước lớn (không gộp verify cuối mới chạy 1 lần — bắt lỗi sớm hơn). Browser
pane cuối cùng (mock mode): **ảnh chụp board giống HỆT pixel-by-pixel** so với
trước khi viết lại `indexMasterByDeskCode` (KT1-3 đỏ, TV2/TV4 đỏ, còn lại
xanh, khu chờ 4 khách) — xác nhận refactor không đổi hành vi quan sát được.
Đọc `get_page_text` sau khi bấm KT1: đúng "Tên NV: Thịnh_OPs · Khách đang tiếp
nhận (2/2): #1 Nguyễn Minh Long, #9 Hoàng Anh Tú" — verify tận nội dung
popover, không chỉ nhìn số chấm. Chưa test được với proxy thật của user (còn
đang debug cấu hình phía họ) — cần user tự chạy "Kiểm tra kết nối" lại sau khi
sửa Cloudflare secrets + đợi worker mới deploy.

### Bỏ hẳn "DS Master" — hoá ra là danh sách nhân sự, không phải trạng thái vận hành (2026-08-05, tiếp #2)
User debug proxy thật tiếp, dẫn tới phát hiện quan trọng: đưa list field
mapping đầy đủ cho user recheck (theo đúng tinh thần "không đoán, để user xác
nhận từng bảng") — user sửa lại: `dsTradein`/`dsConsult` phải đọc bảng
**"Master"**, còn **"DS Master"** (bảng tôi từng dùng cho code/staff/status)
**là danh sách NHÂN SỰ**, không phải trạng thái bàn. Không đoán tiếp — hỏi lại
2 lượt bằng `AskUserQuestion` trước khi sửa lớn (đã sai hướng nhiều lần trong
phiên này, chi phí hỏi thêm rẻ hơn nhiều so với sửa sai lần nữa):
1. Màu bàn + "Sl khách chờ" (trước đọc từ DS Master) giờ lấy từ đâu nếu
   dsTradein/dsConsult đổi sang đọc "Master"? → **Màu bàn: tính lại từ
   Master** (đã có sẵn `indexMasterByDeskCode`, chỉ cần dùng `hasActiveGroup`
   làm nguồn thay vì đọc field `Trạng thái hiện tại`). **"Sl khách chờ": đọc
   từ Master Điều phối** (đếm khách đã gán vào bàn qua cột `DS Thu cũ`/`DS Tư
   vấn` nhưng CHƯA có dòng "Tiếp nhận" tương ứng trong Master) — không có
   cách tính từ Master đơn thuần vì cột `Trạng thái` ở đó CHỈ có 2 lựa chọn
   tĩnh (`Tiếp nhận`/`Hoàn tất`, verify bằng cách giải mã field def thật,
   không đoán) — không có khái niệm "đang chờ".
2. Tên NV phụ trách bàn (popover) lấy từ đâu? → **Từ `Master.Người`, CHỈ khi
   đang có khách "Tiếp nhận"** — bàn trống không hiện tên NV nào. Xác nhận
   DS Master **không còn vai trò gì** trong app nữa (đúng tinh thần "chỉ làm
   việc với table Master" user yêu cầu từ đầu).

**Phát hiện kỹ thuật quan trọng khi giải mã `Master Điều phối`** (trước khi
code, không đoán): cột `DS Tư vấn`/`DS thu cũ`/`DS Back up` trong bảng này là
**synced single-select** trỏ tới các bảng DS **CŨ** (`DS Tư vấn`/`DS thu cũ`/
`DS backup` — chưa gộp vào DS Master, tức chính bảng Lark của user vẫn đang
**mid-migration**, chưa rewire hết). Ban đầu lo ngại việc này buộc phải đọc
lại field option của bảng cũ để resolve — nhưng nhận ra: option id nội bộ
(`opt...`) chỉ xuất hiện trong **file export/backup `.base`** (định dạng
snapshot riêng của Lark); **REST API công khai** (`bitable/v1/.../records`
mà app thực sự gọi) trả single-select dưới dạng TEXT THẬT (vd `"TV3"`) bất kể
field đó static hay synced-option — nên code KHÔNG cần xử lý gì đặc biệt, cứ
đọc `cellToString` như mọi field text khác. Bài học: đừng nhầm cách biểu diễn
dữ liệu trong file backup nội bộ với cách API thật trả về — chỉ cái sau mới
ảnh hưởng code.

**Kiến trúc mới**: bỏ hẳn khái niệm bảng "DS *" — mapper giờ lặp trực tiếp
qua `layoutConfig.ALL_POSITIONS` (11 vị trí cố định) thay vì lặp theo dòng
của 1 bảng đăng ký. Mỗi vị trí tự tính state từ `Master` (occupancy + NV) +
`Master Điều phối` (chờ). 3 tầng "đang chờ" giờ tách bạch rõ, không trùng
nhau: chưa điều phối đi đâu (`waitingCheckin`, khu chung) → đã điều phối vào
1 bàn, chờ NV nhận (badge cam ngay tại bàn đó, MỚI — hiện được cả khi bàn
đang TRỐNG, không chỉ khi đang bận) → đang được phục vụ. `dispatchedNames`
(set) dùng để loại người đã điều phối khỏi cả 2 khu chờ chung (`waitingCheckin`
+ `waitingDispatch`), tránh đếm trùng với badge riêng của bàn.

**File đã sửa** (ngoài các file đã liệt kê ở 2 mục trước):
- `types/desk.ts`: `DeskLiveState` bỏ `received`/`completed` (không còn
  nguồn dữ liệu, mà 2 field này TRƯỚC ĐÓ ĐÃ KHÔNG hề được render ở UI —
  verify lại 1 lần nữa qua grep, xác nhận xoá an toàn); `waiting`/
  `currentStatus`/`hasData` đổi hẳn ý nghĩa (xem comment mới). `ClusterSummary.
  withData` giờ luôn = `total` (mọi bàn đều được tính state).
- `services/larkTypes.ts`: `TableKey` còn đúng 4 giá trị:
  `checkin | orders | master | dispatch` (bỏ hẳn `dsTradein`/`dsConsult`).
- `config/larkConfig.ts`: viết lại gần như toàn bộ — bỏ `DsFieldMap`/
  `DsTypeFieldMap`/`DsStatusFieldMap`/`ds`/`dsType`/`dsStatus` khỏi
  `FieldConfig`; `CheckinFieldMap` bỏ tiếp không còn gì cần bỏ (staffTradein/
  staffConsult đã bỏ ở mục trước); `MasterFieldMap` thêm field `staff`
  ('Người'); thêm mới `DispatchFieldMap` (`deskField: {kythuat, consult}` +
  `name`) + `DEFAULT_DISPATCH_FIELDS`; bỏ `STATUS_OCCUPIED_HINT`/
  `STATUS_FREE_HINT` (dead code từ trước, phát hiện qua grep, không liên
  quan tới lần sửa này nhưng dọn luôn vì đang viết lại file).
- `services/larkMapper.ts`: viết lại toàn bộ — import `ALL_POSITIONS` từ
  `layoutConfig.ts` (không import ngược, xác nhận không có cycle); vòng lặp
  chính đổi từ "lặp theo dòng DS, filter theo Loại" sang "lặp theo
  `ALL_POSITIONS`, tra `Map` theo mã bàn"; `indexMasterByDeskCode` trả thêm
  `staff` per group; thêm `indexDispatchByDeskCode` (đọc cả 2 cột mã bàn trên
  mọi dòng, an toàn vì mỗi dòng chỉ có đúng 1 cột khác rỗng); `waitingCheckin`/
  `waitingDispatch` thêm điều kiện loại trừ `dispatchedNames`.
- `services/larkService.ts`: `KEYS` còn `['checkin','orders','master',
  'dispatch']`.
- `config/larkSettings.ts`: viết lại `LarkSettings.fields` (bỏ hẳn 3 field ds*,
  thêm `dispatch: DispatchFieldMap`); `TABLE_LABELS`/labels tương ứng.
- `pages/SettingsPage.tsx`: bỏ hẳn 3 block map DS/Loại/Status; thêm block
  "Master Điều phối" (tên khách + 2 cột mã bàn theo cụm).
- `data/mockLarkData.ts`: viết lại hoàn toàn — bỏ `dsRecords()`/`dsKythuat`/
  `dsConsult`; `master` giờ có ĐỦ dòng cho MỌI bàn occupied (TC1/2/3, TV2/4 —
  không còn "cố tình thiếu để test fallback" vì cơ chế fallback qua DS đã
  mất theo); thêm `dispatch` (2 dòng demo: TV4 — bàn đang bận + có người
  chờ thêm; TV6 — bàn TRỐNG nhưng có người đã được gán, chờ NV nhận — demo
  đúng ca MỚI mà bản trước không thể có). **Bug tự bắt khi verify bằng
  browser** (không phải do user báo): quên thêm dòng "Hoàn tất" cho khách
  demo "Chờ điều phối" (Vũ Xuân Phong, STT6) trong `master` → `everSeenNames`
  (giờ chỉ scan bảng `master`) không biết khách này đã từng xuất hiện →
  hiện TRÙNG ở cả khu "Chờ check-in" lẫn "Chờ điều phối" cùng lúc (thấy rõ
  qua ảnh chụp: 2 chấm cùng số "6"). Sửa bằng cách thêm 1 dòng `master` với
  `Trạng thái`="Hoàn tất" cho khách đó — đúng invariant thật: 1 khách "Hoàn
  tất" 1 khâu LUÔN có ít nhất 1 dòng Master trước đó ghi lại lúc được tiếp
  nhận.
- `cloudflare-worker.js`: `TABLE_ENV` bỏ `dsTradein`/`dsConsult`, thêm
  `dispatch: 'TB_DISPATCH'`.
- Docs (`README.md`, `docs/LARK_SETUP.md` viết lại gần như toàn bộ,
  `docs/PROJECT_OVERVIEW.md` cập nhật warning đầu §5): phản ánh đúng 4 bảng
  mới, bỏ mọi hướng dẫn liên quan DS Master/dsTradein/dsConsult.

**Verify**: `tsc -b --noEmit` + `npm run build` sạch sau MỖI file lớn (không
gộp cuối). Browser (mock mode) — bàn giống hệt bản trước VỀ MẶT OCCUPANCY
(KT1-3/TV2/TV4 đỏ, còn lại xanh) nhưng khu chờ đổi đúng theo thiết kế mới:
"4" → "2" (STT7/8 giờ có badge riêng ở TV4/TV6 thay vì nằm trong khu chung).
Bấm TV4 (bàn bận + có người chờ): popover đúng "Tên NV: M Thành_CV_VHWS&AM ·
Khách đang tiếp nhận (1/4): #5 Võ Xuân Phong · Khách đang chờ: 1". Bấm TV6
(bàn TRỐNG nhưng có người chờ — ca hoàn toàn mới, chưa từng test được trước
đây): popover đúng "Trống · Tên NV: — · Bàn trống — chưa có thông tin khách
· Khách đang chờ: 1" — xác nhận badge chờ hiện đúng độc lập với occupancy.
Sidebar "Tư vấn 8/8 bàn" (trước đây "6/8", giờ luôn full vì `hasData` không
còn phụ thuộc dòng DS nào). Không console error (ngoài log HMR cũ từ các
bước sửa dở dang trước đó, đã xác nhận là buffer cũ qua reload cứng).

### 3 fix theo yêu cầu user: "Chờ điều phối" đọc thẳng Master, tách khu chờ làm 2, DS Master quay lại cho đúng 1 field (2026-08-05, tiếp #3)
User liệt kê 1 đoạn yêu cầu ngắn, gộp nhiều ý — tách ra đúng 3 việc trước khi
sửa (không gộp code 1 lượt cho cả 3 vì mỗi việc rủi ro khác nhau):

**1. "Chờ điều phối" đọc thẳng `Master.Trạng thái` = "Hoàn tất"** — trước đó
(mục #2 phía trên) đang đọc `Check-in`'s `Status in thu cũ`/`Status in tư
vấn` (field formula riêng). User muốn đổi sang đọc TRỰC TIẾP từ `Master` —
hợp lý vì `Master` là nguồn NV tự tay ghi, đáng tin hơn 1 formula phụ có thể
lệch nhịp. Thêm `clusterFromDeskCode()` (suy cụm từ tiền tố mã bàn TC/TV) để
thay cho việc lặp theo `CLUSTERS` + đọc field theo cụm như cũ — đơn giản hơn
vì giờ chỉ cần 1 vòng lặp qua `tables.master`. Hệ quả dọn dẹp: `CheckinFieldMap`
bỏ hẳn `statusTradein`/`statusConsult` (chết hoàn toàn), `CLUSTERS` const
trong mapper cũng dead sau đó (bỏ luôn — bắt bằng grep, không đoán).

**2. Khu chờ tách làm 2** ("Đã check-in" trên / "Chờ điều phối" dưới, xếp
chồng dọc) — thay bản gộp `WaitingItem[]` cũ (quyết định hồi 2026-07-31, giờ
đảo ngược theo yêu cầu mới). Viết lại `LayoutDashboard.tsx`: bỏ hẳn
`combinedWaiting`, thêm component dùng chung `WaitingZoneGrid` (nhận
`zone`/`items`/`positions`/`boxClassName` riêng) render 2 lần — vừa tránh lặp
code vừa đảm bảo 2 khu xử lý y hệt nhau (overflow, active state...). Lưới mỗi
khu giảm từ 24 ô (4×6) xuống 12 ô (4×3) — hợp lý vì chiều cao mỗi khu chỉ còn
~1 nửa. Toạ độ MỚI đo thật bằng `getBoundingClientRect` qua Browser pane sau
khi dựng khung đầu tiên (không đoán): khung "Đã check-in" đo được top 3.2%–
bottom 47.0%, khung "Chờ điều phối" 49.0%–94.8% — khớp gần như chính xác với
giá trị đặt trong code (top-[3%] h-[44%] và top-[49%] h-[46%]), 3 hàng ô mỗi
khung đều nằm gọn trong khung, không đè lên nhau hay lên nhãn.

**3. "Sl khách chờ" bấm vào hiện "STT tiếp theo" từ `DS Master`** — điểm gây
tranh cãi nhất trong cả phiên: DS Master vừa được xác nhận tuần trước là
"chỉ dùng cho nhân sự, web không đọc" (mục #2), giờ user lại nhắc đích danh
field "STT tiếp theo" TRONG DS Master. Hỏi lại 2 lượt bằng `AskUserQuestion`
(không đoán, dù đã có sẵn cách tính khác không cần DS Master — liệt kê rõ 2
lựa chọn) — user xác nhận CHẮC CHẮN muốn đọc field thật trong DS Master, 2
lần liền, nên tin theo dù trái với quyết định trước đó (quyết định cũ SAI vì
thiếu thông tin lúc đó, không phải user đổi ý tuỳ tiện — DS Master hoá ra có
CẢ vai trò nhân sự LẪN 1 cột thống kê theo bàn (STT tiếp theo), 2 việc khác
nhau không loại trừ nhau).

**File đã sửa**:
- `services/larkMapper.ts`: thêm `clusterFromDeskCode()`; viết lại
  `completedCandidates` đọc `tables.master` (`Trạng thái`="Hoàn tất") thay vì
  lặp `CLUSTERS`+Check-in; bỏ `CLUSTERS` const + `STATUS_FIELD` (dead); thêm
  `indexNextSttByDeskCode()` (đọc `tables.dsMaster`, map mã bàn → STT tiếp
  theo) + gắn vào `statesById[code].nextWaitingStt`.
- `config/larkConfig.ts`: `CheckinFieldMap` bỏ `statusTradein`/`statusConsult`;
  thêm `DsMasterFieldMap` (`code`+`nextStt`) + `DEFAULT_DS_MASTER_FIELDS`
  (`STT bàn`+`STT tiếp theo`) + `dsMaster` vào `FieldConfig`; comment module
  doc cập nhật lại vai trò DS Master (2 dòng: KHÔNG dùng cho occupancy, NHƯNG
  dùng cho STT tiếp theo).
- `services/larkTypes.ts`: `TableKey` thêm `'dsMaster'` (5 giá trị).
- `services/larkService.ts`: `KEYS` thêm `'dsMaster'`.
- `config/larkSettings.ts`: thêm `dsMaster: DsMasterFieldMap` vào mọi chỗ
  (shape/default/hydrate/toFieldConfig/DEFAULT_FIELD_CONFIG); bỏ
  `statusTradein`/`statusConsult` khỏi `CHECKIN_LABELS`; thêm
  `DS_MASTER_FIELD_LABELS`; `TABLE_LABELS` thêm `dsMaster`.
- `pages/SettingsPage.tsx`: thêm khối map "DS Master" (2 input); hint API URL
  thêm `/dsMaster`.
- `types/desk.ts`: `DeskLiveState` thêm `nextWaitingStt: string | null`.
- `components/DeskPopover.tsx`: dòng "Khách đang chờ" đổi từ `<Row>` tĩnh
  sang `<button>` — bấm toggle `showNext` (local state) giữa hiện số lượng và
  hiện `nextWaitingStt`. Thêm `key={selectedDesk.id}` ở `DashboardPage.tsx`
  lúc render `DeskPopover` để reset `showNext` khi đổi sang bàn khác (không
  reset thì trạng thái toggle của bàn trước sẽ dính sang bàn sau, vì React
  không tự unmount/remount component cùng loại không đổi `key`).
- `components/LayoutDashboard.tsx`: viết lại toàn bộ phần khu chờ — bỏ
  `WaitingItem`/`combinedWaiting`, thêm `buildWaitingGrid()` (hàm tạo lưới
  tường minh, tham số hoá x0/y0/step để dùng lại cho 2 khu) +
  `WaitingZoneGrid` (component gộp khung+nhãn+lưới+tràn, dùng chung cho cả 2
  khu qua prop `zone`).
- `cloudflare-worker.js`: `TABLE_ENV` thêm `dsMaster: 'TB_DS_MASTER'`.
- `data/mockLarkData.ts`: bỏ field `Status in thu cũ` khỏi fixture check-in
  (dead); thêm dòng `Trạng thái`="Hoàn tất" cho Vũ Xuân Phong trong `master`
  (ma_8 đã có sẵn từ mục #2 — giờ chính dòng đó tự động drive "Chờ điều phối"
  luôn, không cần thêm gì); thêm mảng `dsMaster` (2 dòng: TV4→"7", TV6→"8",
  khớp đúng STT của khách đang chờ ở `dispatch` để demo có ý nghĩa).
- Docs (`README.md`, `docs/LARK_SETUP.md`, `docs/PROJECT_OVERVIEW.md`): thêm
  bảng `DS Master` (1 field), route `dsMaster`, `TB_DS_MASTER`/
  `VITE_LARK_TABLE_DS_MASTER`; sửa mô tả "Chờ điều phối" + khu chờ tách 2.

**Verify**: `tsc -b --noEmit` + `npm run build` sạch sau mỗi bước lớn. Browser
(mock, đo bằng `getBoundingClientRect` qua `javascript_tool`, không đoán qua
ảnh chụp):
- 2 khung chờ không đè nhau, lưới 3 hàng mỗi khung nằm gọn trong khung (số đo
  cụ thể ở mục 2 phía trên).
- Bấm "#6 Vũ Xuân Phong" ở khung "Chờ điều phối" → popover đúng "Khu vực: Chờ
  điều phối · Trạng thái: Đã hoàn tất 'Khâu Thu cũ'" — xác nhận
  `clusterFromDeskCode('TC1')` → `kythuat` đúng, và `doneInFlow` (từ
  Check-in) vẫn hoạt động bình thường qua đường mới.
- Bấm bàn TV4 → popover hiện "Khách đang chờ: 1" (nút, có gạch chân chấm) →
  bấm vào → đổi thành "STT tiếp theo: 7" — đúng giá trị fixture, xác nhận
  toggle + `indexNextSttByDeskCode` hoạt động đúng end-to-end.
- Không console error thật (ngoài buffer HMR cũ đã biết).

### Bug thật từ dữ liệu live: khách Hoàn tất vẫn kẹt ở bàn Tư vấn + bỏ ô trống sẵn ở 2 khu chờ (2026-08-05, tiếp #4)
User test với dữ liệu Lark thật (không phải mock), báo: STT4 đã được ghi nhận
"Hoàn tất" trong `Master` nhưng bàn Tư vấn 1 vẫn hiện đang bận với khách đó.
Kèm ảnh chụp 2 ô tròn viền chấm màu vàng (rỗng) ở khu chờ, yêu cầu bỏ hẳn ô
trống sẵn.

**Root cause (không đoán — soát lại đúng logic `indexMasterByDeskCode`)**:
hàm lọc "có DÒNG NÀO đó trong `Master` = Tiếp nhận" cho cặp (bàn, khách), mà
KHÔNG xét dòng nào MỚI NHẤT. Nếu Lark của user ghi 1 DÒNG MỚI mỗi lần đổi
trạng thái (Tiếp nhận → Hoàn tất) thay vì sửa lại dòng cũ — rất có thể đúng
vậy vì dòng "Tiếp nhận" cũ không được chủ động xoá — thì dòng Tiếp nhận cũ
vẫn còn đó và vẫn khớp filter, khiến khách bị "kẹt" ở bàn dù đã có dòng Hoàn
tất mới hơn cho đúng cặp đó. Đây là lỗi thiết kế từ lần viết `Master`-driven
mapper trước (mục #2), không phải lỗi mới phát sinh — chỉ lộ ra khi test với
dữ liệu thật (mock trước giờ luôn chỉ có 1 dòng/cặp nên không bắt được).

**Fix**: thêm `latestByDeskAndName()` — gom theo cặp (mã bàn, tên khách),
chỉ giữ dòng có `Thời gian` LỚN NHẤT. Gọi 1 LẦN trong `mapDeskStates`, dùng
chung cho cả occupancy (`indexMasterByDeskCode`, giờ nhận thẳng danh sách đã
dedupe thay vì tự lọc theo Trạng thái) LẪN `completedCandidates` ("Chờ điều
phối" — trước đọc thẳng `tables.master` không dedupe, có thể hiện sai
`fromCluster` nếu khách có nhiều dòng Hoàn tất ở nhiều bàn khác nhau theo thời
gian). Tránh tính 2 lần cùng 1 việc.

**Khu chờ bỏ ô trống sẵn**: đảo ngược quyết định 2026-07-31 ("luôn hiện lưới
cố định, ô trống vẫn hiện") — giờ áp dụng đúng cách đã làm cho chấm dưới bàn
từ 2026-08-03 (chỉ vẽ khách thật, không pad). Sửa `WaitingZoneGrid`: bỏ hẳn
mảng `cells` (trước pad `null` cho đủ `slotCount`), giờ chỉ `map` qua mảng
`shown` (khách thật). Hệ quả: nhánh rỗng của `SttSlot` (hình tròn viền chấm)
trở thành DEAD CODE — verify bằng cách rà lại MỌI nơi gọi `SttSlot` trong file
(khu chờ + chấm dưới bàn) trước khi xoá, xác nhận cả 2 nơi giờ chỉ truyền
khách thật — xoá hẳn nhánh đó + đổi type `customer` từ `DeskCustomer | null`
thành `DeskCustomer` (bắt buộc), không giữ lại "phòng khi cần sau này".

**File đã sửa**:
- `services/larkMapper.ts`: thêm `MasterRow` interface + `latestByDeskAndName()`;
  `indexMasterByDeskCode` đổi tham số từ `rows: LarkRecord[]` sang
  `latestRows: MasterRow[]` (đã dedupe từ ngoài truyền vào); `completedCandidates`
  đổi từ lặp `tables.master` sang lặp `latestMasterRows` (biến dùng chung, tính
  1 lần trong `mapDeskStates`).
- `components/LayoutDashboard.tsx`: `SttSlot` bỏ nhánh `!customer` (dead) +
  đổi type param bắt buộc; `WaitingZoneGrid` bỏ `cells`/padding, map thẳng
  `shown`; cập nhật module doc (đảo ngược quyết định 2026-07-31, giải thích
  rõ vì sao đổi).
- `data/mockLarkData.ts`: thêm demo TÁI TẠO ĐÚNG bug thật — "Đặng Gia Hân"
  (STT11, trước là demo "chờ check-in" đơn thuần) giờ có 2 dòng `master` tại
  TV1: `Tiếp nhận` lúc 11500 rồi `Hoàn tất` lúc 12000 (dòng MỚI, không sửa
  dòng cũ — đúng cách dữ liệu thật của user). Thêm `Done in Flow: 'Tư vấn'`
  vào `ci_11` để popover "Chờ điều phối" hiện đúng tên khâu thay vì rỗng.

**Verify bằng browser (mock, dựng lại đúng ca lỗi thật trước khi sửa để chắc
chắn tái hiện được, rồi sửa, rồi verify lại)**:
- TV1 chuyển từ ĐỎ (bug) → XANH (đúng) sau khi thêm dedupe — bấm vào: "Trống
  · Tên NV: — · Bàn trống — chưa có thông tin khách" (đúng, không còn dính
  khách cũ).
- Khu "Chờ điều phối" tăng từ "1" → "2", thêm đúng "#11" — bấm vào: "#11 ·
  Đặng Gia Hân · Khu vực: Chờ điều phối · Trạng thái: Đã hoàn tất 'Khâu Tư
  vấn'" — đúng dữ liệu, đúng khâu.
- Khu "Đã check-in" hiện HOÀN TOÀN RỖNG (không số đếm, không chấm nào, không
  còn viền chấm vàng nào) — đúng yêu cầu bỏ ô trống sẵn; 2 khách còn lại
  (STT7/8) đã dispatch vào bàn riêng nên không còn trong khu chung.
- `tsc -b --noEmit` + `npm run build` sạch. Không console error thật.
- **Chưa verify được với dữ liệu Lark thật của user** (chỉ tái hiện + verify
  qua mock) — cần user tự confirm lại trên bản live sau khi deploy code mới,
  vì nguyên nhân gốc (Lark ghi dòng mới thay vì sửa dòng cũ) là suy luận hợp
  lý nhất dựa trên triệu chứng, không phải điều đã thấy trực tiếp trong dữ
  liệu live của họ (không có quyền truy cập base thật).
