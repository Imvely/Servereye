import { useState } from 'react';
import {
  Plus,
  RotateCcw,
  Edit2,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import type { AlertRule } from '../types';
import { METRIC_LABELS } from '../utils/constants';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Toggle from '../components/ui/Toggle';
import Badge from '../components/ui/Badge';
import toast from '../components/ui/Toast';

// ── API hooks for alert rules ──
function useAlertRules() {
  return useQuery<AlertRule[]>({
    queryKey: ['alert-rules'],
    queryFn: async () => {
      const { data } = await apiClient.get<AlertRule[]>('/alert-rules');
      return data;
    },
  });
}

function useCreateAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<AlertRule>) => {
      const { data } = await apiClient.post<AlertRule>('/alert-rules', body);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  });
}

function useUpdateAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<AlertRule> }) => {
      const { data } = await apiClient.put<AlertRule>(`/alert-rules/${id}`, body);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  });
}

function useDeleteAlertRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/alert-rules/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  });
}

function useResetAlertRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/alert-rules/reset-defaults');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-rules'] }),
  });
}

// ── Form type ──
interface RuleForm {
  rule_name: string;
  description: string;
  server_id: string;
  group_name: string;
  metric_name: string;
  condition_op: string;
  warning_value: string;
  critical_value: string;
  duration_sec: string;
  cooldown_sec: string;
  is_enabled: boolean;
}

const EMPTY_FORM: RuleForm = {
  rule_name: '',
  description: '',
  server_id: '',
  group_name: '',
  metric_name: 'cpu_usage_pct',
  condition_op: '>=',
  warning_value: '70',
  critical_value: '90',
  duration_sec: '60',
  cooldown_sec: '300',
  is_enabled: true,
};

const METRIC_OPTIONS = [
  { label: 'CPU 사용률', value: 'cpu_usage_pct' },
  { label: '메모리 사용률', value: 'mem_usage_pct' },
  { label: '디스크 사용률', value: 'disk_usage_pct' },
  { label: '수집 타임아웃', value: 'collect_timeout' },
  { label: '서비스 중지', value: 'service_stopped' },
];

const CONDITION_OPTIONS = [
  { label: '>= (이상)', value: '>=' },
  { label: '> (초과)', value: '>' },
  { label: '<= (이하)', value: '<=' },
  { label: '< (미만)', value: '<' },
  { label: '== (같음)', value: '==' },
];

