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
  DEFAULT_DISPATCH_FIELDS,
  DEFAULT_MASTER_FIELDS,
  ENV_DEFAULTS,
  type CheckinFieldMap,
  type DispatchFieldMap,
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
    checkin: CheckinFieldMap;
    master: MasterFieldMap;
    dispatch: DispatchFieldMap;
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
      checkin: { ...DEFAULT_CHECKIN_FIELDS },
      master: { ...DEFAULT_MASTER_FIELDS },
      dispatch: { deskField: { ...DEFAULT_DISPATCH_FIELDS.deskField }, name: DEFAULT_DISPATCH_FIELDS.name },
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
      checkin: { ...base.fields.checkin, ...(p.fields?.checkin ?? {}) },
      master: { ...base.fields.master, ...(p.fields?.master ?? {}) },
      dispatch: {
        deskField: { ...base.fields.dispatch.deskField, ...(p.fields?.dispatch?.deskField ?? {}) },
        name: p.fields?.dispatch?.name ?? base.fields.dispatch.name,
      },
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
    checkin: str(s.tableIds.checkin),
    orders: str(s.tableIds.orders),
    master: str(s.tableIds.master),
    dispatch: str(s.tableIds.dispatch),
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
    checkin: s.fields.checkin,
    master: s.fields.master,
    dispatch: s.fields.dispatch,
  };
}

/** True when a real HTTPS source is configured. */
export function hasLiveSource(s: LarkSettings = settings): boolean {
  const c = toRuntimeConfig(s);
  return Boolean(c.apiUrl || c.appToken);
}

/** Default field config (used for mock, which uses default column names). */
export const DEFAULT_FIELD_CONFIG: FieldConfig = {
  checkin: DEFAULT_CHECKIN_FIELDS,
  master: DEFAULT_MASTER_FIELDS,
  dispatch: DEFAULT_DISPATCH_FIELDS,
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
  staff: 'NV phụ trách (person field)',
  time: 'Thời gian (để sắp thứ tự nhiều khách/bàn)',
};

export const DISPATCH_FIELD_LABEL = 'Họ và tên';
export const DISPATCH_DESK_FIELD_LABELS: Record<ClusterKey, string> = {
  kythuat: 'Cột mã bàn — Kỹ thuật (vd "DS thu cũ")',
  consult: 'Cột mã bàn — Tư vấn (vd "DS Tư vấn")',
};

export const TABLE_LABELS: Record<TableKey, string> = {
  checkin: 'Check in (bảng "Master_Check in")',
  orders: 'Danh sách đơn hàng',
  master: 'Master (NV tiếp nhận khách theo bàn)',
  dispatch: 'Master Điều phối (khách đã gán bàn, chờ NV nhận)',
};

export type { ClusterKey };
