import { useState, useMemo, useEffect, useCallback } from 'react';
import { FileEdit, Trash2, Plus, KeyRound, ShieldOff, CheckCircle2, Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { ConfirmAlert } from './ConfirmAlert';
import { UserCreationForm } from './UserCreationForm';
import { PageHeader } from './ui/PageHeader';
import { TabBar } from './ui/TabBar';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';
import api from '../../lib/api';
import { toast } from 'sonner';

const TABS = ['Users', 'Roles', 'Permissions'];

const PERMISSION_GROUPS = [
  { label: 'Users & Access',      color: '#2563eb', perms: ['view_users','create_users','edit_users','deactivate_users','activate_users','change_user_password'] },
  { label: 'Roles',               color: '#7c3aed', perms: ['view_roles','create_roles','edit_roles','delete_roles','assign_roles','revoke_roles'] },
  { label: 'Permissions',         color: '#9333ea', perms: ['view_permissions','assign_permissions','revoke_permissions'] },
  { label: 'Employees',           color: '#059669', perms: ['view_employees','create_employees','edit_employees','approve_employees','change_employee_status'] },
  { label: 'Employee Relations',  color: '#0891b2', perms: ['manage_skills','manage_certifications','manage_languages','manage_dependents','manage_emergency_contacts'] },
  { label: 'Company',             color: '#64748b', perms: ['view_company_structure','create_company_structure','edit_company_structure','delete_company_structure'] },
  { label: 'Documents',           color: '#c2410c', perms: ['view_documents','create_documents','edit_documents','delete_documents','download_documents'] },
  { label: 'Leave',               color: '#0d9488', perms: ['view_leave','apply_leave','approve_leave','cancel_leave','view_subordinate_leave'] },
  { label: 'Leave Setup',         color: '#0f766e', perms: ['view_leave_setup','manage_leave_types','manage_leave_periods','manage_holidays','manage_work_week','manage_leave_groups','manage_leave_rules'] },
  { label: 'Salary',              color: '#b45309', perms: ['view_salary_setup','manage_salary_component_types','manage_salary_components','manage_employee_salary_components','manage_notch_setup','manage_payment_types','manage_notch_movements'] },
  { label: 'Payroll',             color: '#d97706', perms: ['view_payroll','manage_payroll_employees','process_payroll','approve_payroll','view_payroll_reports','export_payroll_reports','manage_payroll_columns','manage_calculation_groups'] },
  { label: 'Reports',             color: '#0284c7', perms: ['view_reports','generate_reports','export_reports'] },
  { label: 'System',              color: '#475569', perms: ['view_system','manage_app_setup','manage_code_lists','create_code_lists','edit_code_lists'] },
  { label: 'Settings',            color: '#e11d48', perms: ['view_settings','edit_settings','manage_leave_settings','manage_notification_settings'] },
  { label: 'Audit',               color: '#374151', perms: ['view_audit_logs'] },
];

const fmtPerm = (p: string) => p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function serialize(data: any): any {
  if (Array.isArray(data)) return data.map(serialize);
  if (data !== null && typeof data === 'object') {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, typeof v === 'bigint' ? String(v) : serialize(v)])
    );
  }
  return data;
}

function parseJsonField(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return []; }
  }
  return [];
}

