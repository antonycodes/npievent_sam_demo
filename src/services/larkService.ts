/**
 * larkService — fetch every table the dashboard needs, in parallel.
 *
 * `fetchLarkData` returns the raw records for the 5 tables the app reads —
 * `dsTradein`/`dsConsult` (both `DS Master`, filtered by `Loại`), `checkin`
 * (`Master_Check in`), `orders` ("Danh sách đơn hàng"), `master` (`Master` —
 * who's being served at which desk). In mock mode it returns the bundled
 * fixtures instead of hitting the network.
 */
import type { LarkRuntimeConfig } from '@/config/larkConfig';
import { toRuntimeConfig } from '@/config/larkSettings';
import { mockLarkTables } from '@/data/mockLarkData';
import { fetchTableRecords } from './larkClient';
import type { LarkTables, TableKey } from './larkTypes';

const KEYS: TableKey[] = ['dsTradein', 'dsConsult', 'checkin', 'orders', 'master'];

export async function fetchLarkData(
  cfg: LarkRuntimeConfig = toRuntimeConfig(),
  signal?: AbortSignal,
): Promise<LarkTables> {
  if (cfg.useMock) return mockLarkTables;

  const result: LarkTables = { dsTradein: [], dsConsult: [], checkin: [], orders: [], master: [] };
  await Promise.all(
    KEYS.map(async (key) => {
      result[key] = await fetchTableRecords(cfg, key, signal);
    }),
  );
  return result;
}
