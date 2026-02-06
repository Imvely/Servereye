import React, { useState, useMemo } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import type { ServiceInfo } from '../../types';
import apiClient from '../../api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface ServiceTabProps {
  serverId: number;
}

/** 서비스 목록 조회 훅 */
function useServices(serverId: number) {
  return useQuery<ServiceInfo[]>({
    queryKey: ['services', serverId],
    queryFn: async () => {
      const { data } = await apiClient.get<ServiceInfo[]>(
        `/servers/${serverId}/services`,
      );
      return data;
    },
    refetchInterval: 15000,
  });
}

type StatusFilterType = '' | 'running' | 'stopped' | 'other';

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  running: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400' },
  stopped: { bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  paused: { bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
};

function getStatusBadge(status: string) {
  const lower = status.toLowerCase();
  return STATUS_BADGE[lower] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300' };
}

const ServiceTab: React.FC<ServiceTabProps> = ({ serverId }) => {
  const queryClient = useQueryClient();
  const { data: services, isLoading } = useServices(serverId);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredServices = useMemo(() => {
    if (!services) return [];

    let result = services;

    // 상태 필터
    if (statusFilter) {
      if (statusFilter === 'other') {
        result = result.filter(
          (s) =>
            s.status.toLowerCase() !== 'running' &&
            s.status.toLowerCase() !== 'stopped',
        );
      } else {
        result = result.filter(
          (s) => s.status.toLowerCase() === statusFilter,
        );
      }
    }

    // 검색 필터
    if (searchText.trim()) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (s) =>
          s.service_name.toLowerCase().includes(lower) ||
          s.display_name.toLowerCase().includes(lower),
      );
    }

    return result;
  }, [services, searchText, statusFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['services', serverId] });
    setIsRefreshing(false);
  };

  // 상태별 카운트
  const counts = useMemo(() => {
    if (!services) return { running: 0, stopped: 0, other: 0 };
    return services.reduce(
      (acc, s) => {
        const lower = s.status.toLowerCase();
        if (lower === 'running') acc.running++;
        else if (lower === 'stopped') acc.stopped++;
        else acc.other++;
        return acc;
      },
      { running: 0, stopped: 0, other: 0 },
    );
  }, [services]);

  return (
    <div className="space-y-4">
      {/* 상단 바 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          서비스 목록
          {services && (
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
              ({filteredServices.length}개)
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 상태 필터 버튼 */}
          <div className="flex items-center gap-1">
            {(
              [
                { key: '' as StatusFilterType, label: '전체' },
                { key: 'running' as StatusFilterType, label: `실행 중 (${counts.running})` },
                { key: 'stopped' as StatusFilterType, label: `중지 (${counts.stopped})` },
                { key: 'other' as StatusFilterType, label: `기타 (${counts.other})` },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setStatusFilter(item.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  statusFilter === item.key
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* 검색 */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="서비스 검색..."
              className="h-8 w-44 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-8 pr-3 text-xs text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>

          {/* 새로고침 */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={24} className="text-gray-400 animate-spin" />
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchText || statusFilter
                ? '조건에 맞는 서비스가 없습니다.'
                : '서비스 정보가 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    서비스 이름
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    표시 이름
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    시작 유형
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    PID
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    메모리
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredServices.map((service) => {
                  const badge = getStatusBadge(service.status);
                  return (
                    <tr
                      key={service.service_name}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-5 py-3 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                        {service.service_name}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">
                        {service.display_name}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
                        >
                          {service.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {service.start_type}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                        {service.pid ?? '-'}
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                        {service.mem_mb != null ? `${service.mem_mb.toFixed(1)} MB` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceTab;
