import { useState, useMemo } from 'react';
import { Eye, FileEdit, Trash2, Plus, KeyRound, ShieldOff, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { ConfirmAlert } from './ConfirmAlert';
import { UserCreationForm } from './UserCreationForm';
import { PageHeader } from './ui/PageHeader';
import { TabBar } from './ui/TabBar';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';

const initialUsers = [
  { id: 1, employee: 'MICHAEL CHEN', username: 'mchen', status: 'Active', directPermissions: ['Approve Leave', 'View Payroll'] },
  { id: 2, employee: 'SARAH JENKS', username: 'sjenks', status: 'Inactive', directPermissions: [] },
  { id: 3, employee: 'UNION ADMIN', username: 'admin', status: 'Active', directPermissions: ['System Administration'] },
];

const initialRoles = [
  { id: 101, roleName: 'HR Manager', status: 'Active', permissionsCount: 15 },
  { id: 102, roleName: 'Finance Lead', status: 'Active', permissionsCount: 12 },
  { id: 103, roleName: 'Employee', status: 'Active', permissionsCount: 4 },
];

const TABS = ['Users', 'Roles'];

export function Users() {
  const [users, setUsers] = useState(initialUsers);
  const [roles, setRoles] = useState(initialRoles);
  const [activeTab, setActiveTab] = useState('Users');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const filteredUsers = useMemo(
    () => users.filter((u) => u.employee.toLowerCase().includes(searchQuery.toLowerCase()) || u.username.toLowerCase().includes(searchQuery.toLowerCase())),
    [users, searchQuery]
  );

  const filteredRoles = useMemo(
    () => roles.filter((r) => r.roleName.toLowerCase().includes(searchQuery.toLowerCase())),
    [roles, searchQuery]
  );

  const handleAddClick = () => { setSelectedItem(null); setIsFormOpen(true); };
  const handleEditClick = (item: any) => { setSelectedItem(item); setIsFormOpen(true); };
  const handleDeleteClick = (item: any) => { setSelectedItem(item); setIsAlertOpen(true); };

  const handleToggleStatus = (item: any) => {
    const toggle = (arr: any[], setter: any) =>
      setter(arr.map((x: any) => x.id === item.id ? { ...x, status: x.status === 'Active' ? 'Inactive' : 'Active' } : x));
    activeTab === 'Users' ? toggle(users, setUsers) : toggle(roles, setRoles);
  };

  const handleSave = (data: any) => {
    const save = (arr: any[], setter: any) =>
      setter(data.id ? arr.map((x: any) => x.id === data.id ? data : x) : [...arr, { ...data, id: Date.now() }]);
    activeTab === 'Users' ? save(users, setUsers) : save(roles, setRoles);
  };

  const handleConfirmDelete = () => {
    if (!selectedItem) return;
    const remove = (arr: any[], setter: any) =>
      setter(arr.filter((x: any) => x.id !== selectedItem.id));
    activeTab === 'Users' ? remove(users, setUsers) : remove(roles, setRoles);
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
                        <td className="td font-medium text-[var(--text-primary)]">{row.employee}</td>
                        <td className="td">{row.username}</td>
                        <td className="td"><span className={`pill ${row.status === 'Active' ? 'pill-success' : 'pill-danger'}`}>{row.status}</span></td>
                        <td className="td truncate max-w-[200px]">{row.directPermissions?.length > 0 ? row.directPermissions.join(', ') : 'None'}</td>
                      </>
                    ) : (
                      <>
                        <td className="td font-medium text-[var(--text-primary)]">{row.roleName}</td>
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
                        <button onClick={() => handleToggleStatus(row)} className={`action-btn ${row.status === 'Active' ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`} title={row.status === 'Active' ? 'Deactivate' : 'Activate'}>
                          {row.status === 'Active' ? <ShieldOff size={14} /> : <CheckCircle2 size={14} />}
                        </button>
                        <button onClick={() => handleEditClick(row)} className="action-btn text-[var(--warning)]" title="Edit"><FileEdit size={14} /></button>
                        <button onClick={() => handleDeleteClick(row)} className="action-btn text-[var(--danger)]" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isUsers ? 5 : 4} className="td text-center py-10">No {isUsers ? 'users' : 'roles'} found.</td>
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
        />
      )}

      <ConfirmAlert
        isOpen={isAlertOpen}
        title={`Delete ${isUsers ? 'User' : 'Role'}`}
        message={`Are you sure you want to delete this ${isUsers ? 'user' : 'role'}? This action cannot be undone.`}
        confirmText="Yes, Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsAlertOpen(false)}
        variant="danger"
      />
    </div>
  );
}
