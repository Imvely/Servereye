import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../client';
import type { AppSetting } from '../../types';

// ── 설정 목록 조회 ──

export function useSettings(category?: string) {
  return useQuery<AppSetting[]>({
    queryKey: ['settings', category],
    queryFn: async () => {
      const { data } = await apiClient.get<AppSetting[]>('/settings', {
        params: category ? { category } : undefined,
      });
      return data;
    },
  });
}

// ── 설정 업데이트 ──

export interface UpdateSettingsRequest {
  settings: Array<{ key: string; value: string }>;
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: UpdateSettingsRequest) => {
      const { data } = await apiClient.put('/settings', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
