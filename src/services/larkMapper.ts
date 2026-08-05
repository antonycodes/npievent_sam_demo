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
 * Chi tiết khách (SP, ghi chú, nghiệm thu…) vẫn join theo TÊN từ
 * `Master_Check in` như cũ. 3 tầng "đang chờ" không trùng nhau (xem
 * `dispatchedNames` bên dưới): chưa điều phối đi đâu (`waitingCheckin`) →
 * đã điều phối vào 1 bàn, chờ NV nhận (badge bàn) → đang được phục vụ.
 */
import {
  STATUS_COMPLETED,
  STATUS_RECEIVED,
  type CheckinFieldMap,
  type DispatchFieldMap,
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
 * once at check-in and unchanged for the whole event.
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

interface DeskGroup {
  customers: DeskCustomer[];
  staff: string | null;
}

/**
 * Gom khách đang "Tiếp nhận" (bảng `Master`) theo MÃ BÀN (`TV_MãNV`, khớp
 * thẳng `TablePosition.id`), sắp theo "Thời gian" tăng dần. Cũng lấy luôn tên
 * NV (`Người`) — dòng nào có giá trị trước thì dùng (nhiều dòng cùng bàn nên
 * luôn cùng 1 NV trong thực tế).
 */
function indexMasterByDeskCode(
  rows: LarkRecord[],
  fm: MasterFieldMap,
  checkinByName: Map<string, CheckinIndexEntry>,
): Map<string, DeskGroup> {
  const entries: Array<{ deskCode: string; time: number; staff: string | null; customer: DeskCustomer }> = [];

  for (const r of rows) {
    const deskCode = cellToString(r.fields[fm.deskCode]);
    if (!deskCode || cellToString(r.fields[fm.status]) !== STATUS_RECEIVED) continue;
    const name = cellToString(r.fields[fm.name]);
    if (!name) continue;
    const ci = checkinByName.get(name);
    entries.push({
      deskCode,
      time: cellToNumber(r.fields[fm.time]),
      staff: cellToString(r.fields[fm.staff]),
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
  const deskFields = [fm.deskField.kythuat, fm.deskField.consult];
  const result = new Map<string, Set<string>>();
  for (const r of rows) {
    const name = cellToString(r.fields[fm.name]);
    if (!name) continue;
    for (const field of deskFields) {
      const deskCode = cellToString(r.fields[field]);
      if (!deskCode) continue;
      const set = result.get(deskCode) ?? new Set<string>();
      set.add(name);
      result.set(deskCode, set);
    }
  }
  return result;
}

export function mapDeskStates(tables: LarkTables, fields: FieldConfig = toFieldConfig()): MappedData {
  const { checkin, master, dispatch } = fields;
  const checkinByName = indexCheckinByName(tables.checkin, checkin);
  const activeByDeskCode = indexMasterByDeskCode(tables.master, master, checkinByName);
  const dispatchByDeskCode = indexDispatchByDeskCode(tables.dispatch, dispatch);
  const statesById: Record<string, DeskLiveState> = {};

  // Đang được phục vụ ở BẤT KỲ bàn nào ngay lúc này.
  const activeNames = new Set<string>();
  // Đã từng xuất hiện trong Master (bất kỳ trạng thái) — dùng để loại khỏi "Chờ check-in".
  const everSeenNames = new Set<string>();
  // Đã được điều phối vào 1 bàn cụ thể (dù chưa được nhận) — loại khỏi cả
  // "Chờ check-in" lẫn "Chờ điều phối" chung, vì đã có badge riêng ở đúng bàn đó.
  const dispatchedNames = new Set<string>();

  for (const r of tables.master) {
    const name = cellToString(r.fields[master.name]);
    if (name) everSeenNames.add(name);
  }
  for (const names of dispatchByDeskCode.values()) {
    for (const n of names) dispatchedNames.add(n);
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
      if (!servedNames.has(n)) waiting += 1;
    }

    const primary = receivedCustomers[0];
    statesById[code] = {
      staffName: group?.staff ?? null,
      waiting,
      currentStatus: occupied ? 'Đang tiếp nhận' : 'Rảnh',
      isOccupied: occupied,
      hasData: true,
      customerSTT: primary?.stt ?? null,
      customerName: primary?.name ?? null,
      productName: primary?.productName ?? null,
      paymentNote: primary?.paymentNote ?? null,
      deviceAccepted: primary?.deviceAccepted ?? null,
      receivedCustomers,
    };
  }

  // Ứng viên "chờ điều phối" — quét theo TỪNG KHÁCH qua Check-in
  // (`Status in <cụm>` = "Hoàn tất").
  const completedCandidates: WaitingCustomer[] = [];
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

  // "Chờ điều phối": hoàn tất 1 khâu, chưa đang được phục vụ ở đâu, VÀ chưa
  // được điều phối vào bàn cụ thể nào (nếu đã dispatch thì hiện ở badge bàn
  // đó thay vì khu chung — tránh đếm trùng).
  const dispatchSeen = new Set<string>();
  const waitingDispatch: WaitingCustomer[] = [];
  for (const cand of completedCandidates) {
    if (!cand.name || activeNames.has(cand.name) || dispatchSeen.has(cand.name)) continue;
    if (dispatchedNames.has(cand.name)) continue;
    if (checkinByName.get(cand.name)?.endFlow) continue;
    dispatchSeen.add(cand.name);
    waitingDispatch.push(cand);
  }

  // "Chờ check-in": đã check-in nhưng chưa từng xuất hiện ở Master VÀ chưa
  // được điều phối vào bàn nào.
  const waitingCheckin: WaitingCustomer[] = [];
  for (const r of tables.checkin) {
    const name = cellToString(r.fields[checkin.name]);
    if (!name || everSeenNames.has(name) || activeNames.has(name) || dispatchedNames.has(name)) continue;
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
