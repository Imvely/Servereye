import React from 'react';
import { Search, LayoutGrid, List, Filter } from 'lucide-react';
import { STATUS_LABELS } from '../../utils/constants';

interface FilterBarProps {
  statusFilter: string;
  onStatusChange: (v: string) => void;
  osFilter: string;
  onOsChange: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (v: 'grid' | 'list') => void;
}

const STATUS_OPTIONS = [
  { label: '전체 상태', value: '' },
  { label: STATUS_LABELS.online || '정상', value: 'online' },
  { label: STATUS_LABELS.warning || '경고', value: 'warning' },
  { label: STATUS_LABELS.critical || '위험', value: 'critical' },
  { label: STATUS_LABELS.offline || '오프라인', value: 'offline' },
  { label: STATUS_LABELS.maintenance || '유지보수', value: 'maintenance' },
];

const OS_OPTIONS = [
  { label: '전체 OS', value: '' },
  { label: 'Windows', value: 'windows' },
  { label: 'Linux', value: 'linux' },
];

const FilterBar: React.FC<FilterBarProps> = ({
  statusFilter,
  onStatusChange,
  osFilter,
  onOsChange,
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 px-4 py-3">
      {/* 필터 아이콘 */}
      <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 shrink-0">
        <Filter size={16} />
        <span className="text-xs font-medium hidden sm:inline">필터</span>
      </div>

      {/* 상태 필터 */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        className="h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 pr-8 text-sm text-gray-700 dark:text-gray-200 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%236B7280%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.293%207.293a1%201%200%20011.414%200L10%2010.586l3.293-3.293a1%201%200%20111.414%201.414l-4%204a1%201%200%2001-1.414%200l-4-4a1%201%200%20010-1.414z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[position:right_6px_center] bg-no-repeat focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 transition-colors"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* OS 필터 */}
      <select
        value={osFilter}
        onChange={(e) => onOsChange(e.target.value)}
        className="h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 pr-8 text-sm text-gray-700 dark:text-gray-200 appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%236B7280%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.293%207.293a1%201%200%20011.414%200L10%2010.586l3.293-3.293a1%201%200%20111.414%201.414l-4%204a1%201%200%2001-1.414%200l-4-4a1%201%200%20010-1.414z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[position:right_6px_center] bg-no-repeat focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 transition-colors"
      >
        {OS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* 검색 */}
      <div className="relative flex-1 min-w-[180px]">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="서버 이름 또는 IP로 검색..."
          className="h-9 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-9 pr-3 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 transition-colors"
        />
      </div>

      {/* 뷰 모드 토글 */}
      <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden shrink-0">
        <button
          type="button"
          onClick={() => onViewModeChange('grid')}
          className={`flex items-center justify-center w-9 h-9 transition-colors ${
            viewMode === 'grid'
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
          title="그리드 보기"
        >
          <LayoutGrid size={16} />
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('list')}
          className={`flex items-center justify-center w-9 h-9 transition-colors ${
            viewMode === 'list'
              ? 'bg-indigo-600 text-white'
              : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
          title="리스트 보기"
        >
          <List size={16} />
        </button>
      </div>
    </div>
  );
};

export default FilterBar;
