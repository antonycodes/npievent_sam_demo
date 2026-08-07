/**
 * layoutConfig — the 11 interactive positions mapped to board coordinates.
 *
 * Coordinates are percentages of a 16:9 board, redrawn from the new floor-plan
 * reference image (2026-07-30), extended on 2026-08-03 to add TV7/TV8:
 *   - Khu vực kỹ thuật (KT) : 3 staff in a row, top-center-left  → 3
 *   - Khu vực tư vấn (TV)   : 4 vertical pairs, across the bottom → 8
 * "Bàn thu cũ" is replaced by "Kỹ thuật" and "Backup" no longer exists in
 * this floor plan. Total = 11.
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
const GROUP_X = [12, 32, 52];
export const KYTHUAT_POSITIONS = buildGrid('kythuat', GROUP_X, [15]);

// ── Khu vực tư vấn (TV) — 4 cặp bàn xếp dọc (tv1/2, tv3/4, tv5/6, tv7/8) ───
// Thêm TV7/TV8 (2026-08-03) → cần 1 cột thứ 4. Khung "Khu vực tư vấn" dừng ở
// 61% (left-4% + w-57%) và khu chờ STT bên phải bắt đầu ở 64%, nên 4 cột phải
// nén lại (8/24/40/56, pitch 16% — vẫn rộng hơn nhiều so với MIN_COL_PITCH
// 6%) thay vì giữ pitch 20% cũ (sẽ đẩy cột cuối chồng lên khu chờ STT).
// Numbering runs top→bottom WITHIN a group, then group-by-group left→right
// (matches the reference image) — not a plain row-major grid, so the
// positions are listed explicitly instead of through buildGrid. Row pitch 26%
// (đo thật: node cao ~4.7%, hàng chấm STT kéo dài thêm ~5.3% dưới tâm node) —
// đủ thoáng so với bản cũ (16%) nhưng không tạo khoảng trắng lớn giữa 2 hàng.
const CONSULT_X = [8, 24, 40, 56];
export const CONSULT_POSITIONS: TablePosition[] = [
  { id: 'TV1', cluster: 'consult', label: 'TV1', x: CONSULT_X[0], y: 46 },
  { id: 'TV2', cluster: 'consult', label: 'TV2', x: CONSULT_X[0], y: 72 },
  { id: 'TV3', cluster: 'consult', label: 'TV3', x: CONSULT_X[1], y: 46 },
  { id: 'TV4', cluster: 'consult', label: 'TV4', x: CONSULT_X[1], y: 72 },
  { id: 'TV5', cluster: 'consult', label: 'TV5', x: CONSULT_X[2], y: 46 },
  { id: 'TV6', cluster: 'consult', label: 'TV6', x: CONSULT_X[2], y: 72 },
  { id: 'TV7', cluster: 'consult', label: 'TV7', x: CONSULT_X[3], y: 46 },
  { id: 'TV8', cluster: 'consult', label: 'TV8', x: CONSULT_X[3], y: 72 },
];
assertGridSpacing('consult', CONSULT_POSITIONS);

/** All 9 positions, flat. */
export const ALL_POSITIONS: TablePosition[] = [
  ...KYTHUAT_POSITIONS,
  ...CONSULT_POSITIONS,
];

/** Human-readable Vietnamese names per cluster, for legends/labels. */
export const CLUSTER_LABELS: Record<ClusterKey, string> = {
  kythuat: 'Kỹ thuật',
  consult: 'Tư vấn',
};

// Compile-time sanity: the floor plan mandates exactly 11 positions (3/8).
if (KYTHUAT_POSITIONS.length !== 3 || CONSULT_POSITIONS.length !== 8) {
  throw new Error(
    `layoutConfig: expected 3/8 positions, got ` +
      `${KYTHUAT_POSITIONS.length}/${CONSULT_POSITIONS.length}`,
  );
}
