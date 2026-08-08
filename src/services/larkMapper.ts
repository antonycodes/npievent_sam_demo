/**
 * larkMapper — turn raw Lark tables into per-desk live state.
 *
 * **Schema (2026-08-05, "no DS Master" revision)**: `DS Master` turned out to
 * be a personnel roster, not a per-desk operational registry — the app no
 * longer reads it at all. Instead, `mapDeskStates` computes state for every
 * FIXED position in `layoutConfig.ALL_POSITIONS` directly, from 2 sources:
 *   - `Master` (`indexMasterByDeskCode`) — who's being served where right
 *     now. `TV_MãNV` = desk code (khớp thẳng `TablePosition.id`), `Trạng
 *     thái` = Tiếp nhận/Hoàn tất, `Người` = NV. A desk is occupied (đỏ) iff
 *     it has ≥ 1 "Tiếp nhận" row here — no more reading a literal "trạng
 *     thái hiện tại" text field.
 *   - `Master Điều phối` (`indexDispatchByDeskCode`) — khách đã được điều
 *     phối viên gán vào 1 bàn cụ thể (cột `DS Thu cũ`/`DS Tư vấn` = mã bàn)
 *     nhưng CHƯA có dòng "Tiếp nhận" tương ứng trong `Master` → đếm vào
 *     `waiting` của đúng bàn đó (badge cam).
 * "Chờ điều phối" (2026-08-05, tiếp) đọc TRỰC TIẾP `Master.Trạng thái` =
 * "Hoàn tất" (không còn qua Check-in's "Status in <cụm>" — formula riêng, có
 * thể lệch nhịp với Master) — theo yêu cầu rõ của user. Chi tiết khách (SP,
 * ghi chú, nghiệm thu…) vẫn join theo TÊN từ `Master_Check in` như cũ.
 *
 * **Điều phối KHÔNG loại khỏi khu chờ chung** (2026-08-05, tiếp #5, sửa lại
 * quyết định trước đó): "đã điều phối" (có dòng trong `Master Điều phối`) chỉ
 * là ĐÃ ĐƯỢC GÁN bàn, chưa chắc đã có NV nhận — khách vẫn phải hiện ở
 * `waitingCheckin`/`waitingDispatch` (khu chung) CHO TỚI KHI thật sự có dòng
 * "Tiếp nhận" trong `Master` (tức `everSeenNames`/`activeNames`). Badge "khách
 * đang chờ" ở từng bàn (từ `Master Điều phối`) là THAM CHIẾU CHÉO, không phải
 * loại trừ — 1 khách có thể vừa hiện ở khu chung, vừa hiện trong badge của
 * đúng bàn được gán, cho tới lúc NV bấm nhận.
 *
 * **Mã bàn dự phòng qua NV** (2026-08-06, tiếp — bug thật user báo: dòng
 * "Hoàn tất" trong `Master` bị bỏ trống `TV_MãNV`, khiến cả occupancy lẫn
 * "Chờ điều phối" bỏ sót dòng đó vì trước giờ bắt buộc phải có mã bàn mới xử
 * lý; sau đó lộ thêm ca `TV_MãNV` CÓ giá trị nhưng là mã option Lark thô chưa
 * resolve). Nếu `TV_MãNV` trống/không hợp lệ nhưng `Người` có giá trị, suy mã
 * bàn từ NV đó qua `DS Master` (xem `indexDeskCodeByStaffName`). Không khớp
 * được NV nào (hoặc NV đó không có dòng "Tư vấn"/"Thu cũ" trong `DS Master`)
 * thì vẫn bỏ qua dòng như cũ.
 *
 * **Backup giao cho cả Tư vấn lẫn Thu cũ** (2026-08-06): Backup không phải
 * vị trí vật lý riêng, nhưng mã Backup vẫn phải được giữ để theo dõi đủ khâu.
 * BK1..BK8 thuộc TV1..TV8; BK11..BK13 thuộc TC1..TC3. Khi tính trạng thái
 * bàn, `normalizeDeskCode` quy mã BK về bàn chính tương ứng. Khi hiển thị
 * dòng "Nhân sự", mã BK vẫn giữ nguyên, không gộp thành TV/TC.
 * Khi build map dự phòng qua tên NV,
 * `indexDeskCodeByStaffName` CHỈ lấy dòng `DS Master` có "Loại" = "Tư
 * vấn"/"Thu cũ" (bàn chính, vật lý) — bỏ qua dòng "Loại" = "Backup"/"Kho",
 * để 1 khách "Backup" được ghi Tiếp nhận sẽ tính đúng vào bàn CHÍNH thường
 * ngày của NV đó (Tư vấn hoặc Thu cũ), không phải 1 vị trí Backup riêng.
 */
import {
  PRIMARY_DESK_LOAI,
  STATUS_COMPLETED,
  STATUS_RECEIVED,
  type CheckinFieldMap,
  type DispatchFieldMap,
  type DsMasterFieldMap,
  type FieldConfig,
  type MasterFieldMap,
} from '@/config/larkConfig';
import { toFieldConfig } from '@/config/larkSettings';
import { ALL_POSITIONS } from '@/config/layoutConfig';
import type { ClusterKey, DeskCustomer, DeskLiveState, WaitingCustomer } from '@/types/desk';
import type { LarkCellValue, LarkRecord, LarkTables } from './larkTypes';

