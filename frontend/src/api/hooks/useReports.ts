import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../client';
import type { ReportHistory } from '../../types';

// ── 리포트 목록 조회 ──

export function useReports() {
  return useQuery<ReportHistory[]>({
    queryKey: ['reports'],
    queryFn: async () => {
      const { data } = await apiClient.get<{ items: ReportHistory[] }>('/reports');
      return data.items;
    },
  });
}

// ── 리포트 생성 ──

export interface GenerateReportRequest {
  report_name: string;
  report_type: string;
  date_from: string;
  date_to: string;
  server_ids?: number[];
}

export function useGenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: GenerateReportRequest) => {
      const { data } = await apiClient.post<ReportHistory>(
        '/reports/generate',
        body,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
}
