/**
 * larkMapper — turn raw Lark tables into per-desk live state.
 *
 * Each DS registry row (`DS Master`, filtered by `Loại` — see `filterByType`)
 * carries the desk's current status and latest customer, so occupancy status
 * text comes straight from DS:
 *   - status ← `Trạng thái hiện tại` ("Đang tư vấn" → occupied, "Rảnh" → free)
 *   - "Khách gần nhất" — used only as a FALLBACK single customer when the
 *     `Master` table (below) has no active row for this desk yet.
 *
 * **Master schema (2026-08-05), per user's real business flow**: khách
 * check-in ở `Master_Check in` (STT) → điều phối gán bàn trong `Master Điều
 * phối` (không đọc bởi app — chỉ ảnh hưởng `Sl khách chờ` tính sẵn trong `DS
 * Master`) → NV tiếp nhận khách, ghi vào `Master` (`TV_MãNV` = mã bàn, khớp
 * THẲNG `TablePosition.id`; `Trạng thái` = Tiếp nhận/Hoàn tất). `Master` giờ
 * là nguồn xác định "khách nào đang ở bàn nào" — thay cho cách suy gián tiếp
 * qua khoá NV trong Check-in (bản trước, xem `indexMasterByDeskCode`): cách cũ
 * tồn tại vì bảng giao dịch gốc ("Giao dịch Tư vấn") chỉ có cho Tư vấn, không
 * có cho Kỹ thuật; `Master` giờ phủ cả 2 loại qua cột `Loại`, và vì `TV_MãNV`
 * chính là mã bàn nên không cần khoá gián tiếp/anchor gì nữa — group thẳng
 * theo mã bàn. Full chi tiết khách (SP, ghi chú, nghiệm thu…) vẫn join theo
 * TÊN từ `Master_Check in` như cũ.
 */
import {
  STATUS_COMPLETED,
  STATUS_RECEIVED,
  type CheckinFieldMap,
  type FieldConfig,
  type MasterFieldMap,
} from '@/config/larkConfig';
import { toFieldConfig } from '@/config/larkSettings';
import {
  deskUiStatus,
  type ClusterKey,
  type DeskCustomer,
  type DeskLiveState,
  type WaitingCustomer,
} from '@/types/desk';
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

const CLUSTERS: ClusterKey[] = ['kythuat', 'consult'];
// `kythuat` still reads the "dsTradein" Lark table (unchanged) — see the
// module doc above and layoutConfig.ts's `ID_PREFIX` comment.
const DS_KEY = { kythuat: 'dsTradein', consult: 'dsConsult' } as const;

/** Lọc rows "DS Master" theo cột `Loại` cho đúng cụm (xem module doc). */
function filterByType(rows: LarkRecord[], cluster: ClusterKey, dsType: FieldConfig['dsType']): LarkRecord[] {
  const wanted = dsType.value[cluster]?.trim();
  if (!dsType.field.trim() || !wanted) return rows; // chưa cấu hình → không lọc
  return rows.filter((r) => cellToString(r.fields[dsType.field]) === wanted);
}

export interface MappedData {
  statesById: Record<string, DeskLiveState>;
  totalCheckIn: number;
  totalRegistered: number;
  /** Đã check-in (có STT) nhưng chưa từng xuất hiện ở bàn nào — chờ điều phối lần đầu. */
  waitingCheckin: WaitingCustomer[];
  /** Vừa hoàn tất 1 cụm, bàn đang rảnh, chưa được điều phối sang cụm tiếp theo. */
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
  /** Cột "Thu cũ check" — nguyên văn lựa chọn (single-select, có thể ≥ 2 tuỳ chọn). */
  oldDeviceCheck: string | null;
  /** Khâu vừa hoàn tất (Check-in cột "Done in Flow") — chỉ có ý nghĩa khi khách đã xong 1 khâu. */
  doneInFlow: string | null;
  /** Đã hoàn tất toàn bộ quy trình (Check-in cột "End flow"). */
  endFlow: boolean;
}

/**
 * Index Check-in rows by customer name.
 *
 * Check-in's `STT` is the ONE canonical queue number for a customer — assigned
 * once at check-in and unchanged for the whole event. DS tables also carry a
 * local "STT gần nhất (helper)" per stage, but that is a per-stage helper, not
 * an identity — never use it to label a customer.
 */
function indexCheckinByName(rows: LarkRecord[], fm: CheckinFieldMap): Map<string, CheckinIndexEntry> {
  const m = new Map<string, CheckinIndexEntry>();
  for (const r of rows) {
    const name = cellToString(r.fields[fm.name]);
    if (name) {
      m.set(name, {
        stt: cellToString(r.fields[fm.stt]),
        product: cellToString(r.fields[fm.product]),
        note: cellToString(r.fields[fm.note]),
        deviceAccepted: cellToBool(r.fields[fm.deviceAccepted]),
        oldDeviceCheck: cellToString(r.fields[fm.oldDeviceCheck]),
        doneInFlow: cellToString(r.fields[fm.doneInFlow]),
        endFlow: isEndFlowValue(r.fields[fm.endFlow]),
      });
    }
  }
  return m;
}

