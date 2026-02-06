import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../client';
import type { AppSetting } from '../../types';

// ── 설정 목록 조회 ──

export function useSettings(category?: string) {
  return useQuery<AppSetting[]>({
    queryKey: ['settings', category],
    queryFn: async () => {
      const { data } = await apiClient.get<{ settings: AppSetting[] }>('/settings', {
        params: category ? { category } : undefined,
      });
      return data.settings;
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
      // Backend expects { settings: { key: value, ... } } dict format
      const settingsDict: Record<string, string> = {};
      body.settings.forEach((s) => {
        settingsDict[s.key] = s.value;
      });
      const { data } = await apiClient.put('/settings', { settings: settingsDict });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
