/**
 * layoutConfig — the 11 interactive positions mapped to board coordinates.
 *
 * Coordinates are percentages of a 16:9 board, redrawn from the new floor-plan
 * reference image (2026-07-30), extended on 2026-08-03 to add TV7/TV8:
 *   - Khu vực kỹ thuật (KT) : 3 staff in a row, top-center-left  → 3
 *   - Khu vực tư vấn (TV)   : 5 vertical pairs, across the bottom → 10
 *   - Khu vực Kỹ thuật có thêm node BK.X → 4
 * Tổng cộng = 14 node.
 */
import type { ClusterKey, TablePosition } from '@/types/desk';

/**
 * Desk-code prefix SHOWN ON SCREEN — the ops-facing IDs are KT1–KT3 (Kỹ
 * thuật), TV1–TV8 (Tư vấn). `normalizeDeskCode` accepts both KT and the
 * legacy Lark join codes TC for the kỹ thuật positions.
 */
export const CLUSTER_PREFIX: Record<ClusterKey, string> = {
  kythuat: 'KT',
  consult: 'TV',
};

/**
 * Desk-code prefix used as the LARK JOIN KEY. `kythuat` deliberately keeps the
 * old "TC" codes: the connected Lark base still has a "DS thu cũ" table with
 * "STT bàn" = TC1/TC2/TC3 and nobody has renamed it there yet — only the
 * on-screen label changes to "KT" (see types/desk.ts's `TablePosition` doc).
 * Once a real "DS Kỹ thuật" table exists, change this together with the Lark
 * table/field wiring in larkConfig.ts.
 */
const ID_PREFIX: Record<ClusterKey, string> = {
  kythuat: 'TC',
  consult: 'TV',
};

/**
 * Minimum spacing between two adjacent desk centers, in board percent.
 *
 * A node is `--node` tall (index.css: 5.5% of the board height) and its row of
 * STT dots hangs `node/2 + 2px + dot` ≈ 5.5% of the height below the center, so
 * two rows need ≈ 8.5% plus breathing room. Columns only have to clear the node
 * width plus a 2-dot row (≈ 3.5% of the height ≈ 2.5% of a 16:9 width), but are
 * kept well above that so a 3-dot row still fits between two neighbours.
 */
const MIN_ROW_PITCH = 11; // % of board height
const MIN_COL_PITCH = 6; // % of board width

/** Assert a coordinate axis leaves enough room for the node + dot marks. */
function assertPitch(cluster: ClusterKey, axis: 'x' | 'y', values: number[], min: number): void {
  const sorted = [...values].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap < min) {
      throw new Error(
        `layoutConfig: ${cluster} ${axis} spacing ${gap}% < ${min}% — desk nodes and ` +
          `their STT dots would overlap. Move the coordinates apart (or shrink --node).`,
      );
    }
  }
}

/** Assert spacing on the de-duplicated x/y values actually used by a cluster. */
function assertGridSpacing(cluster: ClusterKey, positions: TablePosition[]): void {
  assertPitch(cluster, 'x', [...new Set(positions.map((p) => p.x))], MIN_COL_PITCH);
  assertPitch(cluster, 'y', [...new Set(positions.map((p) => p.y))], MIN_ROW_PITCH);
}

/**
 * Build a grid of positions for one cluster (row-major: left→right within a
 * row, then top→bottom). Desk id/label = `${prefix}${n}` (1-based, unpadded).
 * @param cluster  cluster key (drives the id/label prefix)
 * @param xs       column center X positions (%)
 * @param ys       row center Y positions (%)
 */
function buildGrid(cluster: ClusterKey, xs: number[], ys: number[]): TablePosition[] {
  assertPitch(cluster, 'x', xs, MIN_COL_PITCH);
  assertPitch(cluster, 'y', ys, MIN_ROW_PITCH);
  const labelPrefix = CLUSTER_PREFIX[cluster];
  const idPrefix = ID_PREFIX[cluster];
  const out: TablePosition[] = [];
  let i = 0;
  for (const y of ys) {
    for (const x of xs) {
      i += 1;
      out.push({ id: `${idPrefix}${i}`, cluster, label: `${labelPrefix}${i}`, x, y });
    }
  }
  return out;
}

