import { useQuery } from '@tanstack/react-query';
import apiClient from '../client';
import type { HealthCheck } from '../../types';

// ── 헬스체크 목록 조회 ──

export function useHealthChecks(serverId: number | undefined) {
  return useQuery<HealthCheck[]>({
    queryKey: ['health-checks', serverId],
    queryFn: async () => {
      const { data } = await apiClient.get<HealthCheck[]>(
        `/servers/${serverId}/health-checks`,
      );
      return data;
    },
    enabled: !!serverId,
  });
}
