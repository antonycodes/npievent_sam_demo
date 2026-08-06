/**
 * queueMapper — per-desk "STT hiện tại / STT tiếp theo" view for the
 * standalone queue-board pages (/tuvanview, /kythuatview).
 *
 * The current customer comes from `mapDeskStates`/SS_Master. The next STT is
 * read directly from `DS Master.STT tiếp theo`, because Lark already computes
 * that value and is the source of truth for queue order and eligibility.
 */
import type { FieldConfig } from '@/config/larkConfig';
import { toFieldConfig } from '@/config/larkSettings';
import { ALL_POSITIONS } from '@/config/layoutConfig';
import { cellToBool, cellToString, mapDeskStates } from './larkMapper';
import type { ClusterKey, DeskCustomer } from '@/types/desk';
import type { LarkRecord, LarkTables } from './larkTypes';

/** 1 bàn: mã/nhãn/cụm + khách đang phục vụ và STT tiếp theo. */
export interface DeskQueueState {
  id: string;
  label: string;
  cluster: ClusterKey;
  staffName: string | null;
  current: DeskCustomer[];
  /** STT đã tính sẵn trong `DS Master.STT tiếp theo` (tối đa 1 khách). */
  next: DeskCustomer[];
}

/** Check-in rows indexed by STT để bổ sung chi tiết cho STT lấy từ DS Master. */
function indexCheckinDetailByStt(rows: LarkRecord[], fm: FieldConfig['checkin']): Map<string, DeskCustomer> {
  const result = new Map<string, DeskCustomer>();
  for (const r of rows) {
    const stt = cellToString(r.fields[fm.stt]);
    if (!stt) continue;
    result.set(stt, {
      stt,
      name: cellToString(r.fields[fm.name]),
      productName: cellToString(r.fields[fm.product]),
      paymentNote: cellToString(r.fields[fm.note]),
      deviceAccepted: cellToBool(r.fields[fm.deviceAccepted]),
      oldDeviceCheck: cellToString(r.fields[fm.oldDeviceCheck]),
      backupCheck: cellToString(r.fields[fm.backupCheck]),
    });
  }
  return result;
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
    const next = nextStt
      ? [
          checkinByStt.get(nextStt) ?? {
            stt: nextStt,
            name: null,
            productName: null,
            paymentNote: null,
            deviceAccepted: null,
            oldDeviceCheck: null,
            backupCheck: null,
          },
        ]
      : [];
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