export function cellToString(v: LarkCellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) {
    // 3 dạng thấy được từ Lark thật: rich-text segment ({text,type}, vd
    // "Done in Flow"), mảng string trần (link/lookup field, vd "TV_Nsư Tư
    // vấn" → ["optxXl70bv"]), và mảng object người dùng (person field, vd
    // "NV Tư vấn" → [{id,name,email,...}], không có `.text`) — xử lý cả 3.
    const s = v
      .map((seg) => (typeof seg === 'string' ? seg : seg?.text ?? seg?.name ?? ''))
      .join('')
      .trim();
    return s || null;
  }
  return null;
}

/**
 * Lark responses copied through some proxy/browser paths can expose Vietnamese
 * column names as mojibake (for example `DS Thu cÅ©`). Read the exact key first
 * and then compare a repaired form so dispatch still works during that state.
 */
function repairMojibake(value: string): string {
  try {
    const bytes = Uint8Array.from(value, (ch) => ch.charCodeAt(0) & 0xff);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return value;
  }
}

function fieldValue(fields: Record<string, LarkCellValue>, fieldName: string): LarkCellValue {
  if (Object.prototype.hasOwnProperty.call(fields, fieldName)) return fields[fieldName];
  const wanted = fieldName.trim().toLocaleLowerCase();
  const found = Object.keys(fields).find(
    (key) => repairMojibake(key).trim().toLocaleLowerCase() === wanted,
  );
  return found ? fields[found] : undefined;
}

