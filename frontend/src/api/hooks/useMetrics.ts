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

function rangeToApiParams(range?: string): { from: string; interval: string } {
  const now = new Date();
  let hoursBack = 1;
  let interval = 'raw';

  switch (range) {
    case '6h':
      hoursBack = 6;
      interval = '5min';
      break;
    case '24h':
      hoursBack = 24;
      interval = '5min';
      break;
    case '7d':
      hoursBack = 168;
      interval = 'hourly';
      break;
    case '30d':
      hoursBack = 720;
      interval = 'hourly';
      break;
    default:
      hoursBack = 1;
      interval = 'raw';
  }

  const from = new Date(now.getTime() - hoursBack * 3600 * 1000).toISOString();
  return { from, interval };
}

export function useMetricHistory(
  serverId: number | undefined,
  params?: MetricHistoryParams,
) {
  return useQuery<MetricHistory[]>({
    queryKey: ['metrics', 'history', serverId, params],
    queryFn: async () => {
      const { from: rangeFrom, interval } = rangeToApiParams(params?.range);

      const apiParams: Record<string, string> = {
        from: params?.from || rangeFrom,
        interval,
      };
      if (params?.to) apiParams.to = params.to;

      const { data } = await apiClient.get<{ data: MetricHistory[] }>(
        `/servers/${serverId}/metrics/history`,
        { params: apiParams },
      );
      return data.data;
    },
    enabled: !!serverId,
  });
}
