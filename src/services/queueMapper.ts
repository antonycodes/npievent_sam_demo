/**
 * queueMapper — per-desk "STT hiện tại / STT tiếp theo" view for the
 * standalone queue-board pages (/tuvanview, /kythuatview).
 *
 * Deliberately separate from `larkMapper.ts`'s `mapDeskStates` (which the main
 * dashboard depends on) so these display-only screens can never affect the
 * main dashboard's mapping logic: it reads `mapDeskStates`'s exported output
 * for "current" and takes "next" DIRECTLY from `DS Master.STT tiếp theo`,
 * because that value is already calculated in Lark.
 */
import type { FieldConfig } from '@/config/larkConfig';
import { toFieldConfig } from '@/config/larkSettings';
import { ALL_POSITIONS } from '@/config/layoutConfig';
import { cellToBool, cellToString, mapDeskStates } from './larkMapper';
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
  /** STT đã tính sẵn trong `DS Master.STT tiếp theo` (tối đa 1 khách). */
  next: DeskCustomer[];
}

/** Check-in rows indexed by STT → bổ sung chi tiết cho STT lấy từ DS Master. */
function indexCheckinDetailByStt(rows: LarkRecord[], fm: FieldConfig['checkin']): Map<string, DeskCustomer> {
  const m = new Map<string, DeskCustomer>();
  for (const r of rows) {
    const stt = cellToString(r.fields[fm.stt]);
    const name = cellToString(r.fields[fm.name]);
    if (!stt) continue;
    m.set(stt, {
      stt,
      name,
      productName: cellToString(r.fields[fm.product]),
      paymentNote: cellToString(r.fields[fm.note]),
      deviceAccepted: cellToBool(r.fields[fm.deviceAccepted]),
      deviceAcceptedText: cellToString(r.fields[fm.deviceAccepted]),
      oldDeviceCheck: cellToString(r.fields[fm.oldDeviceCheck]),
      backupCheck: cellToString(r.fields[fm.backupCheck]),
    });
  }
  return m;
}

export function mapQueueStates(
  tables: LarkTables,
  fields: FieldConfig = toFieldConfig(),
): Record<string, DeskQueueState> {
  const { statesById } = mapDeskStates(tables, fields);
  const checkinByStt = indexCheckinDetailByStt(tables.checkin, fields.checkin);

  const out: Record<string, DeskQueueState> = {};
  for (const pos of ALL_POSITIONS) {
    const state = statesById[pos.id];
    const current = state?.receivedCustomers ?? [];
    const nextStt = state?.nextWaitingStt ?? null;
    const next = nextStt ? [checkinByStt.get(nextStt) ?? { stt: nextStt, name: null }] : [];
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