/** Lấy URL từ hyperlink field Lark (plain URL hoặc object/link segment). */
export function cellToUrl(v: LarkCellValue): string | null {
  if (typeof v === 'string') return /^https?:\/\//i.test(v.trim()) ? v.trim() : null;
  if (!Array.isArray(v)) return null;
  for (const part of v as Array<Record<string, unknown>>) {
    for (const candidate of [part.url, part.link, part.href, part.text]) {
      if (typeof candidate === 'string' && /^https?:\/\//i.test(candidate.trim())) return candidate.trim();
    }
  }
  return null;
}

export function cellToNumber(v: LarkCellValue): number {
  if (typeof v === 'number') return v;
  const s = cellToString(v);
  const n = s == null ? NaN : Number(s);
  return Number.isFinite(n) ? n : 0;
}

const TRUTHY_TEXT = new Set(['true', '1', 'x', 'có', 'yes', 'checked']);

/**
 * Coerce a Lark cell to boolean. Handles a plain checkbox (boolean) and the
 * real "Check nghiệm thu" field, which is a FORMULA column rendering as a
 * colored tag string — "✅ Đã nghiệm thu (1) máy" / "❌ Chưa nghiệm thu máy" —
 * so match by emoji/keyword rather than exact string (the trailing count varies).
 */
export function cellToBool(v: LarkCellValue): boolean {
  if (typeof v === 'boolean') return v;
  const s = cellToString(v);
  if (!s) return false;
  const norm = s.trim().toLowerCase();
  if (norm.includes('✅') || norm.includes('đã nghiệm thu')) return true;
  if (norm.includes('❌') || norm.includes('chưa nghiệm thu')) return false;
  return TRUTHY_TEXT.has(norm);
}

export interface MappedData {
  statesById: Record<string, DeskLiveState>;
  totalCheckIn: number;
  totalRegistered: number;
  /** Đã check-in nhưng chưa từng được điều phối vào bàn nào — chờ điều phối lần đầu. */
  waitingCheckin: WaitingCustomer[];
  /** Vừa hoàn tất 1 cụm, chưa được điều phối sang cụm tiếp theo (và chưa dispatch vào bàn nào). */
  waitingDispatch: WaitingCustomer[];
  /** Đã hoàn tất toàn bộ quy trình (Check-in cột "End flow" = "End flow"). */
  endFlow: WaitingCustomer[];
}

const END_FLOW_DONE = 'end flow';

/** Check-in "End flow" — "End flow" (đã xong toàn bộ) vs "In flow" (đang trong luồng). */
function isEndFlowValue(v: LarkCellValue): boolean {
  const s = cellToString(v);
  return s ? s.trim().toLowerCase() === END_FLOW_DONE : false;
}

interface CheckinIndexEntry {
  stt: string | null;
  product: string | null;
  note: string | null;
  deviceAccepted: boolean;
  deviceAcceptedText: string | null;
  /** Cột "Thu cũ check" — nguyên văn lựa chọn (single-select, có thể ≥ 2 tuỳ chọn). */
  oldDeviceCheck: string | null;
  /** Cột "Backup check" — nguyên văn lựa chọn. */
  backupCheck: string | null;
  /** Khâu vừa hoàn tất (Check-in cột "Done in Flow") — chỉ có ý nghĩa khi khách đã xong 1 khâu. */
  doneInFlow: string | null;
  /** Đã hoàn tất toàn bộ quy trình (Check-in cột "End flow"). */
  endFlow: boolean;
}

/**
 * Index Check-in rows by customer name.
 *
 * Check-in's `STT` is the ONE canonical queue number for a customer — assigned
 * once at check-in and unchanged for the whole event.
 */
function indexCheckinByName(rows: LarkRecord[], fm: CheckinFieldMap): Map<string, CheckinIndexEntry> {
  const m = new Map<string, CheckinIndexEntry>();
  for (const r of rows) {
    const name = cellToString(fieldValue(r.fields, fm.name));
    if (name) {
      m.set(name, {
        stt: cellToString(r.fields[fm.stt]),
        product: cellToString(r.fields[fm.product]),
        note: cellToString(r.fields[fm.note]),
        deviceAccepted: cellToBool(r.fields[fm.deviceAccepted]),
        deviceAcceptedText: cellToString(r.fields[fm.deviceAccepted]),
        oldDeviceCheck: cellToString(r.fields[fm.oldDeviceCheck]),
        backupCheck: cellToString(r.fields[fm.backupCheck]),
        doneInFlow: cellToString(r.fields[fm.doneInFlow]),
        endFlow: isEndFlowValue(r.fields[fm.endFlow]),
      });
    }
  }
  return m;
}

function indexMasterHyperlinkByName(rows: LarkRecord[], fm: MasterFieldMap): Map<string, string> {
  const result = new Map<string, string>();
  for (const r of rows) {
    const name = cellToString(r.fields[fm.name]);
    const url = cellToUrl(r.fields[fm.hyperlink]);
    if (name && url) result.set(name, url);
  }
  return result;
}

/**
 * Mã option Lark thô (dạng "optXXXXXXXXXX") — leak ra khi 1 field
 * single-select dùng OPTIONS ĐỘNG (vd `TV_MãNV`, options lấy từ `DS Master`
 * qua `optionsRule` thay vì danh sách cố định) và REST API không tự resolve
 * được thành chữ hiển thị (bug thật user báo 2026-08-06: TV5 không đổi trạng
 * thái dù `Trạng thái` đã "Tiếp nhận" — vì `TV_MãNV` trả về "opt..." thay vì
 * "TV5", cùng cơ chế với bug "Done in Flow" trước đó, khác là field này
 * không sửa được bằng công thức Lark nên phải lọc ở code). Coi như KHÔNG có
 * giá trị — dùng mã rác làm khoá join sẽ tạo 1 "bàn ma" không khớp vị trí
 * nào; trả `null` để rơi về fallback qua NV (`deskCodeByStaffName`, xem
 * `latestByDeskAndName`) thay vì mất trắng như khi thật sự không có mã bàn.
 */
function isUnresolvedOptionId(v: string): boolean {
  return /^opt[A-Za-z0-9]{6,}$/.test(v);
}

/**
 * "BK<n>" giờ map TRỰC TIẾP vào đúng 1 vị trí thật trên sơ đồ theo quy ước
 * user đặt (2026-08-06, tiếp — cụ thể hoá quyết định "Backup giao cho cả Tư
 * vấn lẫn Thu cũ, quy về bàn CHÍNH của NV" ở trên): NV Tư vấn làm Backup vẫn
 * NGỒI ĐÚNG bàn Tư vấn của mình khi đó — BK1..BK8 = TV1..TV8 (khớp số); NV
 * Thu cũ làm Backup thì BK11..BK13 = TC1..TC3 (lệch 10 để không trùng số với
 * dải TV). Đây là quy ước CỐ ĐỊNH, đáng tin hơn suy qua `DS Master` (phụ
 * thuộc dữ liệu roster có đúng/đủ hay không — từng lỗi nhiều lần trong
 * session này) — dùng map này TRƯỚC khi rơi về fallback qua NV. Trong thực
 * tế API hầu như luôn trả mã option chưa resolve (xem `isUnresolvedOptionId`)
 * thay vì chữ "BK5" thật, nên map này chủ yếu là lớp phòng thủ thêm — fallback
 * qua NV (`deskCodeByStaffName`) vẫn là đường chính khi gặp mã option thô.
 */
const BK_TO_DESK: Record<string, string> = {
  BK1: 'TV1',
  BK2: 'TV2',
  BK3: 'TV3',
  BK4: 'TV4',
  BK5: 'TV5',
  BK6: 'TV6',
  BK7: 'TV7',
  BK8: 'TV8',
  BK9: 'TV9',
  BK10: 'TV10',
  BK11: 'TC1',
  BK12: 'TC2',
  BK13: 'TC3',
};

/** Mã hiển thị Kỹ thuật trong Điều phối → mã join cũ đang dùng trong Lark. */
const KT_TO_DESK: Record<string, string> = {
  KT1: 'TC1',
  KT2: 'TC2',
  KT3: 'TC3',
};

/**
 * NV "Backup" (mã "BK<n>") KHÔNG map cứng vào riêng Kỹ thuật nữa (đảo ngược
 * quyết định 2026-08-06 trước đó): giờ backup được giao cho CẢ NV Tư vấn lẫn
 * Thu cũ. "BK<n>" khớp `BK_TO_DESK` thì dùng luôn (quy ước cố định, xem
 * trên); không khớp (vd "BK9"/"BK10" ngoài phạm vi, hoặc mã option thô) thì
 * coi như KHÔNG hợp lệ (trả `null`) để rơi về fallback qua NV
 * (`deskCodeByStaffName`), tìm đúng bàn CHÍNH (Tư vấn/Thu cũ) mà NV đó đang
 * ngồi — xem module doc.
 */
export function normalizeDeskCode(raw: string | null): string | null {
  if (!raw || isUnresolvedOptionId(raw)) return null;
  // Lark single-select/lookup values may arrive with spaces or the UI alias
  // (KT1) instead of the stored technical code (TC1). Normalize both forms
  // before joining dispatch rows to the fixed layout position.
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, '');
  // BK.X is a real standalone Lark code (not BK11/BK13). Some integrations
  // strip punctuation from single-select values, so accept both spellings.
  if (normalized === 'BK.X' || normalized === 'BKX') return 'BK.X';
  if (normalized === 'BK.X2' || normalized === 'BKX2') return 'BK.X2';
  if (KT_TO_DESK[normalized]) return KT_TO_DESK[normalized];
  const kt = /^K(?:T|ỸTHUẬT)([1-3])$/.exec(normalized);
  if (kt) return `TC${kt[1]}`;
  const tc = /^TC([1-3])$/.exec(normalized);
  if (tc) return `TC${tc[1]}`;
  const m = /^BK\d+$/i.exec(raw);
  if (m) return BK_TO_DESK[normalized] ?? null;
  return normalized;
}

