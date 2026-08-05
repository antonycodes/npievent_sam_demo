/**
 * larkService — fetch every table the dashboard needs, in parallel.
 *
 * `fetchLarkData` returns the raw records for the 5 tables the app reads —
 * `checkin` (`Master_Check in`), `orders` ("Danh sách đơn hàng"), `master`
 * (`Master` — who's being served where + "Chờ điều phối"), `dispatch`
 * (`Master Điều phối` — who's been assigned a desk but not yet received),
 * `dsMaster` (`DS Master` — only "STT tiếp theo" per desk). In mock mode it
 * returns the bundled fixtures instead of hitting the network.
 */
import type { LarkRuntimeConfig } from '@/config/larkConfig';
import { toRuntimeConfig } from '@/config/larkSettings';
import { mockLarkTables } from '@/data/mockLarkData';
import { fetchTableRecords } from './larkClient';
import type { LarkTables, TableKey } from './larkTypes';

const KEYS: TableKey[] = ['checkin', 'orders', 'master', 'dispatch', 'dsMaster'];

export async function fetchLarkData(
  cfg: LarkRuntimeConfig = toRuntimeConfig(),
  signal?: AbortSignal,
): Promise<LarkTables> {
  if (cfg.useMock) return mockLarkTables;

  const result: LarkTables = { checkin: [], orders: [], master: [], dispatch: [], dsMaster: [] };
  await Promise.all(
    KEYS.map(async (key) => {
      result[key] = await fetchTableRecords(cfg, key, signal);
    }),
  );
  return result;
}
