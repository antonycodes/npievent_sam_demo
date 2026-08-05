/**
 * larkConfig — types + DEFAULT column maps / connection for the Lark integration.
 *
 * These are the compile-time defaults, seeded from `VITE_*` env. At runtime
 * they can be overridden from the in-app Settings page — see `larkSettings.ts`,
 * which is what the app actually reads.
 *
 * **Schema (2026-08-05, "no DS Master" revision)**: per the user's real
 * business flow — khách check-in ở `Master_Check in` (STT, chi tiết) → điều
 * phối gán bàn trong `Master Điều phối` (cột `DS Thu cũ`/`DS Tư vấn` = mã bàn
 * được gán) → NV tại bàn đó tiếp nhận khách, ghi vào `Master` (`TV_MãNV` = mã
 * bàn, khớp thẳng `TablePosition.id`; `Người` = NV; `Trạng thái` =
 * Tiếp nhận/Hoàn tất). `DS Master` (bảng DS cũ, gộp 4 loại bàn) hoá ra là
 * **danh sách nhân sự** (roster), KHÔNG phải trạng thái vận hành theo bàn.
 * Occupancy/màu bàn/tên NV đọc từ `Master`; số "khách đang chờ" mỗi bàn đọc
 * từ `Master Điều phối` (đã gán bàn nhưng chưa có dòng "Tiếp nhận" tương ứng
 * trong `Master`) — xem `larkMapper.ts`. Riêng field "STT tiếp theo" (mỗi
 * bàn) VẪN đọc từ `DS Master` (`DsMasterFieldMap`, thêm lại 2026-08-05 theo
 * yêu cầu rõ của user) — hiện khi bấm vào badge "khách đang chờ" ở popover;
 * không dùng bảng đó cho bất cứ việc gì khác.
 *
 * Board vẫn chỉ có 11 vị trí cố định (`layoutConfig.ts`'s `ALL_POSITIONS`) —
 * mapper giờ tính state cho TỪNG VỊ TRÍ đó trực tiếp, không còn "match theo
 * dòng của 1 bảng đăng ký" như trước.
 */
import type { TableKey } from '@/services/larkTypes';

const env = import.meta.env;

export const DEFAULT_HOST =
  (env.VITE_LARK_HOST as string | undefined)?.replace(/\/+$/, '') ?? 'https://open.larksuite.com';

/** Check-in table columns (`Master_Check in`). */
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
}

/**
 * `Master` — log "NV nhận khách" theo bàn. Nguồn DUY NHẤT xác định khách
 * đang ở bàn nào + NV nào phụ trách (thay cho `DS Master`, hoá ra chỉ là
 * danh sách nhân sự, không phải trạng thái vận hành).
 */
export interface MasterFieldMap {
  /** Mã bàn — khớp thẳng `TablePosition.id` (vd "TV2", "TC1"). */
  deskCode: string;
  /** "Tiếp nhận" = đang phục vụ · "Hoàn tất" = đã xong (bỏ qua). */
  status: string;
  name: string;
  /** NV đang tiếp nhận khách này (person field) — hiện lên popover "Tên NV". */
  staff: string;
  /** Dùng để sắp khách theo thứ tự khi 1 NV/bàn phục vụ nhiều khách cùng lúc. */
  time: string;
}

/**
 * `Master Điều phối` — khách đã được điều phối viên GÁN vào 1 bàn cụ thể
 * (cột `DS Thu cũ`/`DS Tư vấn` chứa mã bàn) nhưng CHƯA có dòng "Tiếp nhận"
 * tương ứng trong `Master` — tức đang chờ NV bàn đó xử lý. `deskField` tách
 * theo cụm vì đây là 2 cột khác nhau trong bảng (không union như `Master`).
 */
export interface DispatchFieldMap {
  deskField: Record<'kythuat' | 'consult', string>;
  name: string;
}

/**
 * `DS Master` — QUAY LẠI (2026-08-05, tiếp) nhưng CHỈ đọc đúng 1 field: "STT
 * tiếp theo" mỗi bàn, theo yêu cầu rõ của user — bảng này KHÔNG dùng cho bất
 * cứ việc gì khác (occupancy/staff/status vẫn đọc từ `Master` như trước, xem
 * module doc). `code` là khoá join theo mã bàn, giống `MasterFieldMap.deskCode`.
 */
export interface DsMasterFieldMap {
  code: string;
  nextStt: string;
}

/** All field maps bundled — what the mapper needs. */
export interface FieldConfig {
  checkin: CheckinFieldMap;
  master: MasterFieldMap;
  dispatch: DispatchFieldMap;
  dsMaster: DsMasterFieldMap;
}

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
};

export const DEFAULT_MASTER_FIELDS: MasterFieldMap = {
  deskCode: 'TV_MãNV',
  status: 'Trạng thái',
  name: 'Họ và tên',
  staff: 'Người',
  time: 'Thời gian',
};

export const DEFAULT_DISPATCH_FIELDS: DispatchFieldMap = {
  deskField: { kythuat: 'DS thu cũ', consult: 'DS Tư vấn' },
  name: 'Họ và tên',
};

export const DEFAULT_DS_MASTER_FIELDS: DsMasterFieldMap = {
  code: 'STT bàn',
  nextStt: 'STT tiếp theo',
};

/** Giá trị `Master.Trạng thái` nghĩa là "đang được tiếp nhận". */
export const STATUS_RECEIVED = 'Tiếp nhận';

/** Giá trị `Master.Trạng thái` nghĩa là NV vừa xong 1 khách — nguồn "Chờ điều phối". */
export const STATUS_COMPLETED = 'Hoàn tất';

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
    checkin: (env.VITE_LARK_TABLE_CHECKIN as string | undefined) || '',
    orders: (env.VITE_LARK_TABLE_ORDERS as string | undefined) || '',
    master: (env.VITE_LARK_TABLE_MASTER as string | undefined) || '',
    dispatch: (env.VITE_LARK_TABLE_DISPATCH as string | undefined) || '',
    dsMaster: (env.VITE_LARK_TABLE_DS_MASTER as string | undefined) || '',
  } as Record<TableKey, string>,
} as const;