/** Suy cụm từ tiền tố mã bàn — "TC..." → Kỹ thuật, "TV..." → Tư vấn (xem layoutConfig.ts's `ID_PREFIX`). */
function clusterFromDeskCode(code: string | null): ClusterKey | null {
  if (!code) return null;
  if (code === 'BK.X' || code === 'BK.X2') return 'kythuat';
  if (code.startsWith('TC')) return 'kythuat';
  if (code.startsWith('TV')) return 'consult';
  return null;
}

interface DeskGroup {
  customers: DeskCustomer[];
  staff: string | null;
}

/** 1 dòng `Master`, giữ nguyên field thô cần cho bước "chỉ lấy dòng mới nhất". */
interface MasterRow {
  deskCode: string;
  name: string;
  time: number;
  status: string | null;
  staff: string | null;
}

/**
 * Lark có thể ghi 1 DÒNG MỚI mỗi lần đổi trạng thái (Tiếp nhận → Hoàn tất)
 * thay vì sửa lại dòng cũ — nếu chỉ lọc "có dòng nào đó = Tiếp nhận" thì dòng
 * Tiếp nhận cũ (chưa bị xoá) sẽ khiến khách bị KẸT LẠI ở bàn dù đã có dòng
 * Hoàn tất mới hơn cho đúng cặp (bàn, khách) đó (bug thật user báo
 * 2026-08-05: STT4 đã Hoàn tất nhưng vẫn hiện ở bàn Tư vấn). Gom theo cặp
 * (mã bàn, tên khách), chỉ giữ dòng có `Thời gian` LỚN NHẤT cho mỗi cặp.
 *
 * `deskCodeByStaffName` (2026-08-06, tiếp) là DỰ PHÒNG: nếu dòng `Master`
 * không có `TV_MãNV` (bug thật user báo — dòng "Hoàn tất" bị bỏ trống mã bàn)
 * nhưng CÓ `Người`, suy mã bàn từ NV đó qua `DS Master` (mỗi NV Tư vấn gắn 1
 * bàn cố định, xem `indexDeskCodeByStaffName`). Không tìm được thì bỏ qua
 * dòng như cũ (không đoán bừa).
 */
function latestByDeskAndName(
  rows: LarkRecord[],
  fm: MasterFieldMap,
  deskCodeByStaffName: Map<string, string>,
  dispatchDeskByName: Map<string, string>,
): MasterRow[] {
  const latest = new Map<string, MasterRow>();
  for (const r of rows) {
    const name = cellToString(fieldValue(r.fields, fm.name));
    if (!name) continue;
    const staff = cellToString(fieldValue(r.fields, fm.staff));
    const deskCode =
      normalizeDeskCode(cellToString(fieldValue(r.fields, fm.deskCode))) ??
      (staff ? deskCodeByStaffName.get(staff) ?? null : null) ??
      dispatchDeskByName.get(name) ??
      null;
    if (!deskCode) continue;
    const time = cellToNumber(fieldValue(r.fields, fm.time));
    const key = `${deskCode} ${name}`;
    const prev = latest.get(key);
    if (!prev || time >= prev.time) {
      latest.set(key, {
        deskCode,
        name,
        time,
        status: cellToString(fieldValue(r.fields, fm.status)),
        staff,
      });
    }
  }
  return [...latest.values()];
}

