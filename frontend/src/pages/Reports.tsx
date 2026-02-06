import { useState } from 'react';
import {
  FileText,
  Download,
  Loader2,
  Server,
} from 'lucide-react';
import { useReports, useGenerateReport } from '../api/hooks/useReports';
import { useServers } from '../api/hooks/useServers';
import type { GenerateReportRequest } from '../api/hooks/useReports';
import { formatDateTime } from '../utils/format';
import { API_BASE } from '../utils/constants';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import DateRangePicker from '../components/ui/DateRangePicker';
import toast from '../components/ui/Toast';

const REPORT_TYPES = [
  { value: 'daily', label: '일간 리포트', description: '일별 서버 상태 요약' },
  { value: 'weekly', label: '주간 리포트', description: '주간 종합 분석 보고서' },
  { value: 'monthly', label: '월간 리포트', description: '월간 트렌드 및 용량 계획' },
  { value: 'custom', label: '커스텀 리포트', description: '기간/서버 지정 상세 보고서' },
];

export default function Reports() {
  const { data: reports, isLoading: reportsLoading } = useReports();
  const { data: serverData } = useServers({ size: 200 });
  const generateReport = useGenerateReport();

  // ── Form state ──
  const [reportName, setReportName] = useState('');
  const [reportType, setReportType] = useState('daily');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedServers, setSelectedServers] = useState<number[]>([]);

  const servers = serverData?.items ?? [];

  const toggleServer = (id: number) => {
    setSelectedServers((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const selectAllServers = () => {
    if (selectedServers.length === servers.length) {
      setSelectedServers([]);
    } else {
      setSelectedServers(servers.map((s) => s.server_id));
    }
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate) {
      toast.error('기간을 선택하세요.');
      return;
    }

    const body: GenerateReportRequest = {
      report_name: reportName || `${REPORT_TYPES.find((t) => t.value === reportType)?.label || '리포트'} - ${startDate.toLocaleDateString('ko-KR')}`,
      report_type: reportType,
      date_from: startDate.toISOString().split('T')[0],
      date_to: endDate.toISOString().split('T')[0],
      server_ids: selectedServers.length > 0 ? selectedServers : undefined,
    };

    try {
      await generateReport.mutateAsync(body);
      toast.success('리포트가 생성되었습니다.');
      setReportName('');
    } catch {
      toast.error('리포트 생성에 실패했습니다.');
    }
  };

  const handleDownload = (reportId: number) => {
    const token = localStorage.getItem('token');
    const url = `${API_BASE}/reports/${reportId}/download`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '');
    // Add auth header via fetch if needed; for now use simple link
    if (token) {
      fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          link.href = blobUrl;
          link.click();
          URL.revokeObjectURL(blobUrl);
        })
        .catch(() => toast.error('다운로드에 실패했습니다.'));
    } else {
      link.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <FileText size={22} className="text-indigo-600 dark:text-indigo-400" />
        리포트
      </h1>

      {/* ── Report Generation Form ── */}
      <Card>
        <CardHeader>
          <CardTitle>리포트 생성</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-5">
            {/* Report type selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">리포트 유형</label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {REPORT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setReportType(type.value)}
                    className={`text-left p-3 rounded-xl border-2 transition-all ${
                      reportType === type.value
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-600'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
                    }`}
                  >
                    <p className={`text-sm font-medium ${
                      reportType === type.value ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {type.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Date range and report name */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">기간 선택</label>
                <DateRangePicker
                  startDate={startDate}
                  endDate={endDate}
                  onChange={({ start, end }) => {
                    setStartDate(start);
                    setEndDate(end);
                  }}
                />
              </div>
              <div className="lg:col-span-2">
                <Input
                  label="리포트 이름 (선택)"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="비워두면 자동 생성"
                />
              </div>
            </div>

            {/* Server selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">대상 서버 (선택)</label>
                <button
                  onClick={selectAllServers}
                  className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 font-medium"
                >
                  {selectedServers.length === servers.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-3 bg-gray-50 rounded-lg border border-gray-200 dark:bg-gray-800/50 dark:border-gray-700">
                {servers.length === 0 ? (
                  <p className="text-xs text-gray-400">비워두면 전체 서버 대상</p>
                ) : (
                  servers.map((s) => (
                    <button
                      key={s.server_id}
                      onClick={() => toggleServer(s.server_id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        selectedServers.includes(s.server_id)
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Server size={12} />
                      {s.display_name}
                    </button>
                  ))
                )}
              </div>
              {selectedServers.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{selectedServers.length}개 서버 선택됨</p>
              )}
            </div>

            {/* Generate button */}
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="lg"
                icon={generateReport.isPending ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                onClick={handleGenerate}
                disabled={generateReport.isPending}
              >
                {generateReport.isPending ? '생성 중...' : '리포트 생성'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Report History ── */}
      <Card>
        <CardHeader>
          <CardTitle>리포트 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {reportsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : !reports || reports.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={36} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">생성된 리포트가 없습니다.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left dark:border-gray-700">
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">리포트명</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">유형</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">기간</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">크기</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">생성자</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">생성일</th>
                    <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">다운로드</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => {
                    const typeLabel = REPORT_TYPES.find((t) => t.value === report.report_type)?.label || report.report_type;
                    return (
                      <tr key={report.report_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{report.report_name}</td>
                        <td className="px-4 py-3">
                          <Badge color="indigo">{typeLabel}</Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">
                          {report.date_from} ~ {report.date_to}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 tabular-nums">
                          {report.file_size_kb > 1024
                            ? `${(report.file_size_kb / 1024).toFixed(1)} MB`
                            : `${report.file_size_kb} KB`}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{report.created_by}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{formatDateTime(report.created_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Download size={14} />}
                            onClick={() => handleDownload(report.report_id)}
                          >
                            다운로드
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
