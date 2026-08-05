/**
 * QueueBoardPage — standalone "STT hiện tại / STT tiếp theo" display for one
 * cluster (Tư vấn hoặc Kỹ thuật), routed at #/tuvanview và #/kythuatview.
 *
 * Its own page/hook/component chain (QueueBoard + useQueueBoardData +
 * queueMapper) — DashboardPage/LayoutDashboard/useDashboardData (the main
 * dashboard) are never imported or modified here.
 */
import { CLUSTER_LABELS } from '@/config/layoutConfig';
import QueueBoard from '@/components/QueueBoard';
import { useQueueBoardData } from '@/hooks/useQueueBoardData';
import type { ClusterKey } from '@/types/desk';

export default function QueueBoardPage({ cluster }: { cluster: ClusterKey }) {
  const { desks, loading, error, lastUpdated, isMock, refresh } = useQueueBoardData(cluster);
  const title = CLUSTER_LABELS[cluster];

  return (
    <div className="min-h-full bg-neutral-100 text-neutral-800">
      <header className="border-b border-neutral-200 bg-white px-4 py-3 md:px-6 md:py-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div>
            <h1 className="text-lg font-bold md:text-xl">Màn hình STT · Khu vực {title}</h1>
            <p className="hidden text-sm text-neutral-500 md:block">
              STT đang phục vụ và STT tiếp theo của từng bàn — tự động cập nhật.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <a
              href="#/"
              className="flex min-h-8 items-center rounded border border-neutral-300 px-3 font-medium text-neutral-600 hover:bg-neutral-50"
            >
              ← Dashboard
            </a>
            <span
              className={[
                'rounded-full px-2 py-1 font-semibold',
                isMock ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700',
              ].join(' ')}
            >
              {isMock ? 'Mock data' : 'Lark Base (live)'}
            </span>
            {error ? (
              <span className="rounded-full bg-red-100 px-2 py-1 font-semibold text-red-700">Lỗi đồng bộ</span>
            ) : (
              <span className="text-neutral-500">
                {loading ? 'Đang tải…' : lastUpdated ? `Cập nhật: ${lastUpdated.toLocaleTimeString('vi-VN')}` : '—'}
              </span>
            )}
            <button
              type="button"
              onClick={refresh}
              className="min-h-8 rounded border border-neutral-300 px-3 font-medium text-neutral-600 hover:bg-neutral-50"
            >
              Làm mới
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-2 truncate text-xs text-red-600" title={error}>
            {error}
          </p>
        )}
      </header>

      <main className="px-3 py-4 md:px-6 md:py-6">
        <QueueBoard desks={desks} />
      </main>
    </div>
  );
}
