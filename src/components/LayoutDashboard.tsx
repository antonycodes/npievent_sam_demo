/**
 * LayoutDashboard — the interactive floor-plan board.
 *
 * Renders a 16:9 stage mirroring the new KT/Tư vấn floor-plan reference: 2
 * dashed zone boxes (Khu vực kỹ thuật, Khu vực tư vấn) as a backdrop, plus the
 * 11 interactive desks (driven by the `desks` array), plus 2 STACKED waiting
 * boxes on the right — "Đã check-in" (top half, `waitingCheckin`) and "Chờ
 * điều phối" (bottom half, `waitingDispatch`) — split into 2 separate zones
 * per user feedback (2026-08-05; previously 1 merged box). Each only renders
 * dots for ACTUAL waiting customers, no empty placeholder slots (2026-08-05,
 * tiếp — reverses the 2026-07-31 "always show a fixed 24-slot grid" decision,
 * to match how desk rows already behave: see below). Each desk's own customer
 * row likewise only shows actual customers (no empty placeholder dots) — per
 * user feedback (2026-08-03), which removed the dashed empty-slot circles
 * that used to pad every Tư vấn desk row up to its capacity. "End Flow" (đã
 * hoàn tất toàn bộ) is a separate table view, not a board zone — see
 * EndFlowTable, opened from a button in FilterBar.
 */
import { DESK_CAPACITY, deskUiStatus, type DeskCustomer, type DeskData, type WaitingCustomer } from '@/types/desk';
import Desk from './Desk';

/** Khu vực chờ ngoài bàn (dùng để phân biệt khi bấm 1 chấm STT). */
export type WaitingZoneKey = 'checkin' | 'dispatch';

