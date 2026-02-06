import { useState } from 'react';
import {
  Users as UsersIcon,
  Plus,
  Edit2,
  Loader2,
  UserCheck,
  UserX,
  Shield,
} from 'lucide-react';
import { useUsers, useCreateUser, useUpdateUser } from '../api/hooks/useUsers';
import type { CreateUserRequest, UpdateUserRequest } from '../api/hooks/useUsers';
import type { User } from '../types';
import { formatDateTime, formatRelative } from '../utils/format';
import { useAuthStore } from '../stores/authStore';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import toast from '../components/ui/Toast';

const ROLE_OPTIONS = [
  { label: '관리자', value: 'admin' },
  { label: '운영자', value: 'operator' },
  { label: '뷰어', value: 'viewer' },
];

const ROLE_COLORS: Record<string, 'indigo' | 'emerald' | 'gray' | 'violet'> = {
  admin: 'indigo',
  operator: 'emerald',
  viewer: 'gray',
};

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  operator: '운영자',
  viewer: '뷰어',
};

export default function Users() {
  const currentUser = useAuthStore((s) => s.user);
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  // ── Create modal state ──
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateUserRequest>({
    username: '',
    password: '',
    display_name: '',
    role: 'viewer',
  });

  // ── Edit modal state ──
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<UpdateUserRequest>({
    display_name: '',
    role: '',
    is_active: true,
    password: '',
  });

  // ── Handlers ──
  const handleCreate = async () => {
    if (!createForm.username || !createForm.password) {
      toast.error('아이디와 비밀번호를 입력하세요.');
      return;
    }
    try {
      await createUser.mutateAsync(createForm);
      toast.success('사용자가 생성되었습니다.');
      setCreateOpen(false);
      setCreateForm({ username: '', password: '', display_name: '', role: 'viewer' });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      toast.error(axiosErr.response?.data?.detail || '사용자 생성에 실패했습니다.');
    }
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditForm({
      display_name: user.display_name || '',
      role: user.role,
      is_active: user.is_active,
      password: '',
    });
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingUser) return;

    const body: UpdateUserRequest = {};
    if (editForm.display_name !== (editingUser.display_name || '')) {
      body.display_name = editForm.display_name;
    }
    if (editForm.role !== editingUser.role) {
      body.role = editForm.role;
    }
    if (editForm.is_active !== editingUser.is_active) {
      body.is_active = editForm.is_active;
    }
    if (editForm.password) {
      body.password = editForm.password;
    }

    if (Object.keys(body).length === 0) {
      toast('변경된 내용이 없습니다.');
      return;
    }

    try {
      await updateUser.mutateAsync({ id: editingUser.user_id, body });
      toast.success('사용자 정보가 수정되었습니다.');
      setEditOpen(false);
      setEditingUser(null);
    } catch {
      toast.error('사용자 수정에 실패했습니다.');
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await updateUser.mutateAsync({
        id: user.user_id,
        body: { is_active: !user.is_active },
      });
      toast.success(user.is_active ? '사용자가 비활성화되었습니다.' : '사용자가 활성화되었습니다.');
    } catch {
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <UsersIcon size={22} className="text-indigo-600" />
          사용자 관리
        </h1>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
          사용자 추가
        </Button>
      </div>

      {/* ── User Table ── */}
      <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : !users || users.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">등록된 사용자가 없습니다.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-4 py-3 font-medium text-gray-500">아이디</th>
                <th className="px-4 py-3 font-medium text-gray-500">이름</th>
                <th className="px-4 py-3 font-medium text-gray-500">역할</th>
                <th className="px-4 py-3 font-medium text-gray-500">상태</th>
                <th className="px-4 py-3 font-medium text-gray-500">마지막 로그인</th>
                <th className="px-4 py-3 font-medium text-gray-500">생성일</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = currentUser?.user_id === user.user_id;
                return (
                  <tr
                    key={user.user_id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                          {(user.display_name || user.username).charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900">
                          {user.username}
                          {isSelf && (
                            <span className="ml-1.5 text-xs text-indigo-500">(나)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.display_name || '-'}</td>
                    <td className="px-4 py-3">
                      <Badge color={ROLE_COLORS[user.role] || 'gray'}>
                        <Shield size={11} className="mr-1" />
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {user.is_active ? (
                        <Badge color="emerald">
                          <UserCheck size={11} className="mr-1" />
                          활성
                        </Badge>
                      ) : (
                        <Badge color="gray">
                          <UserX size={11} className="mr-1" />
                          비활성
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {user.last_login ? formatRelative(user.last_login) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatDateTime(user.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          iconOnly
                          icon={<Edit2 size={14} />}
                          onClick={() => openEdit(user)}
                        />
                        {!isSelf && (
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            icon={
                              user.is_active ? (
                                <UserX size={14} className="text-red-500" />
                              ) : (
                                <UserCheck size={14} className="text-emerald-500" />
                              )
                            }
                            onClick={() => handleToggleActive(user)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create User Modal ── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="사용자 추가"
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={createUser.isPending}
            >
              {createUser.isPending ? '생성 중...' : '생성'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="아이디 *"
            value={createForm.username}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))}
            placeholder="user01"
            autoFocus
          />
          <Input
            label="비밀번호 *"
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
            placeholder="8자 이상 입력"
          />
          <Input
            label="표시 이름"
            value={createForm.display_name || ''}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, display_name: e.target.value }))}
            placeholder="홍길동"
          />
          <Select
            label="역할"
            value={createForm.role}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value }))}
            options={ROLE_OPTIONS}
          />
        </div>
      </Modal>

      {/* ── Edit User Modal ── */}
      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditingUser(null); }}
        title="사용자 수정"
        maxWidth="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setEditOpen(false); setEditingUser(null); }}>
              취소
            </Button>
            <Button
              variant="primary"
              onClick={handleUpdate}
              disabled={updateUser.isPending}
            >
              {updateUser.isPending ? '저장 중...' : '저장'}
            </Button>
          </>
        }
      >
        {editingUser && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-sm text-gray-500">아이디</p>
              <p className="text-sm font-medium text-gray-900">{editingUser.username}</p>
            </div>

            <Input
              label="표시 이름"
              value={editForm.display_name || ''}
              onChange={(e) => setEditForm((prev) => ({ ...prev, display_name: e.target.value }))}
              placeholder="홍길동"
            />

            <Select
              label="역할"
              value={editForm.role || editingUser.role}
              onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
              options={ROLE_OPTIONS}
            />

            <Input
              label="새 비밀번호"
              type="password"
              value={editForm.password || ''}
              onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="변경하지 않으면 비워두세요"
              helperText="비밀번호를 변경하려면 입력하세요."
            />

            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-700">계정 활성화</p>
                <p className="text-xs text-gray-500">비활성화하면 로그인할 수 없습니다.</p>
              </div>
              <button
                onClick={() => setEditForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                  editForm.is_active ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition duration-200 ${
                    editForm.is_active ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
