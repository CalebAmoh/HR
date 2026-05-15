import React, { useEffect, useState } from 'react';
import { FormModal } from './ui/FormModal';
import { FormField, inputClass } from './ui/FormField';

const PERMISSION_GROUPS = {
  'Leave Management': ['Process Leave', 'Approve Leave', 'View All Leaves'],
  'Payroll & Salary': ['Run Payroll', 'View Payroll', 'Edit Salary Notches'],
  'System Administration': ['Manage Modules', 'View Audit Logs', 'System Settings'],
  'Employees': ['Add Employee', 'Edit Employee', 'View Employees'],
};

export function UserCreationForm({ onClose, initialData, onSave, type }: any) {
  const [formData, setFormData] = useState<any>({ status: 'Active', directPermissions: [], permissions: [] });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData(
        type === 'Users'
          ? { employee: '', username: '', status: 'Active', directPermissions: [] }
          : { roleName: '', status: 'Active', permissions: [], permissionsCount: 0 }
      );
    }
  }, [initialData, type]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData((prev: any) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const togglePermission = (perm: string, isDirect = false) => {
    const key = isDirect ? 'directPermissions' : 'permissions';
    const list: string[] = formData[key] ?? [];
    setFormData((prev: any) => ({
      ...prev,
      [key]: list.includes(perm) ? list.filter((p: string) => p !== perm) : [...list, perm],
    }));
  };

  const handleSave = () => {
    const data = { ...formData };
    if (type === 'Roles') data.permissionsCount = (data.permissions ?? []).length;
    onSave(data);
    onClose();
  };

  const permKey = type === 'Users' ? 'directPermissions' : 'permissions';

  return (
    <FormModal
      title={initialData ? `Edit ${type === 'Users' ? 'User' : 'Role'}` : `Add New ${type === 'Users' ? 'User' : 'Role'}`}
      subtitle={type === 'Users' ? 'Select an employee and proceed to create account.' : 'Define role capabilities.'}
      onClose={onClose}
      onSave={handleSave}
      saveLabel={`Save ${type === 'Users' ? 'User' : 'Role'}`}
    >
      <div className="grid grid-cols-1 gap-5">
        {type === 'Users' ? (
          <>
            <FormField label="Employee" className="sm:col-span-2">
              <select name="employee" value={formData.employee ?? ''} onChange={handleChange} className={inputClass}>
                <option value="">Select Employee</option>
                <option value="UNION ADMIN">UNION ADMIN</option>
                <option value="SAMUEL BANDOH">SAMUEL BANDOH</option>
                <option value="SARAH JENKS">SARAH JENKS</option>
                <option value="MICHAEL CHEN">MICHAEL CHEN</option>
              </select>
            </FormField>

            <FormField label="Username" className="sm:col-span-2">
              <input type="text" name="username" value={formData.username ?? ''} onChange={handleChange} className={inputClass} placeholder="e.g. mchen" />
            </FormField>
          </>
        ) : (
          <FormField label="Role Name">
            <input type="text" name="roleName" value={formData.roleName ?? ''} onChange={handleChange} className={inputClass} placeholder="e.g. HR Manager" />
          </FormField>
        )}

        <div className="border border-[var(--border)] rounded-xl p-4 bg-white/50">
          <h4 className="font-bold text-sm mb-3">Permissions</h4>
          <div className="space-y-4">
            {Object.entries(PERMISSION_GROUPS).map(([group, perms]) => (
              <div key={group}>
                <div className="text-xs font-semibold text-[var(--text-muted)] uppercase mb-2">{group}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {perms.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-[13px] cursor-pointer hover:bg-slate-50 p-1.5 rounded -ml-1.5 transition-colors">
                      <input
                        type="checkbox"
                        checked={(formData[permKey] ?? []).includes(p)}
                        onChange={() => togglePermission(p, type === 'Users')}
                        className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </FormModal>
  );
}
