import { useState, useEffect, useMemo } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Loader2,
  Send,
  Globe,
  Database,
  Shield,
  Bell,
  Webhook,
} from 'lucide-react';
import { useSettings, useUpdateSettings } from '../api/hooks/useSettings';
import type { AppSetting } from '../types';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Toggle from '../components/ui/Toggle';
import Tabs from '../components/ui/Tabs';
import toast from '../components/ui/Toast';
import apiClient from '../api/client';

// Setting categories
const CATEGORIES = [
  { key: 'general', label: '일반', icon: <Globe size={15} /> },
  { key: 'collection', label: '수집', icon: <Database size={15} /> },
  { key: 'retention', label: '보존정책', icon: <Shield size={15} /> },
  { key: 'threshold', label: '기본임계치', icon: <Bell size={15} /> },
  { key: 'integration', label: '외부연동', icon: <Webhook size={15} /> },
];

export default function Settings() {
  const { data: allSettings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  // Local editable copy
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [webhookTestLoading, setWebhookTestLoading] = useState(false);

  // Initialize local values from fetched settings
  useEffect(() => {
    if (allSettings) {
      const values: Record<string, string> = {};
      allSettings.forEach((s) => {
        values[s.key] = s.value;
      });
      setEditedValues(values);
      setDirty(false);
    }
  }, [allSettings]);

  // Group settings by category
  const settingsByCategory = useMemo(() => {
    const map: Record<string, AppSetting[]> = {};
    (allSettings || []).forEach((s) => {
      if (!map[s.category]) map[s.category] = [];
      map[s.category].push(s);
    });
    return map;
  }, [allSettings]);

  const handleChange = (key: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!allSettings) return;

    // Collect changed settings
    const changes: Array<{ key: string; value: string }> = [];
    allSettings.forEach((s) => {
      if (editedValues[s.key] !== undefined && editedValues[s.key] !== s.value) {
        changes.push({ key: s.key, value: editedValues[s.key] });
      }
    });

    if (changes.length === 0) {
      toast('변경된 설정이 없습니다.');
      return;
    }

    try {
      await updateSettings.mutateAsync({ settings: changes });
      toast.success(`${changes.length}개 설정이 저장되었습니다.`);
      setDirty(false);
    } catch {
      toast.error('설정 저장에 실패했습니다.');
    }
  };

  const handleWebhookTest = async () => {
    const webhookUrl = editedValues['webhook_url'];
    if (!webhookUrl) {
      toast.error('Webhook URL을 입력하세요.');
      return;
    }
    setWebhookTestLoading(true);
    try {
      const { data } = await apiClient.post('/settings/webhook/test', { webhook_type: 'slack', url: webhookUrl });
      if (data.success) {
        toast.success('Webhook 테스트 성공!');
      } else {
        toast.error(`Webhook 테스트 실패: ${data.message || '알 수 없는 오류'}`);
      }
    } catch {
      toast.error('Webhook 테스트 중 오류가 발생했습니다.');
    } finally {
      setWebhookTestLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    );
  }

  // Render setting input based on value_type
  const renderSettingInput = (setting: AppSetting) => {
    const value = editedValues[setting.key] ?? setting.value;

    if (setting.value_type === 'boolean') {
      return (
        <Toggle
          label={setting.label}
          description={setting.description}
          enabled={value === 'true'}
          onChange={(v) => handleChange(setting.key, String(v))}
        />
      );
    }

    if (setting.value_type === 'number' || setting.value_type === 'integer') {
      return (
        <Input
          label={setting.label}
          type="number"
          value={value}
          onChange={(e) => handleChange(setting.key, e.target.value)}
          helperText={setting.description}
        />
      );
    }

    if (setting.value_type === 'password') {
      return (
        <Input
          label={setting.label}
          type="password"
          value={value}
          onChange={(e) => handleChange(setting.key, e.target.value)}
          helperText={setting.description}
        />
      );
    }

    // Default: text
    return (
      <Input
        label={setting.label}
        value={value}
        onChange={(e) => handleChange(setting.key, e.target.value)}
        helperText={setting.description}
      />
    );
  };

  const tabItems = CATEGORIES.map((cat) => ({
    label: cat.label,
    icon: cat.icon,
    content: (
      <div className="space-y-5">
        {(settingsByCategory[cat.key] || []).length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            이 카테고리에 설정 항목이 없습니다.
          </p>
        ) : (
          (settingsByCategory[cat.key] || []).map((setting) => (
            <div key={setting.key}>
              {renderSettingInput(setting)}
            </div>
          ))
        )}

        {/* Special: Webhook section in integration tab */}
        {cat.key === 'integration' && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Webhook 설정</h3>
            <div className="space-y-4">
              <Toggle
                label="Webhook 활성화"
                description="알림 발생시 외부 웹훅으로 알림을 전송합니다."
                enabled={(editedValues['webhook_enabled'] ?? 'false') === 'true'}
                onChange={(v) => handleChange('webhook_enabled', String(v))}
              />

              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Input
                    label="Webhook URL"
                    value={editedValues['webhook_url'] ?? ''}
                    onChange={(e) => handleChange('webhook_url', e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>
                <Button
                  variant="secondary"
                  icon={webhookTestLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  onClick={handleWebhookTest}
                  disabled={webhookTestLoading}
                  className="shrink-0"
                >
                  테스트
                </Button>
              </div>

              <Input
                label="Webhook Secret"
                type="password"
                value={editedValues['webhook_secret'] ?? ''}
                onChange={(e) => handleChange('webhook_secret', e.target.value)}
                placeholder="서명 검증용 시크릿"
                helperText="요청 서명 검증에 사용됩니다."
              />
            </div>
          </div>
        )}
      </div>
    ),
  }));

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <SettingsIcon size={22} className="text-indigo-600 dark:text-indigo-400" />
          설정
        </h1>
        <Button
          variant="primary"
          icon={updateSettings.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          onClick={handleSave}
          disabled={!dirty || updateSettings.isPending}
        >
          {updateSettings.isPending ? '저장 중...' : '저장'}
        </Button>
      </div>

      {/* ── Tabs ── */}
      <Card>
        <CardContent>
          <Tabs items={tabItems} />
        </CardContent>
      </Card>

      {/* Dirty indicator */}
      {dirty && (
        <div className="fixed bottom-6 right-6 z-40">
          <div className="flex items-center gap-3 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-lg shadow-indigo-200">
            <span className="text-sm font-medium">저장되지 않은 변경사항이 있습니다.</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSave}
              disabled={updateSettings.isPending}
              className="!bg-white !text-indigo-700"
            >
              저장
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