export default function AlertRules() {
  const { data: rules, isLoading } = useAlertRules();
  const createRule = useCreateAlertRule();
  const updateRule = useUpdateAlertRule();
  const deleteRule = useDeleteAlertRule();
  const resetRules = useResetAlertRules();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RuleForm>({ ...EMPTY_FORM });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const updateForm = (patch: Partial<RuleForm>) => setForm((prev) => ({ ...prev, ...patch }));

  const openCreate = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (rule: AlertRule) => {
    setForm({
      rule_name: rule.rule_name,
      description: rule.description || '',
      server_id: rule.server_id?.toString() || '',
      group_name: rule.group_name || '',
      metric_name: rule.metric_name,
      condition_op: rule.condition_op,
      warning_value: rule.warning_value?.toString() || '',
      critical_value: rule.critical_value?.toString() || '',
      duration_sec: rule.duration_sec.toString(),
      cooldown_sec: rule.cooldown_sec.toString(),
      is_enabled: rule.is_enabled,
    });
    setEditingId(rule.rule_id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.rule_name || !form.metric_name) {
      toast.error('규칙 이름과 메트릭을 입력하세요.');
      return;
    }

    const body: Partial<AlertRule> = {
      rule_name: form.rule_name,
      description: form.description || undefined,
      server_id: form.server_id ? Number(form.server_id) : undefined,
      group_name: form.group_name || undefined,
      metric_name: form.metric_name,
      condition_op: form.condition_op,
      warning_value: form.warning_value ? Number(form.warning_value) : undefined,
      critical_value: form.critical_value ? Number(form.critical_value) : undefined,
      duration_sec: Number(form.duration_sec) || 60,
      cooldown_sec: Number(form.cooldown_sec) || 300,
      is_enabled: form.is_enabled,
    };

    try {
      if (editingId) {
        await updateRule.mutateAsync({ id: editingId, body });
        toast.success('규칙이 수정되었습니다.');
      } else {
        await createRule.mutateAsync(body);
        toast.success('규칙이 추가되었습니다.');
      }
      setModalOpen(false);
    } catch {
      toast.error('규칙 저장에 실패했습니다.');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteRule.mutateAsync(id);
      toast.success('규칙이 삭제되었습니다.');
      setDeleteConfirmId(null);
    } catch {
      toast.error('규칙 삭제에 실패했습니다.');
    }
  };

  const handleToggle = async (rule: AlertRule) => {
    try {
      await updateRule.mutateAsync({
        id: rule.rule_id,
        body: { is_enabled: !rule.is_enabled },
      });
    } catch {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  const handleReset = async () => {
    if (!confirm('모든 규칙을 기본값으로 초기화하시겠습니까?')) return;
    try {
      await resetRules.mutateAsync();
      toast.success('기본값으로 초기화되었습니다.');
    } catch {
      toast.error('초기화에 실패했습니다.');
    }
  };

  const getTargetLabel = (rule: AlertRule): string => {
    if (rule.server_id) return `Server #${rule.server_id}`;
    if (rule.group_name) return rule.group_name;
    return '전체';
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">알림 규칙</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            icon={<RotateCcw size={14} />}
            onClick={handleReset}
            disabled={resetRules.isPending}
          >
            기본값 초기화
          </Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>
            규칙 추가
          </Button>
        </div>
      </div>

      {/* ── Rules Table ── */}
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : !rules || rules.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">등록된 규칙이 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-4 py-3 font-medium text-gray-500 w-10">#</th>
                <th className="px-4 py-3 font-medium text-gray-500">규칙명</th>
                <th className="px-4 py-3 font-medium text-gray-500">대상</th>
                <th className="px-4 py-3 font-medium text-gray-500">메트릭</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-center">경고</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-center">위험</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-center">지속(초)</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-center">활성</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, idx) => (
                <tr key={rule.rule_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{rule.rule_name}</p>
                    {rule.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{rule.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color="indigo">{getTargetLabel(rule)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {METRIC_LABELS[rule.metric_name] || rule.metric_name}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {rule.warning_value != null ? (
                      <span className="text-amber-600 font-medium">
                        {rule.condition_op} {rule.warning_value}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {rule.critical_value != null ? (
                      <span className="text-red-600 font-medium">
                        {rule.condition_op} {rule.critical_value}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-gray-600">{rule.duration_sec}s</td>
                  <td className="px-4 py-3 text-center">
                    <Toggle
                      enabled={rule.is_enabled}
                      onChange={() => handleToggle(rule)}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        icon={<Edit2 size={14} />}
                        onClick={() => openEdit(rule)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        icon={<Trash2 size={14} className="text-red-500" />}
                        onClick={() => setDeleteConfirmId(rule.rule_id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Delete Confirm Modal ── */}
      <Modal
        open={deleteConfirmId !== null}
        onClose={() => setDeleteConfirmId(null)}
        title="규칙 삭제"
        maxWidth="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirmId(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteRule.isPending}
            >
              {deleteRule.isPending ? '삭제 중...' : '삭제'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-gray-600">이 알림 규칙을 삭제하시겠습니까?</p>
      </Modal>

      {/* ── Create/Edit Modal ── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? '규칙 수정' : '규칙 추가'}
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={createRule.isPending || updateRule.isPending}
            >
              {createRule.isPending || updateRule.isPending ? '저장 중...' : '저장'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="규칙 이름 *"
              value={form.rule_name}
              onChange={(e) => updateForm({ rule_name: e.target.value })}
              placeholder="CPU 과부하 경고"
            />
            <Select
              label="메트릭 *"
              value={form.metric_name}
              onChange={(e) => updateForm({ metric_name: e.target.value })}
              options={METRIC_OPTIONS}
            />
          </div>

          <Input
            label="설명"
            value={form.description}
            onChange={(e) => updateForm({ description: e.target.value })}
            placeholder="규칙에 대한 설명"
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="대상 서버 ID"
              type="number"
              value={form.server_id}
              onChange={(e) => updateForm({ server_id: e.target.value })}
              placeholder="비워두면 전체"
              helperText="비워두면 전체 서버 적용"
            />
            <Input
              label="대상 그룹"
              value={form.group_name}
              onChange={(e) => updateForm({ group_name: e.target.value })}
              placeholder="비워두면 전체"
            />
            <Select
              label="조건"
              value={form.condition_op}
              onChange={(e) => updateForm({ condition_op: e.target.value })}
              options={CONDITION_OPTIONS}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="경고 임계값"
              type="number"
              value={form.warning_value}
              onChange={(e) => updateForm({ warning_value: e.target.value })}
              placeholder="70"
            />
            <Input
              label="위험 임계값"
              type="number"
              value={form.critical_value}
              onChange={(e) => updateForm({ critical_value: e.target.value })}
              placeholder="90"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="지속 시간 (초)"
              type="number"
              value={form.duration_sec}
              onChange={(e) => updateForm({ duration_sec: e.target.value })}
              placeholder="60"
              helperText="임계값 초과 상태가 지속되는 시간"
            />
            <Input
              label="쿨다운 (초)"
              type="number"
              value={form.cooldown_sec}
              onChange={(e) => updateForm({ cooldown_sec: e.target.value })}
              placeholder="300"
              helperText="알림 발생 후 재발생까지 대기"
            />
          </div>

          <div className="pt-2">
            <Toggle
              label="활성화"
              description="비활성화하면 이 규칙으로 알림이 발생하지 않습니다."
              enabled={form.is_enabled}
              onChange={(v) => updateForm({ is_enabled: v })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
