/**
 * larkSettings — user-editable Lark connection + field mapping, persisted to
 * localStorage. This is the single source the app reads at runtime; the
 * Settings page writes it. Falls back to env/compile-time defaults on first run.
 */
import { useSyncExternalStore } from 'react';
import type { ClusterKey } from '@/types/desk';
import type { TableKey } from '@/services/larkTypes';
import {
  DEFAULT_CHECKIN_FIELDS,
  DEFAULT_DS_FIELDS,
  DEFAULT_DS_STATUS_FIELDS,
  DEFAULT_DS_TYPE_FIELD,
  DEFAULT_MASTER_FIELDS,
  ENV_DEFAULTS,
  type CheckinFieldMap,
  type DsFieldMap,
  type DsStatusFieldMap,
  type DsTypeFieldMap,
  type FieldConfig,
  type LarkRuntimeConfig,
  type MasterFieldMap,
  type TableIdMap,
} from './larkConfig';

export type ConnMode = 'proxy' | 'direct';

export interface LarkSettings {
  useMock: boolean;
  mode: ConnMode;
  apiUrl: string;
  host: string;
  appToken: string;
  accessToken: string;
  pollSeconds: number;
  tableIds: Record<TableKey, string>;
  fields: {
    dsTradein: DsFieldMap;
    dsConsult: DsFieldMap;
    dsType: DsTypeFieldMap;
    dsStatus: DsStatusFieldMap;
    checkin: CheckinFieldMap;
    master: MasterFieldMap;
  };
}

const LS_KEY = 'npievent-lark-settings-v1';

export function defaultSettings(): LarkSettings {
  return {
    useMock: ENV_DEFAULTS.useMock,
    mode: ENV_DEFAULTS.apiUrl ? 'proxy' : 'direct',
    apiUrl: ENV_DEFAULTS.apiUrl,
    host: ENV_DEFAULTS.host,
    appToken: ENV_DEFAULTS.appToken,
    accessToken: ENV_DEFAULTS.accessToken,
    pollSeconds: Math.round(ENV_DEFAULTS.pollMs / 1000),
    tableIds: { ...ENV_DEFAULTS.tableIds },
    fields: {
      dsTradein: { ...DEFAULT_DS_FIELDS.kythuat },
      dsConsult: { ...DEFAULT_DS_FIELDS.consult },
      dsType: { field: DEFAULT_DS_TYPE_FIELD.field, value: { ...DEFAULT_DS_TYPE_FIELD.value } },
      dsStatus: { ...DEFAULT_DS_STATUS_FIELDS },
      checkin: { ...DEFAULT_CHECKIN_FIELDS },
      master: { ...DEFAULT_MASTER_FIELDS },
    },
  };
}

/** Merge a persisted (possibly partial/old) object onto fresh defaults. */
function hydrate(raw: unknown): LarkSettings {
  const base = defaultSettings();
  if (!raw || typeof raw !== 'object') return base;
  const p = raw as Partial<LarkSettings>;
  return {
    ...base,
    ...p,
    tableIds: { ...base.tableIds, ...(p.tableIds ?? {}) },
    fields: {
      dsTradein: { ...base.fields.dsTradein, ...(p.fields?.dsTradein ?? {}) },
      dsConsult: { ...base.fields.dsConsult, ...(p.fields?.dsConsult ?? {}) },
      dsType: {
        field: p.fields?.dsType?.field ?? base.fields.dsType.field,
        value: { ...base.fields.dsType.value, ...(p.fields?.dsType?.value ?? {}) },
      },
      dsStatus: { ...base.fields.dsStatus, ...(p.fields?.dsStatus ?? {}) },
      checkin: { ...base.fields.checkin, ...(p.fields?.checkin ?? {}) },
      master: { ...base.fields.master, ...(p.fields?.master ?? {}) },
    },
  };
}

function load(): LarkSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    return hydrate(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultSettings();
  }
}

let settings: LarkSettings = load();
const listeners = new Set<() => void>();

function emit() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export const larkSettingsStore = {
  subscribe(cb: () => void) {
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  },
  getSnapshot(): LarkSettings {
    return settings;
  },
  save(next: LarkSettings) {
    settings = next;
    emit();
  },
  reset() {
    settings = defaultSettings();
    emit();
  },
};

/** React hook: current settings (re-renders on save). */
export function useLarkSettings(): LarkSettings {
  return useSyncExternalStore(larkSettingsStore.subscribe, larkSettingsStore.getSnapshot, larkSettingsStore.getSnapshot);
}

// ── Derived views the rest of the app consumes ──────────────────────────────

function str(v: string): string | undefined {
  return v.trim() ? v.trim() : undefined;
}