// ── Khu vực kỹ thuật (KT) — 3 nhân viên xếp hàng ngang, phía trên ───────────
// Chỉ 3 bàn nên vẫn dùng pitch rộng cũ — không cần khớp cột với Tư vấn bên
// dưới nữa (khu Tư vấn giờ có 4 cột, xem CONSULT_X). Đo trực tiếp trên trang
// chạy thật (getBoundingClientRect) để chọn pitch — không đoán qua mắt: 20%
// ngang đủ rộng cho cả node lẫn hàng chấm STT dưới nó.
// Gom 3 KT thành một cụm bên trái, chừa vùng rộng bên phải cho node BK.X.
const GROUP_X = [10, 22, 34];
export const KYTHUAT_POSITIONS: TablePosition[] = [
  ...buildGrid('kythuat', GROUP_X, [15]),
  { id: 'BK.X', cluster: 'kythuat', label: 'BK.X', x: 49, y: 15, capacity: 5 },
];

// ── Khu vực tư vấn (TV) — 5 cặp bàn xếp dọc (TV1/2 … TV9/10) ───────────────
// Năm cột được dàn đều trong khung trái, cột cuối vẫn chừa khoảng cách với
// khu chờ STT bên phải bắt đầu ở 64%.
// Numbering runs top→bottom WITHIN a group, then group-by-group left→right
// (matches the reference image) — not a plain row-major grid, so the
// positions are listed explicitly instead of through buildGrid. Row pitch 26%
// (đo thật: node cao ~4.7%, hàng chấm STT kéo dài thêm ~5.3% dưới tâm node) —
// đủ thoáng so với bản cũ (16%) nhưng không tạo khoảng trắng lớn giữa 2 hàng.
const CONSULT_X = [6, 18.5, 31, 43.5, 56];
export const CONSULT_POSITIONS: TablePosition[] = [
  { id: 'TV1', cluster: 'consult', label: 'TV1', x: CONSULT_X[0], y: 46 },
  { id: 'TV2', cluster: 'consult', label: 'TV2', x: CONSULT_X[0], y: 72 },
  { id: 'TV3', cluster: 'consult', label: 'TV3', x: CONSULT_X[1], y: 46 },
  { id: 'TV4', cluster: 'consult', label: 'TV4', x: CONSULT_X[1], y: 72 },
  { id: 'TV5', cluster: 'consult', label: 'TV5', x: CONSULT_X[2], y: 46 },
  { id: 'TV6', cluster: 'consult', label: 'TV6', x: CONSULT_X[2], y: 72 },
  { id: 'TV7', cluster: 'consult', label: 'TV7', x: CONSULT_X[3], y: 46 },
  { id: 'TV8', cluster: 'consult', label: 'TV8', x: CONSULT_X[3], y: 72 },
  { id: 'TV9', cluster: 'consult', label: 'TV9', x: CONSULT_X[4], y: 46 },
  { id: 'TV10', cluster: 'consult', label: 'TV10', x: CONSULT_X[4], y: 72 },
];
assertGridSpacing('consult', CONSULT_POSITIONS);

/** All 14 positions, flat: 4 Kỹ thuật/Backup + 10 Tư vấn. */
export const ALL_POSITIONS: TablePosition[] = [
  ...KYTHUAT_POSITIONS,
  ...CONSULT_POSITIONS,
];

/** Human-readable Vietnamese names per cluster, for legends/labels. */
export const CLUSTER_LABELS: Record<ClusterKey, string> = {
  kythuat: 'Kỹ thuật',
  consult: 'Tư vấn',
};

// Compile-time sanity: 4 Kỹ thuật/Backup + 10 Tư vấn.
if (KYTHUAT_POSITIONS.length !== 4 || CONSULT_POSITIONS.length !== 10) {
  throw new Error(
    `layoutConfig: expected 4/10 positions, got ` +
      `${KYTHUAT_POSITIONS.length}/${CONSULT_POSITIONS.length}`,
  );
}