const STATUS_FIELD: Record<ClusterKey, keyof CheckinFieldMap> = {
  kythuat: 'statusTradein',
  consult: 'statusConsult',
};

/**
 * Gom khách đang "Tiếp nhận" (bảng `Master`) theo MÃ BÀN (`TV_MãNV`, khớp
 * thẳng `TablePosition.id`), sắp theo "Thời gian" tăng dần (ai được tiếp
 * nhận trước lên trước). Đây là nguồn cho phép 1 bàn/NV hiện đủ TẤT CẢ khách
 * đang phục vụ cùng lúc, phủ cả 2 cụm (Kỹ thuật/Tư vấn) qua cùng 1 bảng.
 */
function indexMasterByDeskCode(
  rows: LarkRecord[],
  fm: MasterFieldMap,
  checkinByName: Map<string, CheckinIndexEntry>,
): Map<string, DeskCustomer[]> {
  const entries: Array<{ deskCode: string; time: number; customer: DeskCustomer }> = [];

  for (const r of rows) {
    const deskCode = cellToString(r.fields[fm.deskCode]);
    if (!deskCode || cellToString(r.fields[fm.status]) !== STATUS_RECEIVED) continue;
    const name = cellToString(r.fields[fm.name]);
    if (!name) continue;
    const ci = checkinByName.get(name);
    entries.push({
      deskCode,
      time: cellToNumber(r.fields[fm.time]),
      customer: {
        stt: ci?.stt ?? null,
        name,
        productName: ci?.product ?? null,
        paymentNote: ci?.note ?? null,
        deviceAccepted: ci?.deviceAccepted ?? null,
        oldDeviceCheck: ci?.oldDeviceCheck ?? null,
      },
    });
  }

  entries.sort((a, b) => a.time - b.time);
  const result = new Map<string, DeskCustomer[]>();
  for (const e of entries) {
    const list = result.get(e.deskCode) ?? [];
    list.push(e.customer);
    result.set(e.deskCode, list);
  }
  return result;
}