/**
 * Gom khách đang "Tiếp nhận" (bảng `Master`) theo MÃ BÀN (`TV_MãNV`, khớp
 * thẳng `TablePosition.id`), từ danh sách ĐÃ dedupe theo dòng mới nhất mỗi
 * cặp (bàn, khách) — xem `latestByDeskAndName`. Sắp theo "Thời gian" tăng
 * dần. Cũng lấy luôn tên NV (`Người`) — dòng nào có giá trị trước thì dùng
 * (nhiều dòng cùng bàn nên luôn cùng 1 NV trong thực tế).
 */
function indexMasterByDeskCode(
  latestRows: MasterRow[],
  checkinByName: Map<string, CheckinIndexEntry>,
  dispatchDetailByName: Map<string, DispatchDetail>,
  hyperlinkByName: Map<string, string>,
): Map<string, DeskGroup> {
  const entries: Array<{ deskCode: string; time: number; staff: string | null; customer: DeskCustomer }> = [];

  for (const row of latestRows) {
    if (row.status !== STATUS_RECEIVED) continue;
    const ci = checkinByName.get(row.name);
    const dd = dispatchDetailByName.get(row.name);
    entries.push({
      deskCode: row.deskCode,
      time: row.time,
      staff: row.staff,
      customer: {
        stt: ci?.stt ?? null,
        name: row.name,
        productName: ci?.product ?? null,
        paymentNote: ci?.note ?? null,
        deviceAccepted: ci?.deviceAccepted ?? null,
        deviceAcceptedText: ci?.deviceAcceptedText ?? null,
        hyperlink: hyperlinkByName.get(row.name) ?? null,
        oldDeviceCheck: ci?.oldDeviceCheck ?? null,
        backupCheck: ci?.backupCheck ?? null,
        dsTuVan: dd?.dsTuVan ?? null,
        dsThuCu: dd?.dsThuCu ?? null,
        dsBackup: dd?.dsBackup ?? null,
      },
    });
  }

  entries.sort((a, b) => a.time - b.time);
  const result = new Map<string, DeskGroup>();
  for (const e of entries) {
    const g = result.get(e.deskCode) ?? { customers: [], staff: null };
    g.customers.push(e.customer);
    if (!g.staff && e.staff) g.staff = e.staff;
    result.set(e.deskCode, g);
  }
  return result;
}

/**
 * Gom tên khách đã được điều phối vào 1 mã bàn cụ thể (bảng `Master Điều
 * phối`, cột `DS Thu cũ`/`DS Tư vấn` tuỳ cụm — 1 dòng chỉ có ĐÚNG 1 trong 2
 * cột này khác rỗng tuỳ "Phân loại", nên đọc cả 2 cột trên mọi dòng là an toàn).
 */
function indexDispatchByDeskCode(rows: LarkRecord[], fm: DispatchFieldMap): Map<string, Set<string>> {
  // Base vẫn lưu mã thật TC1/TC2/TC3 và BK11/BK12/BK13. normalizeDeskCode
  // quy cả hai về vị trí nội bộ TC1/TC2/TC3; layout sẽ render thành KT1/KT2/KT3.
  // DS Backup cũng là một phân công hợp lệ nên phải tính vào hàng chờ của vị
  // trí tương ứng, không chỉ dùng để hiển thị popover.
  const deskFields = [fm.deskField.kythuat, fm.deskField.consult, fm.backupDeskField];
  const result = new Map<string, Set<string>>();
  for (const r of rows) {
    const name = cellToString(r.fields[fm.name]);
    if (!name) continue;
    for (const field of deskFields) {
      const deskCode = normalizeDeskCode(cellToString(fieldValue(r.fields, field)));
      if (!deskCode) continue;
      const set = result.get(deskCode) ?? new Set<string>();
      set.add(name);
      result.set(deskCode, set);
    }
  }
  return result;
}

/** 3 cột mã bàn thô của 1 khách trong `Master Điều phối` — CHỈ để hiển thị, xem `DispatchFieldMap`'s doc. */
interface DispatchDetail {
  dsTuVan: string | null;
  dsThuCu: string | null;
  dsBackup: string | null;
}

/**
 * Chuẩn hoá riêng mã HIỂN THỊ ở cột DS Backup. Backup có mã khâu độc lập dù
 * cùng một người/bàn chính đảm nhận: TV1..TV8 → BK1..BK8 và
 * TC1..TC3 → BK11..BK13. Nếu Lark đã trả BK<n> thì giữ nguyên.
 */
function backupDisplayCode(raw: string | null): string | null {
  if (!raw || isUnresolvedOptionId(raw)) return null;
  const code = raw.toUpperCase();
  if (/^BK\d+$/.test(code)) return code;
  const tv = /^TV([1-9]|10)$/.exec(code);
  if (tv) return `BK${tv[1]}`;
  const tc = /^TC([1-3])$/.exec(code);
  if (tc) return `BK${Number(tc[1]) + 10}`;
  return raw;
}

