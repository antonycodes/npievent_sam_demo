/**
 * QueueBoard — grid of "STT hiện tại / STT tiếp theo" cards for one cluster.
 *
 * Used only by the standalone queue-display pages (/tuvanview, /kythuatview).
 * Kept separate from LayoutDashboard/Desk (the coordinator's interactive
 * floor map) on purpose — this is a simpler, large-type view meant for a
 * monitor at each physical area, not the main dashboard.
 */
import type { DeskQueueState } from '@/services/queueMapper';

function DeskQueueCard({ desk }: { desk: DeskQueueState }) {
  const busy = desk.current.length > 0;
  const currentPrimary = desk.current[0]?.stt ?? null;
  const extraCurrent = desk.current.slice(1);
  const nextPrimary = desk.next[0]?.stt ?? null;
  const extraNextCount = desk.next.length - (desk.next.length > 0 ? 1 : 0);

  return (
    <div
      className={[
        'flex flex-col items-center gap-2 rounded-2xl border-2 bg-white p-4 shadow-sm',
        busy ? 'border-occupied/40' : 'border-vacant/40',
      ].join(' ')}
    >
      <div className="text-xl font-extrabold text-neutral-700">{desk.label}</div>

      <div className="flex flex-col items-center gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Đang phục vụ</span>
        <span className={`text-5xl font-black leading-none ${busy ? 'text-occupied' : 'text-neutral-300'}`}>
          {currentPrimary ?? '—'}
        </span>
        {extraCurrent.length > 0 && (
          <span className="text-xs text-neutral-500" title="Các khách khác đang được phục vụ cùng bàn">
            + {extraCurrent.map((c) => c.stt ?? '•').join(', ')}
          </span>
        )}
      </div>

      <div className="w-full border-t border-dashed border-neutral-200" />

      <div className="flex flex-col items-center gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-500">STT tiếp theo</span>
        <span className={`text-3xl font-bold leading-none ${nextPrimary ? 'text-amber-600' : 'text-neutral-300'}`}>
          {nextPrimary ?? '—'}
        </span>
        {extraNextCount > 0 && <span className="text-xs text-amber-600">+{extraNextCount} đang chờ</span>}
      </div>
    </div>
  );
}

export default function QueueBoard({ desks }: { desks: DeskQueueState[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {desks.map((d) => (
        <DeskQueueCard key={d.id} desk={d} />
      ))}
    </div>
  );
}
