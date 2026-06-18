import { useEffect, useMemo, useState } from 'react';
import { User, ShieldCheck } from 'lucide-react';
import { FormModal } from './ui/FormModal';
import { Combobox } from './EmployeeTabs';
import api from '../../lib/api';
import { toast } from 'sonner';

const PERMISSION_GROUPS = [
  {
    label: 'Users & Access',
    color: { active: '#2563eb', light: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
    perms: ['view_users', 'create_users', 'edit_users', 'deactivate_users', 'activate_users', 'change_user_password', 'manage_roles'],
  },
  {
    label: 'Employees',
    color: { active: '#059669', light: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
    perms: ['view_employees', 'create_employees', 'edit_employees', 'approve_employees', 'change_employee_status', 'manage_onboarding'],
  },
  {
    label: 'Employee Relations',
    color: { active: '#0891b2', light: '#ecfeff', text: '#0e7490', border: '#a5f3fc' },
    perms: ['manage_skills', 'manage_certifications', 'manage_education', 'manage_languages', 'manage_dependents', 'manage_emergency_contacts'],
  },
  {
    label: 'Company',
    color: { active: '#64748b', light: '#f8fafc', text: '#475569', border: '#cbd5e1' },
    perms: ['view_company_structure', 'create_company_structure', 'edit_company_structure', 'delete_company_structure'],
  },
  {
    label: 'Documents',
    color: { active: '#c2410c', light: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
    perms: ['view_documents', 'create_documents', 'edit_documents', 'delete_documents'],
  },
  {
    label: 'Leave Setup',
    color: { active: '#0f766e', light: '#f0fdfa', text: '#134e4a', border: '#99f6e4' },
    perms: ['view_leave_setup', 'manage_leave_types', 'manage_leave_periods', 'manage_holidays', 'manage_work_week', 'manage_leave_groups', 'manage_leave_rules', 'manage_leave_approvals'],
  },
  {
    label: 'Salary',
    color: { active: '#b45309', light: '#fefce8', text: '#92400e', border: '#fde68a' },
    perms: ['view_salary_setup', 'manage_salary_component_types', 'manage_salary_components', 'manage_employee_salary_components', 'manage_notch_setup', 'manage_payment_types', 'manage_notch_movements'],
  },
  {
    label: 'Payroll',
    color: { active: '#d97706', light: '#fffbeb', text: '#b45309', border: '#fde68a' },
    perms: ['view_payroll', 'manage_payroll_employees', 'process_payroll', 'approve_payroll', 'export_payroll_reports', 'manage_payroll_columns', 'manage_calculation_groups', 'manage_report_templates'],
  },
  {
    label: 'Reports',
    color: { active: '#0284c7', light: '#f0f9ff', text: '#0369a1', border: '#bae6fd' },
    perms: ['generate_reports', 'export_reports'],
  },
  {
    label: 'System',
    color: { active: '#475569', light: '#f8fafc', text: '#334155', border: '#e2e8f0' },
    perms: ['view_app_settings', 'manage_app_settings', 'view_settings', 'manage_settings', 'view_audit_logs'],
  },
  {
    label: 'Dashboard',
    color: { active: '#0d9488', light: '#f0fdfa', text: '#115e59', border: '#5eead4' },
    perms: ['view_dashboard'],
  },
  {
    label: 'Recruitment',
    color: { active: '#7c3aed', light: '#f5f3ff', text: '#5b21b6', border: '#c4b5fd' },
    perms: ['view_recruitment', 'manage_jobs', 'manage_candidates', 'manage_applications', 'manage_interviews'],
  },
  {
    label: 'Performance',
    color: { active: '#0891b2', light: '#ecfeff', text: '#155e75', border: '#67e8f9' },
    perms: ['view_performance', 'create_performance', 'delete_performance', 'review_performance'],
  },
  {
    label: 'Medical',
    color: { active: '#dc2626', light: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
    perms: ['view_medical', 'create_medical', 'edit_medical', 'delete_medical', 'approve_medical', 'manage_medical_limits', 'manage_hospitals'],
  },
  {
    label: 'Attendance',
    color: { active: '#0d9488', light: '#f0fdfa', text: '#115e59', border: '#5eead4' },
    perms: ['view_attendance', 'manage_attendance'],
  },
  {
    label: 'Training',
    color: { active: '#d97706', light: '#fffbeb', text: '#92400e', border: '#fcd34d' },
    perms: ['view_training', 'create_training', 'delete_training', 'approve_training'],
  },
];

const fmtPerm = (p: string) =>
  p.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const blank = (type: string) =>
  type === 'Users'
    ? { employeeId: '', employee: '', username: '', roleId: '', status: 'Active', directPermissions: [] }
    : { roleName: '', status: 'Active', permissions: [] };

export function UserCreationForm({ onClose, initialData, onSave, type, roles = [], users = [] }: any) {
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
    if (initialData) {
      const normalizedStatus = (initialData.status === '1' || initialData.status === 'Active') ? 'Active' : 'Inactive';
      if (type === 'Roles') {
        const normalizedPerms = (initialData.permissions ?? []).map((p: any) => typeof p === 'object' ? p.name : p);
        setFormData({
          ...initialData,
          roleName: initialData.roleName || initialData.name || '',
          status: normalizedStatus,
          permissions: normalizedPerms,
        });
      } else {
        setFormData({
          ...initialData,
          status: normalizedStatus,
        });
      }
    } else {
      setFormData(blank(type));
    }
  }, [initialData, type]);

  // Employees that already have a user account — exclude them from the picker so a second
  // account can't be created for the same person. Keep the employee linked to the user being
  // edited so it still shows in edit mode.
  const takenEmployeeIds = useMemo(() => {
    const editingEmpId = initialData?.employeeId != null ? String(initialData.employeeId) : null;
    return new Set(
      (users as any[])
        .map((u) => (u.employeeId != null ? String(u.employeeId) : null))
        .filter((id): id is string => !!id && id !== editingEmpId)
    );
  }, [users, initialData]);

  const empOpts = employees
    .filter((e) => !takenEmployeeIds.has(String(e.id)))
    .map((e) => ({
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

  // Compute which permissions are inherited from the selected role (Users mode only)
  const roleInheritedPerms: Set<string> = useMemo(() => {
    if (type !== 'Users' || !formData.roleId) return new Set<string>();
    const selectedRole = roles.find((r: any) => String(r.id) === String(formData.roleId));
    if (!selectedRole?.permissions) return new Set<string>();
    return new Set(
      selectedRole.permissions.map((p: any) => (typeof p === 'object' ? p.name : p))
    );
  }, [type, formData.roleId, roles]);

  // Selected perms stored as permission names; on save, map to IDs
  const togglePerm = (perm: string) => {
    // Don't toggle if it's an inherited (role) permission in Users mode
    if (type === 'Users' && roleInheritedPerms.has(perm)) return;
    const list: string[] = formData[permKey] ?? [];
    set(permKey, list.includes(perm) ? list.filter((p) => p !== perm) : [...list, perm]);
  };

  const handleSave = () => {
    if (type === 'Users' && !formData.roleId) {
      toast.error('Please select a role for this user');
      return;
    }
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
              <label className="label">Role <span className="text-[var(--danger)]">*</span></label>
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
              ({[...new Set([...selectedPerms, ...roleInheritedPerms])].length} selected)
            </span>
          </div>
          <span className="text-[11px] font-medium text-[var(--text-secondary)] border border-[var(--border)] rounded-full px-3 py-1 bg-[var(--bg)]">
            {type === 'Users' ? 'Assigned directly to user' : 'Assigned to role'}
          </span>
        </div>

        <div className="border border-[var(--border)] rounded-xl overflow-hidden" style={{ maxHeight: 420, overflowY: 'auto' }}>
          {PERMISSION_GROUPS.map((group, gi) => {
            const groupCount = group.perms.filter(p => selectedPerms.includes(p) || roleInheritedPerms.has(p)).length;
            const allSelected = groupCount === group.perms.length;

            const selectAll = () => {
              // Only operate on non-inherited perms in this group
              const nonInherited = group.perms.filter(p => !roleInheritedPerms.has(p));
              const directInGroup = nonInherited.filter(p => selectedPerms.includes(p));
              const allDirectSelected = directInGroup.length === nonInherited.length;
              const next = allDirectSelected
                ? selectedPerms.filter(p => !nonInherited.includes(p))
                : [...new Set([...selectedPerms, ...nonInherited])];
              set(permKey, next);
            };

            return (
              <div key={group.label} className={gi > 0 ? 'border-t border-[var(--border)]' : ''}>
                {/* Group header */}
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ backgroundColor: `color-mix(in srgb, ${group.color.active} 14%, transparent)` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: group.color.active }}>
                      {group.label}
                    </span>
                    <span className="text-xs font-semibold" style={{ color: group.color.active, opacity: 0.75 }}>
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
                    const inherited = type === 'Users' && roleInheritedPerms.has(perm);
                    const on = selectedPerms.includes(perm) || inherited;
                    return (
                      <button
                        key={perm}
                        type="button"
                        onClick={() => togglePerm(perm)}
                        disabled={inherited}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all select-none"
                        style={inherited
                          ? { backgroundColor: `color-mix(in srgb, ${group.color.active} 14%, transparent)`, borderColor: group.color.active, color: group.color.active, opacity: 0.85, cursor: 'default' }
                          : on
                            ? { backgroundColor: `color-mix(in srgb, ${group.color.active} 14%, transparent)`, borderColor: group.color.active, color: group.color.active }
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
                        {inherited && (
                          <span className="flex items-center gap-0.5 ml-0.5 text-[10px] font-semibold" style={{ color: group.color.active }}>
                            <ShieldCheck size={10} /> Role
                          </span>
                        )}
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
