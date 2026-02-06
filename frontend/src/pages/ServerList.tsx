import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Wifi,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { useServers, useCreateServer, useDeleteServer, useTestConnection } from '../api/hooks/useServers';
import type { ServerListParams } from '../api/hooks/useServers';
import type { CreateServerRequest } from '../types';
import { STATUS_LABELS } from '../utils/constants';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/common/StatusBadge';
import toast from '../components/ui/Toast';

const INITIAL_FORM: CreateServerRequest = {
  hostname: '',
  display_name: '',
  ip_address: '',
  domain: '',
  os_type: 'linux',
  credential_user: '',
  credential_pass: '',
  ssh_port: 22,
  winrm_port: 5985,
  use_ssl: false,
  group_name: '',
  location: '',
  description: '',
  tags: [],
};

const OS_OPTIONS = [
  { label: '전체 OS', value: '' },
  { label: 'Linux', value: 'linux' },
  { label: 'Windows', value: 'windows' },
];

const STATUS_OPTIONS = [
  { label: '전체 상태', value: '' },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ label, value })),
];

export default function ServerList() {
  // ── Filters & Pagination ──
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [osFilter, setOsFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [form, setForm] = useState<CreateServerRequest>({ ...INITIAL_FORM });
  const [tagInput, setTagInput] = useState('');

  const params: ServerListParams = useMemo(
    () => ({
      page,
      size: 20,
      search: searchQuery || undefined,
      group_name: groupFilter || undefined,
      status: statusFilter || undefined,
      os_type: osFilter || undefined,
    }),
    [page, searchQuery, groupFilter, statusFilter, osFilter],
  );

  const { data, isLoading } = useServers(params);
  const createServer = useCreateServer();
  const deleteServer = useDeleteServer();
  const testConnection = useTestConnection();

  const servers = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  // Unique groups from current data
  const groups = useMemo(
    () => [...new Set(servers.map((s) => s.group_name).filter(Boolean))].sort(),
    [servers],
  );

  // ── Selection ──
  const allSelected = servers.length > 0 && servers.every((s) => selected.has(s.server_id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(servers.map((s) => s.server_id)));
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  // ── Form helpers ──
  const updateForm = (patch: Partial<CreateServerRequest>) => setForm((prev) => ({ ...prev, ...patch }));

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags?.includes(tag)) {
      updateForm({ tags: [...(form.tags || []), tag] });
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    updateForm({ tags: (form.tags || []).filter((t) => t !== tag) });
  };

  // ── Submit ──
  const handleCreate = async () => {
    if (!form.hostname || !form.display_name || !form.ip_address || !form.credential_user || !form.credential_pass) {
      toast.error('필수 항목을 모두 입력하세요.');
      return;
    }
    try {
      await createServer.mutateAsync(form);
      toast.success('서버가 등록되었습니다.');
      setModalOpen(false);
      setForm({ ...INITIAL_FORM });
    } catch {
      toast.error('서버 등록에 실패했습니다.');
    }
  };

  // ── Connection test ──
  const handleTestConnection = async () => {
    if (!form.ip_address || !form.credential_user || !form.credential_pass) {
      toast.error('IP, 사용자명, 비밀번호를 입력 후 테스트하세요.');
      return;
    }
    try {
      const result = await testConnection.mutateAsync({
        ip_address: form.ip_address,
        os_type: form.os_type,
        credential_user: form.credential_user,
        credential_pass: form.credential_pass,
        ssh_port: form.ssh_port,
        winrm_port: form.winrm_port,
        use_ssl: form.use_ssl,
      });
      if (result.success) {
        toast.success(`연결 성공 (${result.latency_ms}ms)`);
      } else {
        toast.error(`연결 실패: ${result.message}`);
      }
    } catch {
      toast.error('연결 테스트 중 오류가 발생했습니다.');
    }
  };

  // ── Delete ──
  const handleDelete = async (id: number) => {
    try {
      await deleteServer.mutateAsync(id);
      toast.success('서버가 삭제되었습니다.');
      setDeleteConfirmId(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      toast.error('서버 삭제에 실패했습니다.');
    }
  };

  // ── Batch delete ──
  const handleBatchDelete = async () => {
    if (!confirm(`선택된 ${selected.size}개의 서버를 삭제하시겠습니까?`)) return;
    try {
      await Promise.all(Array.from(selected).map((id) => deleteServer.mutateAsync(id)));
      toast.success(`${selected.size}개의 서버가 삭제되었습니다.`);
      setSelected(new Set());
    } catch {
      toast.error('일부 서버 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">서버 관리</h1>
        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => {
            setForm({ ...INITIAL_FORM });
            setModalOpen(true);
          }}
        >
          서버 등록
        </Button>
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="서버명, IP 검색..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="h-9 w-full pl-9 pr-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:placeholder:text-gray-500"
          />
        </div>

        <select
          value={groupFilter}
          onChange={(e) => { setGroupFilter(e.target.value); setPage(1); }}
          className="h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
        >
          <option value="">전체 그룹</option>
          {groups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <select
          value={osFilter}
          onChange={(e) => { setOsFilter(e.target.value); setPage(1); }}
          className="h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
        >
          {OS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* ── Batch Actions ── */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2 dark:bg-indigo-900/20 dark:border-indigo-700">
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400">{selected.size}개 선택됨</span>
          <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={handleBatchDelete}>
            일괄 삭제
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            선택 해제
          </Button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl dark:bg-gray-800 dark:border-gray-700">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">등록된 서버가 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left dark:border-gray-700">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">서버명</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">IP</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">OS</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">그룹</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr
                  key={s.server_id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:hover:bg-gray-700/50"
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(s.server_id)}
                      onChange={() => toggleOne(s.server_id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{s.display_name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.ip_address}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 capitalize">{s.os_type}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{s.group_name || '-'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        icon={<Edit2 size={14} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Navigate to edit or open edit modal - placeholder
                          toast('수정 기능은 서버 상세 페이지에서 사용하세요.');
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        icon={<Trash2 size={14} className="text-red-500" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(s.server_id);
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            총 {total}개 중 {(page - 1) * 20 + 1}-{Math.min(page * 20, total)}
          </span>
          <div className="inline-flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              iconOnly
              icon={<ChevronLeft size={16} />}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            />
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`h-8 w-8 text-sm rounded-lg font-medium transition-colors ${
                    page === pageNum
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <Button
              variant="secondary"
              size="sm"
              iconOnly
              icon={<ChevronRight size={16} />}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      <Modal
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="서버 삭제"
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteServer.isPending}
            >
              {deleteServer.isPending ? '삭제 중...' : '삭제'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          이 서버를 삭제하시겠습니까? 관련된 메트릭, 알림 데이터가 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
        </p>
      </Modal>

      {/* ── Server Registration Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="서버 등록"
        maxWidth="xl"
        footer={
          <>
            <Button
              variant="secondary"
              icon={testConnection.isPending ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
              onClick={handleTestConnection}
              disabled={testConnection.isPending}
            >
              연결 테스트
            </Button>
            <div className="flex-1" />
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={createServer.isPending}
            >
              {createServer.isPending ? '등록 중...' : '등록'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="호스트명 *"
            value={form.hostname}
            onChange={(e) => updateForm({ hostname: e.target.value })}
            placeholder="server-01"
          />
          <Input
            label="표시 이름 *"
            value={form.display_name}
            onChange={(e) => updateForm({ display_name: e.target.value })}
            placeholder="웹서버 01"
          />
          <Input
            label="IP 주소 *"
            value={form.ip_address}
            onChange={(e) => updateForm({ ip_address: e.target.value })}
            placeholder="192.168.1.100"
          />
          <Input
            label="도메인"
            value={form.domain || ''}
            onChange={(e) => updateForm({ domain: e.target.value })}
            placeholder="server01.example.com"
          />
          <Select
            label="OS 유형 *"
            value={form.os_type}
            onChange={(e) => updateForm({ os_type: e.target.value as 'linux' | 'windows' })}
            options={[
              { label: 'Linux', value: 'linux' },
              { label: 'Windows', value: 'windows' },
            ]}
          />
          <Input
            label="그룹"
            value={form.group_name || ''}
            onChange={(e) => updateForm({ group_name: e.target.value })}
            placeholder="Production"
          />
          <Input
            label="접속 사용자 *"
            value={form.credential_user}
            onChange={(e) => updateForm({ credential_user: e.target.value })}
            placeholder="root"
          />
          <Input
            label="비밀번호 *"
            type="password"
            value={form.credential_pass}
            onChange={(e) => updateForm({ credential_pass: e.target.value })}
            placeholder="********"
          />
          <Input
            label={form.os_type === 'linux' ? 'SSH 포트' : 'WinRM 포트'}
            type="number"
            value={form.os_type === 'linux' ? form.ssh_port || 22 : form.winrm_port || 5985}
            onChange={(e) =>
              form.os_type === 'linux'
                ? updateForm({ ssh_port: Number(e.target.value) })
                : updateForm({ winrm_port: Number(e.target.value) })
            }
          />
          <Input
            label="위치"
            value={form.location || ''}
            onChange={(e) => updateForm({ location: e.target.value })}
            placeholder="IDC-1 Rack-A"
          />
          <div className="col-span-2">
            <Input
              label="설명"
              value={form.description || ''}
              onChange={(e) => updateForm({ description: e.target.value })}
              placeholder="서버 설명"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">태그</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {(form.tags || []).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-medium dark:bg-indigo-900/30 dark:text-indigo-300"
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-indigo-900 dark:hover:text-indigo-200">
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="태그 입력 후 Enter"
                className="h-9 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:placeholder:text-gray-500"
              />
              <Button variant="secondary" size="sm" onClick={addTag}>
                추가
              </Button>
            </div>
          </div>
          {form.os_type === 'windows' && (
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.use_ssl || false}
                onChange={(e) => updateForm({ use_ssl: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label className="text-sm text-gray-700 dark:text-gray-300">SSL 사용 (HTTPS)</label>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
