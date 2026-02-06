export const API_BASE = '/api/v1';
export const WS_BASE = `ws://${window.location.host}`;

export const STATUS_COLORS = {
  online: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  offline: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  maintenance: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
  unknown: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
} as const;

export const STATUS_LABELS: Record<string, string> = {
  online: '정상',
  warning: '경고',
  critical: '위험',
  offline: '오프라인',
  maintenance: '유지보수',
  unknown: '알 수 없음',
};

export const SEVERITY_COLORS = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-l-red-500' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-l-amber-500' },
  resolved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-l-emerald-500' },
  info: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-l-blue-500' },
} as const;

export const METRIC_LABELS: Record<string, string> = {
  cpu_usage_pct: 'CPU 사용률',
  mem_usage_pct: '메모리 사용률',
  disk_usage_pct: '디스크 사용률',
  collect_timeout: '수집 타임아웃',
  service_stopped: '서비스 중지',
};

export const TIME_RANGES = [
  { label: '1시간', value: '1h', hours: 1 },
  { label: '6시간', value: '6h', hours: 6 },
  { label: '24시간', value: '24h', hours: 24 },
  { label: '7일', value: '7d', hours: 168 },
  { label: '30일', value: '30d', hours: 720 },
] as const;

export const CHART_COLORS = {
  primary: '#6366F1',
  primaryFill: 'rgba(99, 102, 241, 0.1)',
  warning: '#F59E0B',
  danger: '#EF4444',
  success: '#10B981',
  grid: '#F3F4F6',
};
