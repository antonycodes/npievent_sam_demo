/**
 * larkConfig — types + DEFAULT column maps / connection for the Lark integration.
 *
 * These are the compile-time defaults (matching the `NPI_Testing_2.2` workbook,
 * seeded from `VITE_*` env). At runtime they can be overridden from the in-app
 * Settings page — see `larkSettings.ts`, which is what the app actually reads.
 *
 * **Master schema (2026-08-05):** the Lark base was reorganized — `DS Tư vấn` /
 * `DS thu cũ` / `DS backup` / `DS Kho` were consolidated into ONE table
 * (`DS Master`, 24 rows: 6 desks × 4 types), distinguished by a `Loại`
 * single-select column (`Tư vấn` / `Thu cũ` / `Backup` / `Kho`). Likewise
 * `Check in` → `Master_Check in` (same column names, verified 1:1 against the
 * export — no field renames needed there). The board layout is UNCHANGED
 * (still only `kythuat`/`consult`, 3+8 desks — user's explicit call, see
 * layoutConfig.ts) so both clusters now read the SAME `DS Master` table,
 * filtered client-side by `Loại` — see `DsTypeFieldMap` below and
 * `larkMapper.ts`. Backup/Kho rows exist in the data but are simply never
 * matched by any on-screen desk id, same as how TC4-6 were already ignored
 * before this change.
 *
 * **`Master` table** (added 2026-08-05, same day): per user's real business
 * flow — check-in (`Master_Check in`) → dispatch (`Master Điều phối`, not
 * read by this app) → a staff member receives the customer at a desk, logged
 * in `Master` (`TV_MãNV` = desk code, `Trạng thái` = Tiếp nhận/Hoàn tất). This
 * is now the authoritative source for "who is at desk X right now" — see
 * `MasterFieldMap` and `larkMapper.ts`'s `indexMasterByDeskCode`.
 */
import type { ClusterKey } from '@/types/desk';
import type { TableKey } from '@/services/larkTypes';

const env = import.meta.env;

export const DEFAULT_HOST =
  (env.VITE_LARK_HOST as string | undefined)?.replace(/\/+$/, '') ?? 'https://open.larksuite.com';

/** Column names in a DS registry table → domain. */
export interface DsFieldMap {
  code: string;
  staff: string;
  received: string;
  completed: string;
  waiting: string;
}

/**
 * `DS Master` gộp 4 loại bàn (Tư vấn/Thu cũ/Backup/Kho) trong 1 bảng — cột
 * `Loại` (single-select) phân biệt loại nào. `kythuat`/`consult` đọc CÙNG 1
 * bảng Lark, chỉ khác giá trị lọc.
 */
export interface DsTypeFieldMap {
  /** Tên cột "Loại" trong DS Master. */
  field: string;
  /** Giá trị lọc theo cụm, vd `{ kythuat: 'Thu cũ', consult: 'Tư vấn' }`. */
  value: Record<ClusterKey, string>;
}

/** DS "Status" block columns (same in all 3 DS tables). */
export interface DsStatusFieldMap {
  sttRecent: string;
  statusRecent: string;
  customerRecent: string;
  currentStatus: string;
}

/** Check-in table columns. */
export interface CheckinFieldMap {
  stt: string;
  name: string;
  product: string;
  note: string;
  deviceAccepted: string;
  /**
   * Cột "Thu cũ check" — single-select, tuỳ event có thể có ≥ 2 lựa chọn (vd
   * "❌ KHÔNG THU CŨ ❌" / "✅ CÓ THU CŨ ✅" / "♻️ THU CŨ SAU ♻️" — danh sách
   * lựa chọn có thể đổi trong Lark) nên hiển thị NGUYÊN VĂN lựa chọn đang chọn,
   * không rút gọn thành cờ đúng/sai. Khác với `deviceAccepted` ("Check nghiệm
   * thu" — đã/chưa NGHIỆM THU máy cũ đó, việc khác).
   */
  oldDeviceCheck: string;
  /** Khâu vừa hoàn tất (formula) — dùng cho dòng "Trạng thái" ở "Chờ điều phối". */
  doneInFlow: string;
  /** Đã xong toàn bộ quy trình chưa (formula) — giá trị "End flow" | "In flow". */
  endFlow: string;
  /** Thời điểm check-in — dùng để sắp khách theo thứ tự trước/sau khi 1 NV phục vụ nhiều khách cùng lúc. */
  time: string;
  /**
   * Trạng thái khách ở từng cụm — "Hoàn tất" nghĩa là vừa xong khâu đó, dùng
   * để phát hiện "Chờ điều phối" (xem `larkMapper.ts`'s `completedCandidates`).
   * KHÔNG dùng để xác định khách đang ở bàn nào — việc đó giờ đọc trực tiếp từ
   * bảng `Master` (xem `MasterFieldMap`), đáng tin hơn vì `Master` phủ cả 2
   * cụm bằng đúng mã bàn (`TV_MãNV`), không cần khoá NV gián tiếp như trước.
   */
  statusTradein: string;
  statusConsult: string;
}

/**
 * `Master` — log "NV nhận khách" theo bàn, nguồn xác định khách đang ở bàn
 * nào (thay cho cách suy gián tiếp qua khoá NV trong Check-in trước đây —
 * bảng cũ chỉ có cho Tư vấn nên không dùng được cho Kỹ thuật; `Master` giờ
 * phủ cả 2 loại qua cột `Loại`, và `TV_MãNV` chính là mã bàn — khớp thẳng
 * `TablePosition.id`, không cần tra cứu gì thêm).
 */
