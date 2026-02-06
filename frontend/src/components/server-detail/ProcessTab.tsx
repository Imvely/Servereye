import React, { useState, useMemo, useCallback, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { Search, RefreshCw } from 'lucide-react';
import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import type { ProcessInfo } from '../../types';
import apiClient from '../../api/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatPercent, formatBytes } from '../../utils/format';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

interface ProcessTabProps {
  serverId: number;
}

/** 프로세스 목록 조회 훅 */
function useProcesses(serverId: number) {
  return useQuery<ProcessInfo[]>({
    queryKey: ['processes', serverId],
    queryFn: async () => {
      const { data } = await apiClient.get<ProcessInfo[]>(
        `/servers/${serverId}/processes`,
      );
      return data;
    },
    refetchInterval: 10000,
  });
}

/** CPU 사용률 셀 렌더러 */
const CpuCellRenderer: React.FC<ICellRendererParams> = ({ value }) => {
  const pct = value as number;
  const color = pct >= 80 ? 'text-red-600' : pct >= 50 ? 'text-amber-600' : 'text-gray-700';
  return <span className={`text-sm font-medium ${color}`}>{formatPercent(pct)}</span>;
};

/** 메모리 셀 렌더러 */
const MemCellRenderer: React.FC<ICellRendererParams> = ({ data }) => {
  const proc = data as ProcessInfo;
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-sm text-gray-700 dark:text-gray-300">{formatBytes(proc.mem_mb)}</span>
      <span className="text-[11px] text-gray-400">{formatPercent(proc.mem_pct)}</span>
    </div>
  );
};

/** 상태 셀 렌더러 */
const StatusCellRenderer: React.FC<ICellRendererParams> = ({ value }) => {
  const status = value as string;
  const colorMap: Record<string, string> = {
    running: 'bg-emerald-50 text-emerald-700',
    sleeping: 'bg-blue-50 text-blue-700',
    stopped: 'bg-red-50 text-red-700',
    zombie: 'bg-amber-50 text-amber-700',
  };
  const classes = colorMap[status?.toLowerCase()] || 'bg-gray-100 text-gray-600';

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {status}
    </span>
  );
};

const ProcessTab: React.FC<ProcessTabProps> = ({ serverId }) => {
  const gridRef = useRef<AgGridReact>(null);
  const queryClient = useQueryClient();
  const { data: processes, isLoading } = useProcesses(serverId);
  const [searchText, setSearchText] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filteredProcesses = useMemo(() => {
    if (!processes) return [];
    if (!searchText.trim()) return processes;
    const lower = searchText.toLowerCase();
    return processes.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.command_line.toLowerCase().includes(lower) ||
        String(p.pid).includes(lower),
    );
  }, [processes, searchText]);

  const columnDefs = useMemo<ColDef<ProcessInfo>[]>(
    () => [
      {
        headerName: 'PID',
        field: 'pid',
        width: 90,
        sortable: true,
        filter: true,
      },
      {
        headerName: '프로세스명',
        field: 'name',
        flex: 1,
        minWidth: 180,
        sortable: true,
        filter: true,
      },
      {
        headerName: '사용자',
        field: 'username',
        width: 120,
        sortable: true,
        filter: true,
      },
      {
        headerName: 'CPU %',
        field: 'cpu_pct',
        width: 100,
        sortable: true,
        sort: 'desc',
        cellRenderer: CpuCellRenderer,
      },
      {
        headerName: '메모리',
        field: 'mem_mb',
        width: 120,
        sortable: true,
        cellRenderer: MemCellRenderer,
      },
      {
        headerName: '스레드',
        field: 'thread_count',
        width: 90,
        sortable: true,
      },
      {
        headerName: '상태',
        field: 'status',
        width: 100,
        sortable: true,
        filter: true,
        cellRenderer: StatusCellRenderer,
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: true,
    }),
    [],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['processes', serverId] });
    setIsRefreshing(false);
  }, [queryClient, serverId]);

  return (
    <div className="space-y-4">
      {/* 상단 바 */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          프로세스 목록
          {processes && (
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
              ({filteredProcesses.length}개)
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="PID, 이름 검색..."
              className="h-8 w-48 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-8 pr-3 text-xs text-gray-700 dark:text-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
            title="새로고침"
          >
            <RefreshCw
              size={14}
              className={isRefreshing ? 'animate-spin' : ''}
            />
          </button>
        </div>
      </div>

      {/* AG Grid 테이블 */}
      <div className="ag-theme-alpine dark:ag-theme-alpine-dark rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: 520 }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw size={24} className="text-gray-400 animate-spin" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                프로세스 목록 로딩 중...
              </span>
            </div>
          </div>
        ) : (
          <AgGridReact<ProcessInfo>
            ref={gridRef}
            rowData={filteredProcesses}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            animateRows
            pagination
            paginationPageSize={50}
            getRowId={(params) => String(params.data.pid)}
            overlayNoRowsTemplate='<span class="text-sm text-gray-500">프로세스가 없습니다.</span>'
          />
        )}
      </div>
    </div>
  );
};

export default ProcessTab;
