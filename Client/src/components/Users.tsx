import { useState, useMemo, useEffect, useCallback } from 'react';
import { FileEdit, Trash2, Plus, KeyRound, ShieldOff, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { ConfirmAlert } from './ConfirmAlert';
import { UserCreationForm } from './UserCreationForm';
import { PageHeader } from './ui/PageHeader';
import { TabBar } from './ui/TabBar';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';
import api from '../../lib/api';

const TABS = ['Users', 'Roles'];

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
  const handleEditClick = (item: any) => { setSelectedItem(item); setIsFormOpen(true); };
  const handleDeleteClick = (item: any) => { setSelectedItem(item); setIsAlertOpen(true); };

  const handleToggleStatus = async (item: any) => {
    if (activeTab === 'Users') {
      const next = item.status === '1' ? '0' : '1';
      try {
        await api.put(`/${item.id}/status`, { status: next });
        await loadUsers();
      } catch (e) { console.error(e); }
    } else {
      const next = item.status === 'Active' ? 'Inactive' : 'Active';
      try {
        await api.put(`/roles/${item.id}/status`, { status: next });
        await loadRoles();
      } catch (e) { console.error(e); }
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
        await loadUsers();
      } else {
        const payload = {
          roleName:    data.roleName,
          name:        data.roleName,
          status:      data.status,
          permissions: data.permissions ?? [],
        };
        if (data.id) {
          await api.put(`/roles/${data.id}`, payload);
        } else {
          await api.post('/roles', payload);
        }
        await loadRoles();
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
    setIsFormOpen(false);
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

  const isUsers = activeTab === 'Users';
  const filtered = isUsers ? filteredUsers : filteredRoles;
  const total = isUsers ? users.length : roles.length;

  return (
    <div className="p-4 sm:p-6 md:p-6 w-full max-w-[1400px] mx-auto overflow-x-hidden flex flex-col h-full relative">
      <PageHeader title="System Users & Roles" subtitle="Manage application access, mapping users to employees, and configuring role permissions." />

      <TabBar tabs={TABS} activeTab={activeTab} onChange={onTabChange} />

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
              {filtered.length > 0 ? (
                filtered.map((row: any, i) => (
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
                        <td className="td"><span className={`pill ${row.status === 'Active' ? 'pill-success' : 'pill-danger'}`}>{row.status}</span></td>
                        <td className="td">{row.permissionsCount} permissions granted</td>
                      </>
                    )}
                    <td className="td">
                      <div className="flex items-center justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        {isUsers && (
                          <button onClick={() => {}} className="action-btn text-[var(--text-secondary)]" title="Trigger Password Change">
                            <KeyRound size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleStatus(row)}
                          className={`action-btn ${(isUsers ? row.status === '1' : row.status === 'Active') ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}
                          title={(isUsers ? row.status === '1' : row.status === 'Active') ? 'Deactivate' : 'Activate'}
                        >
                          {(isUsers ? row.status === '1' : row.status === 'Active') ? <ShieldOff size={14} /> : <CheckCircle2 size={14} />}
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
                    {loading ? 'Loading...' : `No ${isUsers ? 'users' : 'roles'} found.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination total={total} filtered={filtered.length} />
      </div>

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
    </div>
  );
}
