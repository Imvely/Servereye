import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../client';
import type { User } from '../../types';

// ── 사용자 목록 조회 ──

export function useUsers() {
  return useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await apiClient.get<User[]>('/users');
      return data;
    },
  });
}

// ── 사용자 생성 ──

export interface CreateUserRequest {
  username: string;
  password: string;
  display_name?: string;
  role: string;
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: CreateUserRequest) => {
      const { data } = await apiClient.post<User>('/users', body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// ── 사용자 수정 ──

export interface UpdateUserRequest {
  display_name?: string;
  role?: string;
  is_active?: boolean;
  password?: string;
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: number;
      body: UpdateUserRequest;
    }) => {
      const { data } = await apiClient.put<User>(`/users/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