/**
 * Tên khách → 3 mã khâu ("DS Tư vấn"/"DS Thu cũ"/"DS Backup") trong
 * `Master Điều phối`. Một khách có thể có nhiều dòng Điều phối qua nhiều
 * khâu, nên cộng dồn giá trị mới nhất của TỪNG CỘT; không để dòng mới chỉ có
 * TV ghi đè và làm mất TC/BK của dòng cũ.
 */
function indexDispatchDetailByName(rows: LarkRecord[], fm: DispatchFieldMap): Map<string, DispatchDetail> {
  const result = new Map<string, DispatchDetail>();
  for (const r of rows) {
    const name = cellToString(fieldValue(r.fields, fm.name));
    if (!name) continue;
    const previous = result.get(name) ?? { dsTuVan: null, dsThuCu: null, dsBackup: null };
    const dsTuVan = cellToString(fieldValue(r.fields, fm.deskField.consult));
    const dsThuCu = cellToString(fieldValue(r.fields, fm.deskField.kythuat));
    const dsBackup = backupDisplayCode(cellToString(fieldValue(r.fields, fm.backupDeskField)));
    result.set(name, {
      dsTuVan: dsTuVan ?? previous.dsTuVan,
      dsThuCu: dsThuCu ?? previous.dsThuCu,
      dsBackup: dsBackup ?? previous.dsBackup,
    });
  }
  return result;
}

function normalizedStage(raw: string | null): 'consult' | 'tradein' | 'backup' | null {
  const stage = raw?.trim().toLowerCase() ?? '';
  if (stage.includes('backup') || stage.includes('back up')) return 'backup';
  if (stage.includes('thu cũ') || stage.includes('thu cu')) return 'tradein';
  if (stage.includes('tư vấn') || stage.includes('tu van')) return 'consult';
  return null;
}

/**
 * Ghi đè dữ liệu Điều phối bằng người/bàn THỰC TẾ đã tiếp nhận trong
 * SS_Master. Chỉ ghi đè đúng khâu của từng record (`Loại 2`), vì cùng một
 * khách có thể lần lượt qua TV, TC và BK ở các thời điểm khác nhau.
 */
function mergeReceivedDetailByName(
  dispatchDetails: Map<string, DispatchDetail>,
  rows: LarkRecord[],
  fm: MasterFieldMap,
  deskCodeByStaffName: Map<string, string>,
): Map<string, DispatchDetail> {
  const result = new Map<string, DispatchDetail>();
  for (const [name, detail] of dispatchDetails) result.set(name, { ...detail });

  const ordered = [...rows].sort((a, b) => cellToNumber(a.fields[fm.time]) - cellToNumber(b.fields[fm.time]));
  for (const row of ordered) {
    const name = cellToString(row.fields[fm.name]);
    const status = cellToString(row.fields[fm.status]);
    const stage = normalizedStage(cellToString(row.fields[fm.stage]));
    if (!name || !stage || (status !== STATUS_RECEIVED && status !== STATUS_COMPLETED)) continue;

    const staff = cellToString(row.fields[fm.staff]);
    const rawDeskCode = cellToString(row.fields[fm.deskCode]);
    const primaryDeskCode =
      normalizeDeskCode(rawDeskCode) ?? (staff ? deskCodeByStaffName.get(staff) ?? null : null);
    const previous = result.get(name) ?? { dsTuVan: null, dsThuCu: null, dsBackup: null };

    if (stage === 'consult' && primaryDeskCode?.startsWith('TV')) previous.dsTuVan = primaryDeskCode;
    if (stage === 'tradein' && primaryDeskCode?.startsWith('TC')) previous.dsThuCu = primaryDeskCode;
    if (stage === 'backup') previous.dsBackup = backupDisplayCode(rawDeskCode) ?? backupDisplayCode(primaryDeskCode);
    result.set(name, previous);
  }
  return result;
}

/** Mã bàn → "STT tiếp theo" (bảng `DS Master` — CHỈ đọc field này, xem module doc). */
function indexNextSttByDeskCode(rows: LarkRecord[], fm: DsMasterFieldMap): Map<string, string> {
  const result = new Map<string, string>();
  for (const r of rows) {
    const deskCode = normalizeDeskCode(cellToString(r.fields[fm.code]));
    const nextStt = cellToString(r.fields[fm.nextStt]);
    if (deskCode && nextStt) result.set(deskCode, nextStt);
  }
  return result;
}

/**
 * Tên NV → mã bàn CHÍNH (bảng `DS Master`'s "NV Tư vấn"/"STT bàn", lọc theo
 * "Loại" — 2026-08-06, tiếp: 1 NV có thể có NHIỀU dòng trong `DS Master` —
 * bàn chính (Tư vấn HOẶC Thu cũ) VÀ riêng 1 dòng "Backup" (không phải vị trí
 * vật lý, giờ giao được cho cả NV Tư vấn lẫn Thu cũ) — CHỈ lấy dòng
 * `PRIMARY_DESK_LOAI` ("Tư vấn"/"Thu cũ"), bỏ qua "Backup"/"Kho". 1 NV có ≥ 2
 * dòng bàn chính (hiếm, roster test data) thì lấy dòng ĐẦU TIÊN gặp — ổn định
 * nhưng không phân biệt được ca nào đang thật sự áp dụng, chấp nhận được vì
 * đây chỉ là dự phòng khi `TV_MãNV` không tự resolve được.
 */