export function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('Users');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  // Password reset modal state
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const r = await api.get('/users');
      const raw = r.data.data ?? [];
      setUsers(raw.map((u: any) => ({
        ...serialize(u),
        name: u.name || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
        directPermissions: parseJsonField(u.direct_permissions),
        roles: parseJsonField(u.roles),
      })));
    } catch (e) { console.error(e); }
  }, []);

  const loadRoles = useCallback(async () => {
    try {
      const r = await api.get('/roles');
      setRoles((r.data.data ?? []).map((role: any) => ({
        ...serialize(role),
        permissionsCount: (role.permissions ?? []).length,
      })));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { loadUsers(); loadRoles(); }, [loadUsers, loadRoles]);

  const filteredUsers = useMemo(
    () => users.filter((u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [users, searchQuery]
  );

  const filteredRoles = useMemo(
    () => roles.filter((r) => r.roleName?.toLowerCase().includes(searchQuery.toLowerCase()) || r.name?.toLowerCase().includes(searchQuery.toLowerCase())),
    [roles, searchQuery]
  );

  const handleAddClick = () => { setSelectedItem(null); setIsFormOpen(true); };
  const handleEditClick = (item: any) => {
    const firstRoleName = (item.roles ?? [])[0];
    const matchedRole = roles.find((r: any) => r.name === firstRoleName);
    setSelectedItem({ ...item, roleId: matchedRole ? String(matchedRole.id) : '' });
    setIsFormOpen(true);
  };
  const handleDeleteClick = (item: any) => { setSelectedItem(item); setIsAlertOpen(true); };

  const handleToggleStatus = async (item: any) => {
    if (activeTab === 'Users') {
      const next = item.status === '1' ? '0' : '1';
      try {
        await api.put(`/user/${item.id}/status`, { status: next });
        await loadUsers();
      } catch (e) { console.error(e); }
    } else {
      const next = item.status === '1' ? '0' : '1';
      try {
        await api.put(`/roles/${item.id}/status`, { status: next });
        await loadRoles();
      } catch (e) { console.error(e); }
    }
  };

  const handleResetPassword = (item: any) => {
    setPasswordTarget(item);
    setNewPassword('');
    setShowPassword(false);
    setPasswordError('');
    setPasswordModalOpen(true);
  };

  const handleConfirmPasswordReset = async () => {
    if (!passwordTarget) return;
    if (newPassword.trim() === '') {
      setPasswordError('Password cannot be empty');
      return;
    }
    if (newPassword.trim().length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    setPasswordLoading(true);
    setPasswordError('');
    try {
      const response = await api.put(`/${passwordTarget.id}/change-password`, { newPassword: newPassword.trim() });
      setPasswordModalOpen(false);
      setPasswordTarget(null);
      setNewPassword('');
    } catch (e: any) {
      console.error(e);
      setPasswordError(e.response?.data?.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSave = async (data: any) => {
    setLoading(true);
    try {
      if (activeTab === 'Users') {
        const payload = {
          employeeId:  data.employeeId,
          username:    data.username,
          status:      data.status === 'Active' ? '1' : '0',
          roles:       data.roleId ? [data.roleId] : [],
          permissions: data.directPermissions ?? [],
        };
        if (data.id) {
          await api.put(`/${data.id}`, payload);
        } else {
          await api.post('/user/register', payload);
        }
        toast.success(data.id ? 'User updated' : 'User created');
      } else {
        const payload = {
          roleName:    data.roleName,
          name:        data.roleName,
          status:      data.status === 'Active' ? '1' : '0',
          permissions: data.permissions ?? [],
        };
        if (data.id) {
          await api.put(`/roles/${data.id}`, payload);
        } else {
          await api.post('/roles', payload);
        }
        toast.success(data.id ? 'Role updated' : 'Role created');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Save failed');
      console.error(e);
    } finally {
      setLoading(false);
      // Always refresh regardless of success/failure so table is current
      if (activeTab === 'Users') loadUsers();
      else loadRoles();
      setIsFormOpen(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedItem) return;
    try {
      if (activeTab === 'Roles') {
        await api.delete(`/roles/${selectedItem.id}`);
        await loadRoles();
      } else {
        // Users: deactivate instead of hard delete
        await api.put(`/${selectedItem.id}/deactivate`);
        await loadUsers();
      }
    } catch (e) { console.error(e); }
    setIsAlertOpen(false);
    setSelectedItem(null);
  };

  const onTabChange = (tab: string) => { setActiveTab(tab); setSearchQuery(''); };

  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => { setPage(1); }, [activeTab, searchQuery]);

  const isUsers = activeTab === 'Users';
  const isPerms = activeTab === 'Permissions';
  const filtered = isUsers ? filteredUsers : filteredRoles;
  const total = isUsers ? users.length : roles.length;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Build a map of permissionName → [roleName, ...] for the Permissions tab
  const permRoleMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const role of roles) {
      const perms: any[] = role.permissions ?? [];
      for (const p of perms) {
        const name = typeof p === 'object' ? p.name : p;
        if (!map[name]) map[name] = [];
        map[name].push(role.roleName ?? role.name);
      }
    }
    return map;
  }, [roles]);

  return (
    <div className="p-4 sm:p-6 md:p-6 w-full max-w-[1400px] mx-auto overflow-x-hidden flex flex-col h-full relative">
      <PageHeader title="System Users & Roles" subtitle="Manage application access, mapping users to employees, and configuring role permissions." />

      <TabBar tabs={TABS} activeTab={activeTab} onChange={onTabChange} />

      {/* ── Permissions tab ─────────────────────────────────────────────── */}
      {isPerms ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col flex-1 max-h-min drop-shadow-sm">
          <TableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search permissions..."
          />
          <div className="overflow-y-auto flex-1 p-4 space-y-3">
            {PERMISSION_GROUPS.map((group) => {
              const visiblePerms = searchQuery
                ? group.perms.filter(p => p.toLowerCase().includes(searchQuery.toLowerCase()) || fmtPerm(p).toLowerCase().includes(searchQuery.toLowerCase()))
                : group.perms;
              if (visiblePerms.length === 0) return null;
              return (
                <div key={group.label} className="border border-[var(--border)] rounded-xl overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: group.color + '18' }}>
                    <ShieldCheck size={13} style={{ color: group.color }} />
                    <span className="text-[13px] font-bold" style={{ color: group.color }}>{group.label}</span>
                    <span className="text-[11px] font-semibold text-[var(--text-muted)] ml-1">{visiblePerms.length} permission{visiblePerms.length !== 1 ? 's' : ''}</span>
                  </div>
                  {/* Permission rows */}
                  <div className="divide-y divide-[var(--border)]">
                    {visiblePerms.map((perm, i) => {
                      const assignedRoles = permRoleMap[perm] ?? [];
                      return (
                        <motion.div
                          key={perm}
                          className="flex items-center justify-between px-4 py-2.5 bg-[var(--surface)] hover:bg-[var(--bg)] transition-colors"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                        >
                          <span className="text-[13px] font-medium text-[var(--text-primary)]">{fmtPerm(perm)}</span>
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {assignedRoles.length === 0 ? (
                              <span className="text-[11px] text-[var(--text-muted)] italic">No roles assigned</span>
                            ) : (
                              assignedRoles.map(role => (
                                <span key={role} className="pill text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                                  style={{ backgroundColor: group.color + '15', borderColor: group.color + '40', color: group.color }}>
                                  {role}
                                </span>
                              ))
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col flex-1 max-h-min drop-shadow-sm">
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={`Search ${activeTab.toLowerCase()}...`}
          actions={
            <button onClick={handleAddClick} className="primary-btn shrink-0">
              <span className="hidden sm:inline">Add {isUsers ? 'User' : 'Role'}</span>
              <span className="sm:hidden">Add</span>
              <Plus className="w-[14px] h-[14px]" />
            </button>
          }
        />

        <div className="overflow-x-auto flex-1">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {isUsers ? (
                  <>
                    <th scope="col" className="th">Employee</th>
                    <th scope="col" className="th">Username</th>
                    <th scope="col" className="th">Role</th>
                    <th scope="col" className="th">Status</th>
                    <th scope="col" className="th">Direct Permissions</th>
                  </>
                ) : (
                  <>
                    <th scope="col" className="th">Role Name</th>
                    <th scope="col" className="th">Status</th>
                    <th scope="col" className="th">Total Permissions</th>
                  </>
                )}
                <th scope="col" className="th text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {paged.length > 0 ? (
                paged.map((row: any, i) => (
                  <motion.tr key={row.id} className="tr group" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                    {isUsers ? (
                      <>
                        <td className="td font-medium text-[var(--text-primary)]">{row.name}</td>
                        <td className="td">{row.username}</td>
                        <td className="td">{row.roles?.join(', ') || '—'}</td>
                        <td className="td">
                          <span className={`pill ${row.status === '1' ? 'pill-success' : 'pill-danger'}`}>
                            {row.status === '1' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="td truncate max-w-[200px]">
                          {row.directPermissions?.length > 0 ? row.directPermissions.join(', ') : 'None'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="td font-medium text-[var(--text-primary)]">{row.roleName ?? row.name}</td>
                        <td className="td">
                          <span className={`pill ${row.status === '1' ? 'pill-success' : 'pill-danger'}`}>
                            {row.status === '1' ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="td">{row.permissionsCount} permissions granted</td>
                      </>
                    )}
                    <td className="td">
                      <div className="flex items-center justify-end gap-1">
                        {isUsers && (
                          <button onClick={() => handleResetPassword(row)} className="action-btn text-[var(--text-secondary)]" title="Trigger Password Change">
                            <KeyRound size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleStatus(row)}
                          className={`action-btn ${row.status === '1' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}
                          title={row.status === '1' ? 'Deactivate' : 'Activate'}
                        >
                          {row.status === '1' ? <ShieldOff size={14} /> : <CheckCircle2 size={14} />}
                        </button>
                        <button onClick={() => handleEditClick(row)} className="action-btn text-[var(--warning)]" title="Edit"><FileEdit size={14} /></button>
                        <button onClick={() => handleDeleteClick(row)} className="action-btn text-[var(--danger)]" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isUsers ? 6 : 4} className="td text-center py-10">
                    {loading ? 'Loading...' : filtered.length === 0 ? `No ${isUsers ? 'users' : 'roles'} found.` : 'No results on this page.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          total={total} filtered={filtered.length}
          page={page} pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>
      )}

      {isFormOpen && (
        <UserCreationForm
          onClose={() => setIsFormOpen(false)}
          initialData={selectedItem}
          onSave={handleSave}
          type={activeTab}
          roles={roles}
        />
      )}

      <ConfirmAlert
        isOpen={isAlertOpen}
        title={`${isUsers ? 'Deactivate User' : 'Delete Role'}`}
        message={isUsers
          ? 'Are you sure you want to deactivate this user? They will lose access immediately.'
          : 'Are you sure you want to delete this role? This action cannot be undone.'}
        confirmText={isUsers ? 'Yes, Deactivate' : 'Yes, Delete'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsAlertOpen(false)}
        variant="danger"
      />

      {/* ── Password Reset Modal ──────────────────────── */}
      {passwordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setPasswordModalOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-[var(--surface)] w-full max-w-md rounded-2xl shadow-xl z-10 flex flex-col border border-[var(--border)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-slate-50/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Lock size={18} className="text-amber-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 syne">Reset Password</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Set a new password for <span className="font-semibold text-slate-700">{passwordTarget?.username}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <label className="label">New Password <span className="text-[var(--danger)]">*</span></label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setPasswordError(''); }}
                  placeholder="Enter new password (min. 6 characters)"
                  className="w-full pr-10"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmPasswordReset()}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-[var(--danger)] mt-1.5 font-medium">{passwordError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[var(--border)] bg-slate-50/50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setPasswordModalOpen(false)} className="secondary-btn shadow-sm">
                Cancel
              </button>
              <button
                onClick={handleConfirmPasswordReset}
                disabled={passwordLoading}
                className="primary-btn shadow-sm flex items-center gap-2"
              >
                <KeyRound size={16} />
                {passwordLoading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