export interface MasterFieldMap {
  /** Mã bàn — khớp thẳng `TablePosition.id` (vd "TV2", "TC1"). */
  deskCode: string;
  /** "Tiếp nhận" = đang phục vụ · "Hoàn tất" = đã xong (bỏ qua). */
  status: string;
  name: string;
  /** Dùng để sắp khách theo thứ tự khi 1 NV/bàn phục vụ nhiều khách cùng lúc. */
  time: string;
}

/** All field maps bundled — what the mapper needs. */
export interface FieldConfig {
  ds: Record<ClusterKey, DsFieldMap>;
  dsType: DsTypeFieldMap;
  dsStatus: DsStatusFieldMap;
  checkin: CheckinFieldMap;
  master: MasterFieldMap;
}

// Cả 2 cụm giờ đọc CÙNG 1 bảng "DS Master" (xem module doc ở đầu file) — tên
// cột dùng chung, không còn khác nhau theo cụm như trước ("Nhân viên" vs "NV
// Tư vấn", "SL TC..." vs "Sl TV..."). Giữ map riêng theo cụm (thay vì gộp 1
// map) để trang Cài đặt vẫn cho phép chỉnh độc lập nếu base của bạn khác.
export const DEFAULT_DS_FIELDS: Record<ClusterKey, DsFieldMap> = {
  kythuat: { code: 'STT bàn', staff: 'NV Tư vấn', received: 'Sl TV đang tiếp nhận', completed: 'Sl TV hoàn tất', waiting: 'Sl khách chờ' },
  consult: { code: 'STT bàn', staff: 'NV Tư vấn', received: 'Sl TV đang tiếp nhận', completed: 'Sl TV hoàn tất', waiting: 'Sl khách chờ' },
};

// Lọc "DS Master" theo loại bàn — giá trị options thật trong Lark (single-select).
export const DEFAULT_DS_TYPE_FIELD: DsTypeFieldMap = {
  field: 'Loại',
  value: { kythuat: 'Thu cũ', consult: 'Tư vấn' },
};

export const DEFAULT_DS_STATUS_FIELDS: DsStatusFieldMap = {
  sttRecent: 'STT gần nhất (helper)',
  statusRecent: 'Trạng thái gần nhất (helper)',
  customerRecent: 'Khách gần nhất (helper)',
  currentStatus: 'Trạng thái hiện tại (kết quả chính)',
};

// Cột nguồn giờ là bảng "Master_Check in" (trước là "Check in") — TÊN CỘT
// giữ nguyên 1:1 (verify trực tiếp từ file export Lark), chỉ đổi bảng nguồn ở
// tableKey `checkin`, không cần sửa field map nào dưới đây.
export const DEFAULT_CHECKIN_FIELDS: CheckinFieldMap = {
  stt: 'STT',
  name: 'Họ và tên',
  product: 'SP 1',
  note: 'Note UDTT',
  deviceAccepted: 'Check nghiệm thu',
  oldDeviceCheck: 'Thu cũ check',
  doneInFlow: 'Done in Flow',
  endFlow: 'End flow',
  time: 'Thời gian',
  statusTradein: 'Status in thu cũ',
  statusConsult: 'Status in tư vấn',
};

export const DEFAULT_MASTER_FIELDS: MasterFieldMap = {
  deskCode: 'TV_MãNV',
  status: 'Trạng thái',
  name: 'Họ và tên',
  time: 'Thời gian',
};

/** Giá trị `Trạng thái` (Master) / `Status in <cụm>` (Master_Check in) nghĩa là "đang được tiếp nhận". */
export const STATUS_RECEIVED = 'Tiếp nhận';

/** Giá trị `Trạng thái gần nhất` (DS) nghĩa là bàn vừa hoàn tất 1 khách. */
export const STATUS_COMPLETED = 'Hoàn tất';

/**
 * `Trạng thái hiện tại` → desk UI status — chỉ 2 màu:
 *   "Đang tư vấn" → occupied (đỏ) · else (kể cả "Rảnh"/"Chưa có dữ liệu") → available (xanh).
 */
export const STATUS_OCCUPIED_HINT = 'đang';
export const STATUS_FREE_HINT = 'rảnh';

/** Bitable table ids, one per logical table (direct mode). */
export type TableIdMap = Record<TableKey, string | undefined>;

/** The connection config the client/service consume. */
export interface LarkRuntimeConfig {
  useMock: boolean;
  apiUrl?: string;
  host: string;
  appToken?: string;
  accessToken?: string;
  tableIds: TableIdMap;
  pollMs: number;
}

/** Env-seeded defaults for first run (before the user opens Settings). */
export const ENV_DEFAULTS = {
  apiUrl: (env.VITE_LARK_API_URL as string | undefined) || '',
  host: DEFAULT_HOST,
  appToken: (env.VITE_LARK_APP_TOKEN as string | undefined) || '',
  accessToken: (env.VITE_LARK_ACCESS_TOKEN as string | undefined) || '',
  pollMs: Number(env.VITE_LARK_POLL_MS) > 0 ? Number(env.VITE_LARK_POLL_MS) : 30000,
  useMock:
    env.VITE_LARK_USE_MOCK === 'true' || (!env.VITE_LARK_API_URL && !env.VITE_LARK_APP_TOKEN),
  tableIds: {
    dsTradein: (env.VITE_LARK_TABLE_DS_TRADEIN as string | undefined) || '',
    dsConsult: (env.VITE_LARK_TABLE_DS_CONSULT as string | undefined) || '',
    checkin: (env.VITE_LARK_TABLE_CHECKIN as string | undefined) || '',
    orders: (env.VITE_LARK_TABLE_ORDERS as string | undefined) || '',
    master: (env.VITE_LARK_TABLE_MASTER as string | undefined) || '',
  } as Record<TableKey, string>,
} as const;
