import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../client';
import type {
  Server,
  ServerListResponse,
  CreateServerRequest,
} from '../../types';

// ── 서버 목록 조회 (필터/페이징) ──

export interface ServerListParams {
  page?: number;
  size?: number;
  status?: string;
  group_name?: string;
  os_type?: string;
  search?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export function useServers(params?: ServerListParams) {
  return useQuery<ServerListResponse>({
    queryKey: ['servers', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ServerListResponse>('/servers', {
        params,
      });
      return data;
    },
  });
}

// ── 서버 단건 조회 ──

export function useServer(id: number | undefined) {
  return useQuery<Server>({
    queryKey: ['servers', id],
    queryFn: async () => {
      const { data } = await apiClient.get<Server>(`/servers/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── 서버 생성 ──

export function useCreateServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateServerRequest) => {
      const { data } = await apiClient.post<Server>('/servers', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}

// ── 서버 수정 ──

export function useUpdateServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: number;
      body: Partial<CreateServerRequest>;
    }) => {
      const { data } = await apiClient.put<Server>(`/servers/${id}`, body);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
      queryClient.invalidateQueries({ queryKey: ['servers', variables.id] });
    },
  });
}

// ── 서버 삭제 ──

export function useDeleteServer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/servers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] });
    },
  });
}

// ── 연결 테스트 ──

export interface TestConnectionRequest {
  ip_address: string;
  os_type: 'windows' | 'linux';
  credential_user: string;
  credential_pass: string;
  ssh_port?: number;
  winrm_port?: number;
  use_ssl?: boolean;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  latency_ms?: number;
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async (body: TestConnectionRequest) => {
      const { data } = await apiClient.post<TestConnectionResponse>(
        '/servers/test-connection',
        body,
      );
      return data;
    },
  });
}
