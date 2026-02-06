import { useQuery } from '@tanstack/react-query';
import apiClient from '../client';
import type { MetricLatest, MetricHistory } from '../../types';

// ── 최신 메트릭 (5초 자동 갱신) ──

export function useLatestMetrics(serverId: number | undefined) {
  return useQuery<MetricLatest>({
    queryKey: ['metrics', 'latest', serverId],
    queryFn: async () => {
      const { data } = await apiClient.get<MetricLatest>(
        `/servers/${serverId}/metrics/latest`,
      );
      return data;
    },
    enabled: !!serverId,
    refetchInterval: 5000,
  });
}

// ── 메트릭 히스토리 ──

export interface MetricHistoryParams {
  range?: string;
  from?: string;
  to?: string;
  metric?: string;
}

export function useMetricHistory(
  serverId: number | undefined,
  params?: MetricHistoryParams,
) {
  return useQuery<MetricHistory[]>({
    queryKey: ['metrics', 'history', serverId, params],
    queryFn: async () => {
      const { data } = await apiClient.get<MetricHistory[]>(
        `/servers/${serverId}/metrics/history`,
        { params },
      );
      return data;
    },
    enabled: !!serverId,
  });
}
