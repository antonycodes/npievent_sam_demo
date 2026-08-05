/**
 * Lark Base (Bitable) wire-format types.
 *
 * The list-records endpoint returns
 *   { code, msg, data: { items: LarkRecord[], has_more, page_token, total } }
 * Each record has a `record_id` and a `fields` object keyed by the column's
 * display name. Cell values vary by field type — string, number, boolean, an
 * array of rich-text segments (formula/text fields, e.g. "Done in Flow" →
 * `[{text: "Tư vấn", type: "text"}]`), an array of bare strings (link/lookup
 * fields, no `.text` wrapper), OR an array of person objects (a "person"
 * field, e.g. "Người" → `[{id, name, email, avatar_url}]`, no `.text`, use
 * `.name`) — the mapper coerces all three shapes.
 */
export interface LarkTextSegment {
  text?: string;
  /** Person/link field (vd "Nhân viên") không có `.text` — dùng tên hiển thị này thay. */
  name?: string;
  type?: string;
}

export type LarkCellValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<LarkTextSegment | string>;

export interface LarkRecord {
  record_id: string;
  fields: Record<string, LarkCellValue>;
}

export interface LarkListResponse {
  code: number;
  msg: string;
  data: {
    items: LarkRecord[];
    has_more: boolean;
    page_token?: string;
    total: number;
  };
}

/**
 * The four logical tables the dashboard reads (2026-08-05, "no DS Master"
 * revision — `DS Master` turned out to be a personnel roster the app doesn't
 * need, not a per-desk registry):
 *   - `checkin` reads `Master_Check in` — customer identity + detail (STT,
 *     SP, ghi chú, nghiệm thu…), joined by name.
 *   - `master` reads `Master` — who's being served at which desk (`TV_MãNV`
 *     = desk code, `Trạng thái`, `Người` = staff) — the authoritative source
 *     for occupancy + staff name (see `larkMapper.ts`'s `indexMasterByDeskCode`).
 *   - `dispatch` reads `Master Điều phối` — customers assigned to a desk but
 *     not yet picked up (drives the per-desk waiting count).
 *   - `orders` reads "Danh sách đơn hàng" (total registered, for the funnel).
 */
export type TableKey = 'checkin' | 'orders' | 'master' | 'dispatch';

/** Raw records for every table, as returned by the service. */
export type LarkTables = Record<TableKey, LarkRecord[]>;
