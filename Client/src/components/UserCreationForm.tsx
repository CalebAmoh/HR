import { useEffect, useState } from 'react';
import { User } from 'lucide-react';
import { FormModal } from './ui/FormModal';
import { Combobox } from './EmployeeTabs';
import api from '../../lib/api';

const PERMISSION_GROUPS = [
  {
    label: 'Users & Access',
    color: { active: '#2563eb', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    perms: ['view_users', 'create_users', 'edit_users', 'deactivate_users', 'activate_users', 'change_user_password'],
  },
  {
    label: 'Roles',
    color: { active: '#7c3aed', light: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
    perms: ['view_roles', 'create_roles', 'edit_roles', 'delete_roles', 'assign_roles', 'revoke_roles'],
  },
  {
    label: 'Permissions',
    color: { active: '#9333ea', light: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
    perms: ['view_permissions', 'assign_permissions', 'revoke_permissions'],
  },
  {
    label: 'Employees',
    color: { active: '#059669', light: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
    perms: ['view_employees', 'create_employees', 'edit_employees', 'approve_employees', 'change_employee_status'],
  },
  {
    label: 'Employee Relations',
    color: { active: '#0891b2', light: '#ecfeff', text: '#0e7490', border: '#a5f3fc' },
    perms: ['manage_skills', 'manage_certifications', 'manage_languages', 'manage_dependents', 'manage_emergency_contacts'],
  },
  {
    label: 'Company',
    color: { active: '#64748b', light: '#f8fafc', text: '#475569', border: '#cbd5e1' },
    perms: ['view_company_structure', 'create_company_structure', 'edit_company_structure', 'delete_company_structure'],
  },
  {
    label: 'Documents',
    color: { active: '#c2410c', light: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
    perms: ['view_documents', 'create_documents', 'edit_documents', 'delete_documents', 'download_documents'],
  },
  {
    label: 'Leave',
    color: { active: '#0d9488', light: '#f0fdfa', text: '#0f766e', border: '#99f6e4' },
    perms: ['view_leave', 'apply_leave', 'approve_leave', 'cancel_leave', 'view_subordinate_leave'],
  },
  {
    label: 'Leave Setup',
    color: { active: '#0f766e', light: '#f0fdfa', text: '#134e4a', border: '#99f6e4' },
    perms: ['view_leave_setup', 'manage_leave_types', 'manage_leave_periods', 'manage_holidays', 'manage_work_week', 'manage_leave_groups', 'manage_leave_rules'],
  },
  {
    label: 'Salary',
    color: { active: '#b45309', light: '#fefce8', text: '#92400e', border: '#fde68a' },
    perms: ['view_salary_setup', 'manage_salary_component_types', 'manage_salary_components', 'manage_employee_salary_components', 'manage_notch_setup', 'manage_payment_types', 'manage_notch_movements'],
  },
  {
    label: 'Payroll',
    color: { active: '#d97706', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    perms: ['view_payroll', 'manage_payroll_employees', 'process_payroll', 'approve_payroll', 'view_payroll_reports', 'export_payroll_reports', 'manage_payroll_columns', 'manage_calculation_groups'],
  },
  {
    label: 'Reports',
    color: { active: '#0284c7', light: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
    perms: ['view_reports', 'generate_reports', 'export_reports'],
  },
  {
    label: 'System',
    color: { active: '#475569', light: '#f8fafc', text: '#334155', border: '#e2e8f0' },
    perms: ['view_system', 'manage_app_setup', 'manage_code_lists', 'create_code_lists', 'edit_code_lists'],
  },
  {
    label: 'Settings',
    color: { active: '#e11d48', light: '#fff1f2', text: '#be123c', border: '#fecdd3' },
    perms: ['view_settings', 'edit_settings', 'manage_leave_settings', 'manage_notification_settings'],
  },
  {
    label: 'Audit',
    color: { active: '#374151', light: '#f9fafb', text: '#1f2937', border: '#d1d5db' },
    perms: ['view_audit_logs'],
  },
];

const fmtPerm = (p: string) =>
  p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const blank = (type: string) =>
  type === 'Users'
    ? { employeeId: '', employee: '', username: '', roleId: '', status: 'Active', directPermissions: [] }
    : { roleName: '', status: 'Active', permissions: [] };

export function UserCreationForm({ onClose, initialData, onSave, type, roles = [] }: any) {
  const [formData, setFormData] = useState<any>(() => initialData ?? blank(type));
  const [employees, setEmployees] = useState<any[]>([]);
  // Map of permission name → id from the database
  const [permMap, setPermMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (type === 'Users') {
      api.get('/employees/active').then((r) => setEmployees(r.data.data ?? [])).catch(() => {});
    }
    // Load permissions to get real IDs
    api.get('/permissions').then((r) => {
      const perms: any[] = r.data.data ?? [];
      const map: Record<string, string> = {};
      perms.forEach((p) => { map[p.name] = String(p.id); });
      setPermMap(map);
    }).catch(() => {});
  }, [type]);

  useEffect(() => {
    setFormData(initialData ?? blank(type));
  }, [initialData, type]);

  const empOpts = employees.map((e) => ({
    id: String(e.id),
    label: e.name + (e.employee_id ? ` (${e.employee_id})` : ''),
  }));

  const handleEmpChange = (id: string) => {
    const match = employees.find((e) => String(e.id) === id);
    setFormData((prev: any) => ({
      ...prev,
      employeeId: id,
      employee: match ? (match.name + (match.employee_id ? ` (${match.employee_id})` : '')) : '',
      username: match?.employee_id || prev.username,
    }));
  };

  const set = (key: string, val: any) =>
    setFormData((prev: any) => ({ ...prev, [key]: val }));

  const permKey = type === 'Users' ? 'directPermissions' : 'permissions';

  // Selected perms stored as permission names; on save, map to IDs
  const togglePerm = (perm: string) => {
    const list: string[] = formData[permKey] ?? [];
    set(permKey, list.includes(perm) ? list.filter((p) => p !== perm) : [...list, perm]);
  };

  const handleSave = () => {
    const data = { ...formData };
    if (type === 'Roles') {
      data.permissionsCount = (data.permissions ?? []).length;
      // Map perm names → IDs
      data.permissions = (data.permissions ?? []).map((n: string) => permMap[n] ?? n).filter(Boolean);
    } else {
      // Map direct permission names → IDs
      data.directPermissions = (data.directPermissions ?? []).map((n: string) => permMap[n] ?? n).filter(Boolean);
    }
    onSave(data);
    onClose();
  };

  // Display names of currently selected permissions
  const selectedPerms: string[] = formData[permKey] ?? [];

  return (
    <FormModal
      title={initialData ? `Edit ${type === 'Users' ? 'User' : 'Role'}` : `Add New ${type === 'Users' ? 'User' : 'Role'}`}
      subtitle={type === 'Users' ? 'Set up account access and direct permissions.' : 'Define role capabilities.'}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={`Save ${type === 'Users' ? 'User' : 'Role'}`}
      maxWidth="3xl"
      scrollable
    >
      {/* ── Account Details ───────────────────────────────── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-[var(--accent)] flex items-center justify-center shrink-0">
            <User size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {type === 'Users' ? 'Account Details' : 'Role Details'}
          </span>
        </div>

        {type === 'Users' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Employee */}
            <div className="sm:col-span-2">
              <label className="label">Employee <span className="text-[var(--danger)]">*</span></label>
              <Combobox
                options={empOpts}
                value={formData.employeeId ?? ''}
                onChange={handleEmpChange}
                placeholder="Select employee..."
              />
            </div>

            {/* Username */}
            <div>
              <label className="label">Username <span className="text-[var(--danger)]">*</span></label>
              <input
                type="text"
                value={formData.username ?? ''}
                onChange={(e: any) => set('username', e.target.value)}
                placeholder="Auto-filled from employee ID"
              />
            </div>

            {/* Role */}
            <div>
              <label className="label">Role</label>
              <select value={formData.roleId ?? ''} onChange={(e: any) => set('roleId', e.target.value)}>
                <option value="">Select role</option>
                {roles.map((r: any) => (
                  <option key={r.id} value={r.id}>{r.roleName ?? r.name}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="label">Status</label>
              <div className="flex gap-2 mt-1">
                {['Active', 'Inactive'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('status', s)}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold border transition-all"
                    style={formData.status === s
                      ? { background: s === 'Active' ? '#059669' : '#e11d48', color: '#fff', borderColor: 'transparent' }
                      : { background: 'transparent', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Role Name <span className="text-[var(--danger)]">*</span></label>
              <input
                type="text"
                value={formData.roleName ?? ''}
                onChange={(e: any) => set('roleName', e.target.value)}
                placeholder="e.g. HR Manager"
              />
            </div>
            <div>
              <label className="label">Status</label>
              <div className="flex gap-2 mt-1">
                {['Active', 'Inactive'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('status', s)}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold border transition-all"
                    style={formData.status === s
                      ? { background: s === 'Active' ? '#059669' : '#e11d48', color: '#fff', borderColor: 'transparent' }
                      : { background: 'transparent', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Direct Permissions ────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {type === 'Users' ? 'Direct Permissions' : 'Permissions'}
            </span>
            <span className="text-xs font-semibold" style={{ color: '#7c3aed' }}>
              ({selectedPerms.length} selected)
            </span>
          </div>
          <span className="text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border)] rounded-full px-3 py-1 bg-[var(--bg)]">
            {type === 'Users' ? 'Assigned directly to user' : 'Assigned to role'}
          </span>
        </div>

        <div className="border border-[var(--border)] rounded-xl overflow-hidden" style={{ maxHeight: 420, overflowY: 'auto' }}>
          {PERMISSION_GROUPS.map((group, gi) => {
            const groupCount = group.perms.filter(p => selectedPerms.includes(p)).length;
            const allSelected = groupCount === group.perms.length;

            const selectAll = () => {
              const next = allSelected
                ? selectedPerms.filter(p => !group.perms.includes(p))
                : [...new Set([...selectedPerms, ...group.perms])];
              set(permKey, next);
            };

            return (
              <div key={group.label} className={gi > 0 ? 'border-t border-[var(--border)]' : ''}>
                {/* Group header */}
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ backgroundColor: group.color.light }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: group.color.text }}>
                      {group.label}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: group.color.text, opacity: 0.75 }}>
                      {groupCount}/{group.perms.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="text-xs font-semibold transition-opacity hover:opacity-70"
                    style={{ color: group.color.active }}
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Chips */}
                <div className="p-3 flex flex-wrap gap-2 bg-[var(--surface)]">
                  {group.perms.map((perm) => {
                    const on = selectedPerms.includes(perm);
                    return (
                      <button
                        key={perm}
                        type="button"
                        onClick={() => togglePerm(perm)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all select-none"
                        style={on
                          ? { backgroundColor: group.color.light, borderColor: group.color.active, color: group.color.text }
                          : { backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-secondary)' }
                        }
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                          style={on
                            ? { borderColor: group.color.active, backgroundColor: group.color.active }
                            : { borderColor: '#cbd5e1', backgroundColor: 'transparent' }
                          }
                        >
                          {on && <span className="w-1.5 h-1.5 rounded-full bg-white block" />}
                        </span>
                        {fmtPerm(perm)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </FormModal>
  );
}
