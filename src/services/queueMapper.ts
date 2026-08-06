/**
 * queueMapper — per-desk "STT hiện tại / STT tiếp theo" view for the
 * standalone queue-board pages (/tuvanview, /kythuatview).
 *
 * Deliberately separate from `larkMapper.ts`'s `mapDeskStates` (which the main
 * dashboard depends on) so these display-only screens can never affect the
 * main dashboard's mapping logic: it only *reads* `mapDeskStates`'s exported
 * output for "current" (khách đang "Tiếp nhận") and re-derives "next" from
 * `Master Điều phối` + `Master_Check in` the same way larkMapper's private
 * `indexDispatchByDeskCode` does — except that one only returns a Set of
 * names (count-only), while this view needs the actual STT/ordered detail.
 */
import type { FieldConfig } from '@/config/larkConfig';
import { toFieldConfig } from '@/config/larkSettings';
import { ALL_POSITIONS } from '@/config/layoutConfig';
import { cellToBool, cellToString, mapDeskStates, normalizeDeskCode } from './larkMapper';
import type { ClusterKey, DeskCustomer } from '@/types/desk';
import type { LarkRecord, LarkTables } from './larkTypes';

/** 1 bàn: mã/nhãn/cụm + khách đang phục vụ (current) và khách kế tiếp trong hàng chờ (next). */
export interface DeskQueueState {
  id: string;
  label: string;
  cluster: ClusterKey;
  staffName: string | null;
  /** Khách đang "Tiếp nhận" tại bàn (từ `Master`) — có thể > 1 nếu 1 NV phục vụ nhiều khách cùng lúc. */
  current: DeskCustomer[];
  /**
   * Đã điều phối vào bàn này (`Master Điều phối`) nhưng CHƯA có dòng "Tiếp
   * nhận" tương ứng — tức đang chờ tới lượt. Thứ tự theo đúng thứ tự dòng
   * trong bảng gốc (bảng điều phối không có cột thời gian riêng).
   */
  next: DeskCustomer[];
}

/** Check-in rows indexed by name → chi tiết khách đầy đủ (giống larkMapper's indexCheckinByName, viết riêng để không phải export hàm private đó). */
function indexCheckinDetailByName(rows: LarkRecord[], fm: FieldConfig['checkin']): Map<string, DeskCustomer> {
  const m = new Map<string, DeskCustomer>();
  for (const r of rows) {
    const name = cellToString(r.fields[fm.name]);
    if (!name) continue;
    m.set(name, {
      stt: cellToString(r.fields[fm.stt]),
      name,
      productName: cellToString(r.fields[fm.product]),
      paymentNote: cellToString(r.fields[fm.note]),
      deviceAccepted: cellToBool(r.fields[fm.deviceAccepted]),
      oldDeviceCheck: cellToString(r.fields[fm.oldDeviceCheck]),
      backupCheck: cellToString(r.fields[fm.backupCheck]),
    });
  }
  return m;
}

/** Khách đã điều phối vào từng mã bàn, CHƯA lọc theo "đã đang được phục vụ chưa" (lọc ở `mapQueueStates`). */
const END_FLOW_DONE = 'end flow';

/**
 * Tên khách đã "End flow" (xong toàn bộ quy trình, Check-in cột "End flow")
 * — viết riêng thay vì import từ larkMapper.ts's `isEndFlowValue` (private,
 * xem module doc: cố tình tách biệt 2 mapper). Dùng để loại khỏi "STT tiếp
 * theo" — dòng `Master Điều phối` gán khách vào bàn có thể chưa/không bị xoá
 * sau khi họ đã hoàn tất toàn bộ, không nên tính là "đang chờ" nữa (bug thật
 * user báo 2026-08-06: khách đã End Flow vẫn hiện là STT tiếp theo).
 */
function indexEndFlowNames(rows: LarkRecord[], fm: FieldConfig['checkin']): Set<string> {
  const result = new Set<string>();
  for (const r of rows) {
    const name = cellToString(r.fields[fm.name]);
    const endFlow = cellToString(r.fields[fm.endFlow]);
    if (name && endFlow?.trim().toLowerCase() === END_FLOW_DONE) result.add(name);
  }
  return result;
}

function indexNextByDeskCode(
  rows: LarkRecord[],
  fm: FieldConfig['dispatch'],
  checkinByName: Map<string, DeskCustomer>,
): Map<string, DeskCustomer[]> {
  const deskFields = [fm.deskField.kythuat, fm.deskField.consult];
  const result = new Map<string, DeskCustomer[]>();
  for (const r of rows) {
    const name = cellToString(r.fields[fm.name]);
    if (!name) continue;
    for (const field of deskFields) {
      const deskCode = normalizeDeskCode(cellToString(r.fields[field]));
      if (!deskCode) continue;
      const list = result.get(deskCode) ?? [];
      list.push(
        checkinByName.get(name) ?? {
          stt: null,
          name,
          productName: null,
          paymentNote: null,
          deviceAccepted: null,
          oldDeviceCheck: null,
          backupCheck: null,
        },
      );
      result.set(deskCode, list);
    }
  }
  return result;
}

export function mapQueueStates(
  tables: LarkTables,
  fields: FieldConfig = toFieldConfig(),
): Record<string, DeskQueueState> {
  const { statesById } = mapDeskStates(tables, fields);
  const checkinByName = indexCheckinDetailByName(tables.checkin, fields.checkin);
  const nextByDeskCode = indexNextByDeskCode(tables.dispatch, fields.dispatch, checkinByName);
  const endFlowNames = indexEndFlowNames(tables.checkin, fields.checkin);

  const out: Record<string, DeskQueueState> = {};
  for (const pos of ALL_POSITIONS) {
    const state = statesById[pos.id];
    const current = state?.receivedCustomers ?? [];
    const servedNames = new Set(current.map((c) => c.name).filter((n): n is string => Boolean(n)));
    const next = (nextByDeskCode.get(pos.id) ?? []).filter(
      (c) => !c.name || (!servedNames.has(c.name) && !endFlowNames.has(c.name)),
    );
    out[pos.id] = {
      id: pos.id,
      label: pos.label,
      cluster: pos.cluster,
      staffName: state?.staffName ?? null,
      current,
      next,
    };
  }
  return out;
}