export function toRuntimeConfig(s: LarkSettings = settings): LarkRuntimeConfig {
  const tableIds: TableIdMap = {
    dsTradein: str(s.tableIds.dsTradein),
    dsConsult: str(s.tableIds.dsConsult),
    checkin: str(s.tableIds.checkin),
    orders: str(s.tableIds.orders),
    master: str(s.tableIds.master),
  };
  return {
    useMock: s.useMock,
    apiUrl: s.mode === 'proxy' ? str(s.apiUrl) : undefined,
    host: str(s.host) ?? ENV_DEFAULTS.host,
    appToken: s.mode === 'direct' ? str(s.appToken) : undefined,
    accessToken: str(s.accessToken),
    tableIds,
    pollMs: Math.max(5, s.pollSeconds || 30) * 1000,
  };
}

export function toFieldConfig(s: LarkSettings = settings): FieldConfig {
  return {
    ds: { kythuat: s.fields.dsTradein, consult: s.fields.dsConsult },
    dsType: s.fields.dsType,
    dsStatus: s.fields.dsStatus,
    checkin: s.fields.checkin,
    master: s.fields.master,
  };
}

/** True when a real HTTPS source is configured. */
export function hasLiveSource(s: LarkSettings = settings): boolean {
  const c = toRuntimeConfig(s);
  return Boolean(c.apiUrl || c.appToken);
}

/** Default field config (used for mock, which uses default column names). */
export const DEFAULT_FIELD_CONFIG: FieldConfig = {
  ds: DEFAULT_DS_FIELDS,
  dsType: DEFAULT_DS_TYPE_FIELD,
  dsStatus: DEFAULT_DS_STATUS_FIELDS,
  checkin: DEFAULT_CHECKIN_FIELDS,
  master: DEFAULT_MASTER_FIELDS,
};

/** Labels for the mapping form. */
export const DS_FIELD_LABELS: Record<keyof DsFieldMap, string> = {
  code: 'Mã bàn',
  staff: 'Nhân viên',
  received: 'SL đang tiếp nhận',
  completed: 'SL hoàn tất',
  waiting: 'SL khách chờ',
};
/** Nhãn cho khối lọc "Loại" (DS Master dùng chung cho cả 2 cụm). */
export const DS_TYPE_FIELD_LABEL = 'Tên cột "Loại"';
export const DS_TYPE_VALUE_LABELS: Record<ClusterKey, string> = {
  kythuat: 'Giá trị lọc — Kỹ thuật',
  consult: 'Giá trị lọc — Tư vấn',
};
export const DS_STATUS_LABELS: Record<keyof DsStatusFieldMap, string> = {
  sttRecent: 'STT gần nhất',
  statusRecent: 'Trạng thái gần nhất',
  customerRecent: 'Khách gần nhất',
  currentStatus: 'Trạng thái hiện tại',
};
export const CHECKIN_LABELS: Record<keyof CheckinFieldMap, string> = {
  stt: 'STT khách',
  name: 'Họ và tên',
  product: 'Tên sản phẩm (SP 1)',
  note: 'Ghi chú thanh toán',
  deviceAccepted: 'Check nghiệm thu (đã thu máy cũ)',
  oldDeviceCheck: 'Thu cũ check (lựa chọn — hiển thị nguyên văn)',
  doneInFlow: 'Done in Flow (khâu vừa hoàn tất)',
  endFlow: 'End flow (đã xong toàn bộ quy trình)',
  time: 'Thời gian check-in (để sắp thứ tự)',
  statusTradein: 'Status in thu cũ (cụm Kỹ thuật — dùng cho "Chờ điều phối")',
  statusConsult: 'Status in tư vấn (dùng cho "Chờ điều phối")',
};

export const MASTER_FIELD_LABELS: Record<keyof MasterFieldMap, string> = {
  deskCode: 'Mã bàn (TV_MãNV — khớp mã bàn trên sơ đồ)',
  status: 'Trạng thái (Tiếp nhận/Hoàn tất)',
  name: 'Họ và tên',
  time: 'Thời gian (để sắp thứ tự nhiều khách/bàn)',
};

export const TABLE_LABELS: Record<TableKey, string> = {
  dsTradein: 'DS Kỹ thuật (bảng "DS Master", lọc Loại = Thu cũ)',
  dsConsult: 'DS Tư vấn (bảng "DS Master", lọc Loại = Tư vấn)',
  checkin: 'Check in (bảng "Master_Check in")',
  orders: 'Danh sách đơn hàng',
  master: 'Master (NV tiếp nhận khách theo bàn)',
};

export type { ClusterKey };