function indexDeskCodeByStaffName(rows: LarkRecord[], fm: DsMasterFieldMap): Map<string, string> {
  const result = new Map<string, string>();
  for (const r of rows) {
    const loai = cellToString(r.fields[fm.loai]);
    if (!loai || !PRIMARY_DESK_LOAI.has(loai)) continue;
    const staffName = cellToString(r.fields[fm.staff]);
    const deskCode = normalizeDeskCode(cellToString(r.fields[fm.code]));
    if (staffName && deskCode && !result.has(staffName)) result.set(staffName, deskCode);
  }
  return result;
}

export function mapDeskStates(tables: LarkTables, fields: FieldConfig = toFieldConfig()): MappedData {
  const { checkin, master, dispatch, dsMaster } = fields;
  const checkinByName = indexCheckinByName(tables.checkin, checkin);
  const hyperlinkByName = indexMasterHyperlinkByName(tables.master, master);
  const deskCodeByStaffName = indexDeskCodeByStaffName(tables.dsMaster, dsMaster);
  const dispatchDetailByName = indexDispatchDetailByName(tables.dispatch, dispatch);
  const dispatchDeskByName = new Map<string, string>();
  for (const [name, detail] of dispatchDetailByName) {
    const code = normalizeDeskCode(detail.dsBackup ?? detail.dsThuCu ?? detail.dsTuVan);
    if (code) dispatchDeskByName.set(name, code);
  }
  const personnelDetailByName = mergeReceivedDetailByName(
    dispatchDetailByName,
    tables.master,
    master,
    deskCodeByStaffName,
  );
  // Dedupe 1 LẦN — dùng chung cho cả occupancy (dưới) lẫn "Chờ điều phối"
  // (xa hơn), tránh 1 dòng "Tiếp nhận" cũ chưa xoá đè lên dòng "Hoàn tất" mới
  // hơn cho cùng cặp (bàn, khách) — xem `latestByDeskAndName`.
  const latestMasterRows = latestByDeskAndName(tables.master, master, deskCodeByStaffName, dispatchDeskByName);
  const activeByDeskCode = indexMasterByDeskCode(latestMasterRows, checkinByName, personnelDetailByName, hyperlinkByName);
  const dispatchByDeskCode = indexDispatchByDeskCode(tables.dispatch, dispatch);
  const nextSttByDeskCode = indexNextSttByDeskCode(tables.dsMaster, dsMaster);
  const statesById: Record<string, DeskLiveState> = {};

  // Đang được phục vụ ở BẤT KỲ bàn nào ngay lúc này.
  const activeNames = new Set<string>();
  // Đã từng xuất hiện trong Master (bất kỳ trạng thái) — dùng để loại khỏi "Chờ check-in".
  const everSeenNames = new Set<string>();

  for (const r of tables.master) {
    const name = cellToString(r.fields[master.name]);
    if (name) everSeenNames.add(name);
  }

  for (const pos of ALL_POSITIONS) {
    const code = pos.id;
    const group = activeByDeskCode.get(code);
    const receivedCustomers = group?.customers ?? [];
    const occupied = receivedCustomers.length > 0;
    for (const c of receivedCustomers) if (c.name) activeNames.add(c.name);

    const servedNames = new Set(receivedCustomers.map((c) => c.name).filter((n): n is string => Boolean(n)));
    let waiting = 0;
    for (const n of dispatchByDeskCode.get(code) ?? []) {
      if (servedNames.has(n)) continue;
      // Đã "End flow" (xong toàn bộ quy trình) rồi thì không còn "chờ" nữa —
      // dòng `Master Điều phối` gán khách đó vào bàn này có thể chưa/không
      // bị xoá sau khi họ đã hoàn tất, không nên tính vào "Sl khách chờ"
      // (bug thật user báo 2026-08-06: khách đã End Flow vẫn hiện "còn 1
      // khách chờ" ở TV5).
      if (checkinByName.get(n)?.endFlow) continue;
      waiting += 1;
    }

    const primary = receivedCustomers[0];
    statesById[code] = {
      staffName: group?.staff ?? null,
      waiting,
      nextWaitingStt: nextSttByDeskCode.get(code) ?? null,
      currentStatus: occupied ? 'Đang tiếp nhận' : 'Rảnh',
      isOccupied: occupied,
      hasData: true,
      customerSTT: primary?.stt ?? null,
      customerName: primary?.name ?? null,
      productName: primary?.productName ?? null,
      paymentNote: primary?.paymentNote ?? null,
      deviceAccepted: primary?.deviceAccepted ?? null,
      deviceAcceptedText: primary?.deviceAcceptedText ?? null,
      receivedCustomers,
    };
  }

  // Ứng viên "chờ điều phối" — quét dòng MỚI NHẤT mỗi cặp (bàn, khách) trong
  // `Master` (cùng nguồn dedupe với occupancy ở trên): dòng nào `Trạng thái` =
  // "Hoàn tất" nghĩa là NV vừa xong 1 khách tại bàn đó (nguồn đáng tin hơn
  // Check-in's "Status in <cụm>", vốn là formula riêng có thể không đồng bộ
  // kịp với Master).
  const completedCandidates: WaitingCustomer[] = [];
  for (const row of latestMasterRows) {
    if (row.status !== STATUS_COMPLETED) continue;
    const ci = checkinByName.get(row.name);
    const dd = personnelDetailByName.get(row.name);
    completedCandidates.push({
      stt: ci?.stt ?? null,
      name: row.name,
      productName: ci?.product ?? null,
      paymentNote: ci?.note ?? null,
      deviceAccepted: ci?.deviceAccepted ?? null,
      deviceAcceptedText: ci?.deviceAcceptedText ?? null,
      hyperlink: hyperlinkByName.get(row.name) ?? null,
      oldDeviceCheck: ci?.oldDeviceCheck ?? null,
      backupCheck: ci?.backupCheck ?? null,
      dsTuVan: dd?.dsTuVan ?? null,
      dsThuCu: dd?.dsThuCu ?? null,
      dsBackup: dd?.dsBackup ?? null,
      fromCluster: clusterFromDeskCode(row.deskCode),
      doneInFlow: ci?.doneInFlow ?? null,
    });
  }

  // "Chờ điều phối": hoàn tất 1 khâu, chưa đang được phục vụ ở đâu. Đã điều
  // phối (Master Điều phối) hay chưa KHÔNG ảnh hưởng — chỉ khi thật sự có
  // dòng "Tiếp nhận" mới (tức góp mặt trong activeNames) mới rời khỏi đây.
  const dispatchSeen = new Set<string>();
  const waitingDispatch: WaitingCustomer[] = [];
  for (const cand of completedCandidates) {
    if (!cand.name || activeNames.has(cand.name) || dispatchSeen.has(cand.name)) continue;
    if (checkinByName.get(cand.name)?.endFlow) continue;
    dispatchSeen.add(cand.name);
    waitingDispatch.push(cand);
  }

  // "Chờ check-in": đã check-in nhưng chưa từng xuất hiện ở Master (tức chưa
  // từng được NV nào nhận — đã điều phối rồi cũng vẫn tính, cho tới lúc có
  // dòng "Tiếp nhận" thật).
  const waitingCheckin: WaitingCustomer[] = [];
  for (const r of tables.checkin) {
    const name = cellToString(r.fields[checkin.name]);
    if (!name || everSeenNames.has(name) || activeNames.has(name)) continue;
    const dd = personnelDetailByName.get(name);
    waitingCheckin.push({
      stt: cellToString(r.fields[checkin.stt]),
      name,
      productName: cellToString(r.fields[checkin.product]),
      paymentNote: cellToString(r.fields[checkin.note]),
      deviceAccepted: cellToBool(r.fields[checkin.deviceAccepted]),
      deviceAcceptedText: cellToString(r.fields[checkin.deviceAccepted]),
      oldDeviceCheck: cellToString(r.fields[checkin.oldDeviceCheck]),
      backupCheck: cellToString(r.fields[checkin.backupCheck]),
      hyperlink: cellToUrl(r.fields[checkin.dispatchHyperlink]),
      dsTuVan: dd?.dsTuVan ?? null,
      dsThuCu: dd?.dsThuCu ?? null,
      dsBackup: dd?.dsBackup ?? null,
    });
  }

  // "End Flow": đã hoàn tất toàn bộ quy trình (Check-in cột "End flow").
  const endFlow: WaitingCustomer[] = [];
  for (const [name, ci] of checkinByName) {
    if (!ci.endFlow) continue;
    const dd = personnelDetailByName.get(name);
    endFlow.push({
      stt: ci.stt,
      name,
      productName: ci.product,
      paymentNote: ci.note,
      deviceAccepted: ci.deviceAccepted,
      deviceAcceptedText: ci.deviceAcceptedText,
      hyperlink: hyperlinkByName.get(name) ?? null,
      oldDeviceCheck: ci.oldDeviceCheck,
      backupCheck: ci.backupCheck,
      dsTuVan: dd?.dsTuVan ?? null,
      dsThuCu: dd?.dsThuCu ?? null,
      dsBackup: dd?.dsBackup ?? null,
      doneInFlow: ci.doneInFlow,
    });
  }

  const totalCheckIn = new Set(
    tables.checkin
      .map((r) => cellToString(r.fields[checkin.stt]))
      .filter((s): s is string => Boolean(s)),
  ).size;

  // "Danh sách đơn hàng" — total registered (row count).
  const totalRegistered = tables.orders?.length ?? 0;

  return { statesById, totalCheckIn, totalRegistered, waitingCheckin, waitingDispatch, endFlow };
}
