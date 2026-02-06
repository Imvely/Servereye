import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../client';
import type { ActiveAlert, PaginatedResponse } from '../../types';

// ── 알림 목록 (필터/페이징) ──

export interface AlertListParams {
  page?: number;
  size?: number;
  severity?: string;
  acknowledged?: boolean;
  server_id?: number;
  from?: string;
  to?: string;
}

export function useAlerts(params?: AlertListParams) {
  return useQuery<PaginatedResponse<ActiveAlert>>({
    queryKey: ['alerts', params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<ActiveAlert>>(
        '/alerts',
        { params },
      );
      return data;
    },
  });
}

// ── 활성 알림 ──

export function useActiveAlerts() {
  return useQuery<ActiveAlert[]>({
    queryKey: ['alerts', 'active'],
    queryFn: async () => {
      const { data } = await apiClient.get<ActiveAlert[]>('/alerts/active');
      return data;
    },
    refetchInterval: 10000,
  });
}

// ── 알림 확인 처리 ──

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: number) => {
      const { data } = await apiClient.put(`/alerts/${alertId}/acknowledge`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

// ── 알림 해결 처리 ──

export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: number) => {
      const { data } = await apiClient.put(`/alerts/${alertId}/resolve`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}

// ── 전체 확인 처리 ──

export function useAcknowledgeAll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.put('/alerts/acknowledge-all');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
}
