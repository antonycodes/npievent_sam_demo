/**
 * useQueueBoardData — polling data source for the per-cluster queue-board
 * pages (/tuvanview, /kythuatview).
 *
 * Mirrors `useDashboardData`'s fetch/poll/mock lifecycle but maps through
 * `queueMapper` instead of `larkMapper` directly, and lives in its own file
 * on purpose so the main dashboard's hook is never touched.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ALL_POSITIONS } from '@/config/layoutConfig';
import { DEFAULT_FIELD_CONFIG, toRuntimeConfig, useLarkSettings } from '@/config/larkSettings';
import { mockLarkTables } from '@/data/mockLarkData';
import { fetchLarkData } from '@/services/larkService';
import { mapQueueStates, type DeskQueueState } from '@/services/queueMapper';
import type { ClusterKey } from '@/types/desk';

export interface UseQueueBoardDataResult {
  /** Chỉ các bàn thuộc `cluster` được yêu cầu, theo đúng thứ tự trong layoutConfig. */
  desks: DeskQueueState[];
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  isMock: boolean;
  refresh: () => void;
}

function emptyState(id: string, label: string, cluster: ClusterKey): DeskQueueState {
  return { id, label, cluster, staffName: null, current: [], next: [] };
}

export function useQueueBoardData(cluster: ClusterKey): UseQueueBoardDataResult {
  const settings = useLarkSettings();
  const cfg = useMemo(() => toRuntimeConfig(settings), [settings]);
  const isMock = cfg.useMock;
  const sig = useMemo(() => JSON.stringify(settings), [settings]);

  const [statesById, setStatesById] = useState<Record<string, DeskQueueState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    if (isMock) {
      setStatesById(mapQueueStates(mockLarkTables, DEFAULT_FIELD_CONFIG));
      setError(null);
      setLoading(false);
      setLastUpdated(new Date());
      return () => {
        cancelled = true;
      };
    }

    async function load(initial: boolean) {
      if (initial) setLoading(true);
      try {
        const tables = await fetchLarkData(cfg, controller.signal);
        if (cancelled) return;
        setStatesById(mapQueueStates(tables));
        setError(null);
        setLastUpdated(new Date());
      } catch (err) {
        if (cancelled || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    }

    void load(true);
    const timer = setInterval(() => void load(false), cfg.pollMs);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMock, sig, nonce]);

  const desks = ALL_POSITIONS.filter((p) => p.cluster === cluster).map(
    (p) => statesById[p.id] ?? emptyState(p.id, p.label, p.cluster),
  );

  return { desks, loading, error, lastUpdated, isMock, refresh };
}