export function mapDeskStates(tables: LarkTables, fields: FieldConfig = toFieldConfig()): MappedData {
  const { ds, dsType, dsStatus, checkin, master } = fields;
  const checkinByName = indexCheckinByName(tables.checkin, checkin);
  // Khách đang "Tiếp nhận" theo mã bàn (bảng Master) — cho phép 1 bàn/NV hiện
  // nhiều khách cùng lúc, phủ cả 2 cụm.
  const activeByDeskCode = indexMasterByDeskCode(tables.master, master, checkinByName);
  const statesById: Record<string, DeskLiveState> = {};

  // Đang được phục vụ ở BẤT KỲ bàn nào ngay lúc này (mọi cụm).
  const activeNames = new Set<string>();
  // Đã từng xuất hiện ở bất kỳ bàn nào (mọi trạng thái) — dùng để loại khỏi "Chờ check-in".
  const everSeenNames = new Set<string>();
  // Ứng viên "chờ điều phối": bàn vừa hoàn tất (Trạng thái gần nhất) và hiện đang rảnh.
  const completedCandidates: WaitingCustomer[] = [];

  for (const cluster of CLUSTERS) {
    const dsFm = ds[cluster];

    for (const rec of filterByType(tables[DS_KEY[cluster]], cluster, dsType)) {
      const code = cellToString(rec.fields[dsFm.code]);
      if (!code) continue;

      const currentStatus = cellToString(rec.fields[dsStatus.currentStatus]);
      const customerRecent = cellToString(rec.fields[dsStatus.customerRecent]);

      if (customerRecent) everSeenNames.add(customerRecent);

      // `code` (mã bàn của dòng DS này) khớp THẲNG `TV_MãNV` trong Master —
      // không cần anchor/khoá NV gián tiếp nữa (xem module doc).
      const grouped = activeByDeskCode.get(code);
      const hasActiveGroup = (grouped?.length ?? 0) > 0;

      // Occupied = có nhóm khách thật sự đang "Tiếp nhận" trong Master (đáng
      // tin hơn), HOẶC (fallback) DS tự báo đang bận — dùng khi Master chưa
      // kịp có dòng cho bàn này.
      const dsOccupied = deskUiStatus({ currentStatus, hasData: true }) === 'occupied';
      const occupied = hasActiveGroup || dsOccupied;

      // Fallback về đúng 1 khách "gần nhất" — CHỈ khi Master chưa gom được
      // nhóm nào cho bàn này nhưng DS vẫn báo đang bận.
      const anchorCi = customerRecent ? checkinByName.get(customerRecent) : undefined;
      const fallback: DeskCustomer[] =
        !hasActiveGroup && dsOccupied && customerRecent
          ? [
              {
                stt: anchorCi?.stt ?? null,
                name: customerRecent,
                productName: anchorCi?.product ?? null,
                paymentNote: anchorCi?.note ?? null,
                deviceAccepted: anchorCi?.deviceAccepted ?? null,
                oldDeviceCheck: anchorCi?.oldDeviceCheck ?? null,
              },
            ]
          : [];
      const receivedCustomers: DeskCustomer[] = hasActiveGroup ? grouped! : fallback;
      for (const c of receivedCustomers) if (c.name) activeNames.add(c.name);

      // Các field "1 khách" (legacy, chủ yếu phục vụ nhánh fallback/hiện thị
      // rút gọn) — lấy từ khách ĐẦU TIÊN trong `receivedCustomers` thật sự.
      const primary = receivedCustomers[0];
      const customerSTT = primary?.stt ?? null;
      const customerName = primary?.name ?? null;
      const productName = primary?.productName ?? null;
      const paymentNote = primary?.paymentNote ?? null;
      const deviceAccepted = primary?.deviceAccepted ?? null;

      statesById[code] = {
        staffName: cellToString(rec.fields[dsFm.staff]),
        received: cellToNumber(rec.fields[dsFm.received]),
        completed: cellToNumber(rec.fields[dsFm.completed]),
        // Guard against spreadsheet formula artifacts (e.g. -1).
        waiting: Math.max(0, cellToNumber(rec.fields[dsFm.waiting])),
        currentStatus,
        isOccupied: occupied,
        hasData: true,
        customerSTT,
        customerName,
        productName,
        paymentNote,
        deviceAccepted,
        receivedCustomers,
      };
    }
  }

  // Ứng viên "chờ điều phối" — quét theo TỪNG KHÁCH qua Check-in
  // (`Status in <cụm>` = "Hoàn tất"), KHÔNG theo bàn: 1 bàn có thể vừa hoàn
  // tất 1 khách trong khi NV đó vẫn đang phục vụ khách khác cùng lúc — DS chỉ
  // báo "Hoàn tất"/"Rảnh" ở cấp CẢ BÀN nên bỏ sót đúng ca này (occupied vẫn
  // true vì còn khách khác). `activeNames`/`dispatchSeen`/`endFlow` xử lý loại
  // trùng bên dưới, nên chỉ cần đẩy hết ứng viên vào đây.
  for (const cluster of CLUSTERS) {
    const statusField = checkin[STATUS_FIELD[cluster]];
    for (const r of tables.checkin) {
      if (cellToString(r.fields[statusField]) !== STATUS_COMPLETED) continue;
      const name = cellToString(r.fields[checkin.name]);
      if (!name) continue;
      const ci = checkinByName.get(name);
      completedCandidates.push({
        stt: ci?.stt ?? null,
        name,
        productName: ci?.product ?? null,
        paymentNote: ci?.note ?? null,
        deviceAccepted: ci?.deviceAccepted ?? null,
        oldDeviceCheck: ci?.oldDeviceCheck ?? null,
        fromCluster: cluster,
        doneInFlow: ci?.doneInFlow ?? null,
      });
    }
  }

  // "Chờ điều phối": hoàn tất 1 khâu nhưng chưa đang được phục vụ ở đâu khác
  // (đã dispatch rồi thì loại; đã "End flow" toàn bộ thì cũng loại — không cần
  // điều phối thêm nữa; 1 khách chỉ hiện 1 lần dù hoàn tất ở nhiều bàn).
  const dispatchSeen = new Set<string>();
  const waitingDispatch: WaitingCustomer[] = [];
  for (const cand of completedCandidates) {
    if (!cand.name || activeNames.has(cand.name) || dispatchSeen.has(cand.name)) continue;
    if (checkinByName.get(cand.name)?.endFlow) continue;
    dispatchSeen.add(cand.name);
    waitingDispatch.push(cand);
  }

  // "Chờ check-in": đã check-in (có STT) nhưng chưa từng xuất hiện ở bàn nào.
  const waitingCheckin: WaitingCustomer[] = [];
  for (const r of tables.checkin) {
    const name = cellToString(r.fields[checkin.name]);
    if (!name || everSeenNames.has(name) || activeNames.has(name)) continue;
    waitingCheckin.push({
      stt: cellToString(r.fields[checkin.stt]),
      name,
      productName: cellToString(r.fields[checkin.product]),
      paymentNote: cellToString(r.fields[checkin.note]),
      deviceAccepted: cellToBool(r.fields[checkin.deviceAccepted]),
      oldDeviceCheck: cellToString(r.fields[checkin.oldDeviceCheck]),
    });
  }

  // "End Flow": đã hoàn tất toàn bộ quy trình (Check-in cột "End flow").
  const endFlow: WaitingCustomer[] = [];
  for (const [name, ci] of checkinByName) {
    if (!ci.endFlow) continue;
    endFlow.push({
      stt: ci.stt,
      name,
      productName: ci.product,
      paymentNote: ci.note,
      deviceAccepted: ci.deviceAccepted,
      oldDeviceCheck: ci.oldDeviceCheck,
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
