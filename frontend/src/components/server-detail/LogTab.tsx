import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, Pause, Play, RefreshCw, ChevronDown } from 'lucide-react';
import type { ServerLogEntry } from '../../types';
import apiClient from '../../api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDateTime } from '../../utils/format';

interface LogTabProps {
  serverId: number;
}

interface LogQueryParams {
  level?: string;
  from?: string;
  to?: string;
}

/** 로그 조회 훅 */
function useLogs(serverId: number, params?: LogQueryParams) {
  return useQuery<ServerLogEntry[]>({
    queryKey: ['logs', serverId, params],
    queryFn: async () => {
      const { data } = await apiClient.get<ServerLogEntry[]>(
        `/servers/${serverId}/logs`,
        { params },
      );
      return data;
    },
    refetchInterval: 5000,
  });
}

type LogLevel = '' | 'error' | 'warning' | 'info';

const LEVEL_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  error: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  warning: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  info: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  debug: { bg: 'bg-gray-50 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', dot: 'bg-gray-400' },
};

function getLevelColor(level: string) {
  return LEVEL_COLORS[level.toLowerCase()] || LEVEL_COLORS.debug;
}

const LogTab: React.FC<LogTabProps> = ({ serverId }) => {
  const queryClient = useQueryClient();
  const logContainerRef = useRef<HTMLDivElement>(null);

  const [levelFilter, setLevelFilter] = useState<LogLevel>('');
  const [searchText, setSearchText] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const queryParams: LogQueryParams = {};
  if (levelFilter) queryParams.level = levelFilter;
  if (dateFrom) queryParams.from = dateFrom;
  if (dateTo) queryParams.to = dateTo;

  const { data: logs, isLoading } = useLogs(serverId, queryParams);

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    if (!searchText.trim()) return logs;
    const lower = searchText.toLowerCase();
    return logs.filter(
      (log) =>
        log.message.toLowerCase().includes(lower) ||
        log.log_source.toLowerCase().includes(lower),
    );
  }, [logs, searchText]);

  // 자동 스크롤
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // 스크롤 이벤트 감지로 자동 스크롤 일시 중지
  const handleScroll = useCallback(() => {
    if (!logContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    }
  }, [autoScroll]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['logs', serverId] });
    setIsRefreshing(false);
  };

  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          서버 로그
          {logs && (
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
              ({filteredLogs.length}건)
            </span>
          )}
        </h3>

        <div className="flex items-center gap-2 flex-wrap">
          {/* 레벨 필터 */}
          <div className="flex items-center gap-1">
            {(
              [
                { key: '' as LogLevel, label: '전체' },
                { key: 'error' as LogLevel, label: 'Error' },
                { key: 'warning' as LogLevel, label: 'Warning' },
                { key: 'info' as LogLevel, label: 'Info' },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setLevelFilter(item.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  levelFilter === item.key
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* 날짜 범위 */}
          <input
            type="datetime-local"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            title="시작 날짜"
          />
          <span className="text-xs text-gray-400">~</span>
          <input
            type="datetime-local"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            title="종료 날짜"
          />

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
              placeholder="메시지 검색..."
              className="h-8 w-44 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-8 pr-3 text-xs text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>

          {/* 자동 스크롤 토글 */}
          <button
            type="button"
            onClick={() => setAutoScroll((prev) => !prev)}
            className={`inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border text-xs font-medium transition-colors ${
              autoScroll
                ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`}
            title={autoScroll ? '자동 스크롤 일시 중지' : '자동 스크롤 재개'}
          >
            {autoScroll ? <Pause size={12} /> : <Play size={12} />}
            <span className="hidden sm:inline">{autoScroll ? '자동 스크롤' : '일시 중지'}</span>
          </button>

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

      {/* 로그 리스트 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={24} className="text-gray-400 animate-spin" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {searchText || levelFilter || dateFrom || dateTo
                ? '조건에 맞는 로그가 없습니다.'
                : '로그 기록이 없습니다.'}
            </p>
          </div>
        ) : (
          <div
            ref={logContainerRef}
            onScroll={handleScroll}
            className="max-h-[600px] overflow-y-auto"
          >
            <table className="w-full text-left">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-44">
                    시간
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                    레벨
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                    소스
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    메시지
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 font-mono text-xs">
                {filteredLogs.map((log) => {
                  const levelColor = getLevelColor(log.log_level);
                  return (
                    <tr
                      key={log.id}
                      className={`${levelColor.bg} hover:opacity-80 transition-opacity`}
                    >
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                        {formatDateTime(log.occurred_at)}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center gap-1.5 font-semibold uppercase ${levelColor.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${levelColor.dot}`} />
                          {log.log_level}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-300 truncate max-w-[140px]">
                        {log.log_source}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-200 break-all">
                        {log.message}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* 하단으로 이동 버튼 (자동 스크롤 해제 시 표시) */}
            {!autoScroll && (
              <button
                type="button"
                onClick={() => {
                  setAutoScroll(true);
                  if (logContainerRef.current) {
                    logContainerRef.current.scrollTop =
                      logContainerRef.current.scrollHeight;
                  }
                }}
                className="sticky bottom-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-medium shadow-lg hover:bg-indigo-700 transition-colors"
              >
                <ChevronDown size={14} />
                최신 로그로 이동
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LogTab;