interface LayoutDashboardProps {
  desks: DeskData[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Bấm 1 chấm STT khách (deskId + vị trí trong receivedCustomers). */
  onSelectCustomer?: (deskId: string, index: number) => void;
  /** Chấm khách đang chọn (viền nổi bật). */
  selectedCustomer?: { deskId: string; index: number } | null;
  /** Đã check-in (có STT), chưa từng vào bàn nào — chờ điều phối lần đầu. */
  waitingCheckin?: WaitingCustomer[];
  /** Vừa hoàn tất 1 cụm, bàn đang rảnh — chờ điều phối sang cụm tiếp theo. */
  waitingDispatch?: WaitingCustomer[];
  /**
   * Bấm 1 chấm STT ở khu vực chờ (zone + vị trí trong mảng tương ứng), kèm
   * toạ độ board (%) của đúng ô vừa bấm — để popover neo tại đó thay vì 1
   * điểm cố định chung cho cả khu vực (giống cách các bàn/chấm khác đã làm).
   */
  onSelectWaiting?: (zone: WaitingZoneKey, index: number, anchor: { x: number; y: number }) => void;
  /** Chấm khách chờ đang chọn (viền nổi bật). */
  selectedWaiting?: { zone: WaitingZoneKey; index: number } | null;
  /** Ids to fade out (filtered) — dimmed and non-interactive. */
  dimmedIds?: Set<string>;
  /** Optional overlay (e.g. the popover) drawn on top of the board. */
  overlay?: React.ReactNode;
}

/** Khung nét đứt cho 1 khu vực lớn (Kỹ thuật/Tư vấn) — nhãn ghim mép trên, không che các node bên trong. */
function ZoneBox({ label, className }: { label: string; className: string }) {
  return (
    <div className={`absolute rounded-lg border border-dashed border-neutral-300 ${className}`}>
      <span className="absolute left-1/2 top-[2%] -translate-x-1/2 whitespace-nowrap text-[length:var(--label-fs)] font-bold uppercase leading-none tracking-wide text-neutral-400">
        {label}
      </span>
    </div>
  );
}

/**
 * 1 ô STT (cam, luôn có khách thật — không còn ô rỗng/viền chấm nào, xem
 * module doc). `size`/`fontSize` là giá trị CSS thật (vd `'var(--dot)'`)
 * truyền qua inline style — KHÔNG ghép vào class Tailwind, vì class dựng động
 * lúc runtime (`` `h-[${x}]` ``) không được Tailwind quét thấy lúc build nên
 * sẽ không sinh CSS tương ứng.
 */
function SttSlot({
  customer,
  active,
  onClick,
  size,
  fontSize,
}: {
  customer: DeskCustomer;
  active?: boolean;
  onClick?: () => void;
  size: string;
  fontSize: string;
}) {
  return (
    <button
      type="button"
      title={`${customer.stt ? `#${customer.stt} · ` : ''}${customer.name ?? ''}`}
      onClick={onClick}
      className={[
        'flex shrink-0 items-center justify-center rounded-full bg-amber-500 px-[2px] font-bold leading-none',
        'text-white shadow ring-1 ring-white transition hover:scale-125',
        active ? 'z-30 scale-125 ring-2 ring-blue-500 ring-offset-1' : '',
      ].join(' ')}
      style={{ height: size, width: size, fontSize }}
    >
      {customer.stt ?? '•'}
    </button>
  );
}

/** Số ô cố định trong MỖI khu chờ (Đã check-in / Chờ điều phối) — lưới 4 cột × 3 hàng. */
const WAITING_GRID_SIZE = 12;
const WAITING_GRID_COLS = 4;

/**
 * Toạ độ board (%) của từng ô trong 1 lưới chờ STT — tính tường minh (không
 * dùng CSS Grid tự chia) để mỗi ô có toạ độ THẬT, dùng làm điểm neo popup khi
 * bấm vào (giống cách mọi bàn/chấm khác đã làm — xem lịch sử 2026-07-31).
 * `x0`/`y0`/`xStep`/`yStep` truyền riêng cho từng khu (2 khu xếp chồng dọc).
 */
function buildWaitingGrid(x0: number, y0: number, xStep: number, yStep: number): Array<{ x: number; y: number }> {
  return Array.from({ length: WAITING_GRID_SIZE }, (_, i) => ({
    x: x0 + (i % WAITING_GRID_COLS) * xStep,
    y: y0 + Math.floor(i / WAITING_GRID_COLS) * yStep,
  }));
}

// Cột: giống hệt bản gộp cũ (đo thật 2026-07-31: cách đều 8.05% từ x=68.38%).
const WAITING_X0 = 68.38;
const WAITING_X_STEP = 8.05;

// 2 khu xếp CHỒNG DỌC trong cùng cột phải — đo thật bằng getBoundingClientRect
// sau khi dựng khung (xem memory.md): khung "Đã check-in" top-[3%] h-[44%],
// khung "Chờ điều phối" top-[49%] h-[46%] (đáy khớp đáy cột trái, giống bản
// gộp cũ kết thúc ở ~95%).
const CHECKIN_GRID_POSITIONS = buildWaitingGrid(WAITING_X0, 15.5, WAITING_X_STEP, 9.5);
const DISPATCH_GRID_POSITIONS = buildWaitingGrid(WAITING_X0, 61.5, WAITING_X_STEP, 9.5);

/** Khung nét đứt cho 1 khu chờ STT — chỉ nhãn + số đếm; các ô render riêng (board-relative). */
function WaitingZoneBox({ label, count, className }: { label: string; count: number; className: string }) {
  return (
    <div className={`absolute rounded-lg border border-dashed border-amber-300 bg-amber-50/60 ${className}`}>
      <div className="absolute left-1/2 top-[3%] flex -translate-x-1/2 items-center gap-1 whitespace-nowrap text-[length:var(--label-fs)] font-semibold uppercase leading-tight tracking-wide text-amber-700">
        <span>{label}</span>
        {count > 0 && (
          <span className="rounded-full bg-amber-200/80 px-1 leading-tight text-amber-800">{count}</span>
        )}
      </div>
    </div>
  );
}

/** 1 khu chờ hoàn chỉnh: khung + nhãn + lưới ô STT + tràn — dùng chung cho cả 2 khu (checkin/dispatch). */
function WaitingZoneGrid({
  zone,
  label,
  items,
  positions,
  boxClassName,
  selectedWaiting,
  onSelectWaiting,
}: {
  zone: WaitingZoneKey;
  label: string;
  items: WaitingCustomer[];
  positions: Array<{ x: number; y: number }>;
  boxClassName: string;
  selectedWaiting?: { zone: WaitingZoneKey; index: number } | null;
  onSelectWaiting?: (zone: WaitingZoneKey, index: number, anchor: { x: number; y: number }) => void;
}) {
  const hasOverflow = items.length > WAITING_GRID_SIZE;
  const slotCount = WAITING_GRID_SIZE - (hasOverflow ? 1 : 0);
  const shown = items.slice(0, slotCount);
  const overflow = items.length - shown.length;

  return (
    <>
      <WaitingZoneBox label={label} count={items.length} className={boxClassName} />
      {shown.map((customer, i) => {
        const pos = positions[i];
        const active = selectedWaiting?.zone === zone && selectedWaiting?.index === i;
        return (
          <div
            key={`wait-${zone}-${i}`}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <SttSlot
              customer={customer}
              active={active}
              onClick={() => onSelectWaiting?.(zone, i, pos)}
              size="var(--zone-dot)"
              fontSize="var(--zone-dot-fs)"
            />
          </div>
        );
      })}
      {hasOverflow && (
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${positions[slotCount].x}%`, top: `${positions[slotCount].y}%` }}
        >
          <span
            title={`Thêm ${overflow} khách`}
            className="flex h-[var(--zone-dot)] w-[var(--zone-dot)] shrink-0 items-center justify-center rounded-full bg-amber-700 px-[3px] text-[length:var(--zone-dot-fs)] font-bold leading-none text-white shadow ring-1 ring-white"
          >
            +{overflow}
          </span>
        </div>
      )}
    </>
  );
}

export default function LayoutDashboard({
  desks,
  selectedId,
  onSelect,
  onSelectCustomer,
  selectedCustomer,
  waitingCheckin = [],
  waitingDispatch = [],
  onSelectWaiting,
  selectedWaiting,
  dimmedIds,
  overlay,
}: LayoutDashboardProps) {
  return (
    <div className="board relative aspect-video w-full [@media(max-aspect-ratio:8/5)]:aspect-[2360/1640]">
      {/* Board visuals clip to the rounded card; popovers stay outside this
          layer (below) so they're never cut off near the board's edges. */}
      <div className="absolute inset-0 overflow-hidden rounded-xl border border-neutral-300 bg-neutral-50 shadow-inner">
        {/* ── Khu vực kỹ thuật (KT) — khung gọn theo đúng 1 hàng node, không để
            trống thừa phía dưới như bản trước (cao 39% cho có 1 hàng). ── */}
        <ZoneBox label="Khu vực kỹ thuật" className="left-[4%] top-[3%] h-[21%] w-[57%]" />

        {/* ── Khu vực tư vấn — cùng khung X với Kỹ thuật (thẳng hàng), đủ cao
            cho 2 hàng bàn + chấm STT dưới mỗi bàn mà không để trống lớn giữa
            2 hàng (toạ độ hàng đã đo thật, xem layoutConfig.ts). ── */}
        <ZoneBox label="Khu vực tư vấn" className="left-[4%] top-[28%] h-[67%] w-[57%]" />

        {/* ── 2 khu chờ STT xếp chồng dọc (thay 1 khu gộp cũ, 2026-08-05) ── */}
        <WaitingZoneGrid
          zone="checkin"
          label="Đã check-in"
          items={waitingCheckin}
          positions={CHECKIN_GRID_POSITIONS}
          boxClassName="left-[64%] top-[3%] h-[44%] w-[33%]"
          selectedWaiting={selectedWaiting}
          onSelectWaiting={onSelectWaiting}
        />
        <WaitingZoneGrid
          zone="dispatch"
          label="Chờ điều phối"
          items={waitingDispatch}
          positions={DISPATCH_GRID_POSITIONS}
          boxClassName="left-[64%] top-[49%] h-[46%] w-[33%]"
          selectedWaiting={selectedWaiting}
          onSelectWaiting={onSelectWaiting}
        />

        {/* ── Interactive desks (9) ─────────────────────────────────── */}
        {desks.map((d) => (
          <Desk
            key={d.id}
            id={d.id}
            label={d.label}
            status={deskUiStatus(d)}
            staffName={d.staffName}
            customerSTT={d.customerSTT}
            waiting={d.waiting}
            x={d.x}
            y={d.y}
            selected={selectedId === d.id}
            dimmed={dimmedIds?.has(d.id)}
            onClick={onSelect}
          />
        ))}

        {/* ── Ô STT khách đã tiếp nhận, ngay dưới mỗi bàn — bấm để xem khách ──
            Chỉ hiện khi có khách thật (không còn ô trống nét đứt điền chỗ
            tới DESK_CAPACITY — bỏ theo feedback 2026-08-03). Đặt cách node
            đúng `--dot-offset` nên không chồng lên nhãn bàn hay hàng bàn phía
            dưới. */}
        {desks.map((d) => {
          const list = d.receivedCustomers ?? [];
          if (list.length === 0) return null;

          const dim = dimmedIds?.has(d.id) ? 'pointer-events-none opacity-15' : '';
          const cap = DESK_CAPACITY[d.cluster];
          const slots = list.slice(0, cap);
          const overflow = list.length - slots.length;

          return (
            <div
              key={`dots-${d.id}`}
              className={`absolute z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-[var(--dot-gap)] ${dim}`}
              style={{ left: `${d.x}%`, top: `calc(${d.y}% + var(--dot-offset))` }}
            >
              {slots.map((c, i) => {
                const active = Boolean(c) && selectedCustomer?.deskId === d.id && selectedCustomer?.index === i;
                return (
                  <SttSlot
                    key={i}
                    customer={c}
                    active={active}
                    onClick={() => onSelectCustomer?.(d.id, i)}
                    size="var(--dot)"
                    fontSize="var(--dot-fs)"
                  />
                );
              })}
              {overflow > 0 && (
                <span
                  title={`Thêm ${overflow} khách — bấm vào bàn để xem đầy đủ`}
                  className="flex h-[var(--dot)] items-center justify-center rounded-full bg-amber-700 px-[3px] text-[length:var(--dot-fs)] font-bold leading-none text-white shadow ring-1 ring-white"
                >
                  +{overflow}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Overlay (popover) — outside the clipped layer above ────── */}
      {overlay}
    </div>
  );
}
