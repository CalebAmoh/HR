import { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronDown, Eye, FileEdit, Filter, Plus, X, Users, Award, FileBadge, Globe, Baby, HeartPulse } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { ConfirmAlert } from './ConfirmAlert';
import { EmployeeFormFull } from './EmployeeFormFull';
import { EmployeeDetailsSlideOver } from './EmployeeDetailsSlideOver';
import { RelationalTab } from './EmployeeTabs';
import { PageHeader } from './ui/PageHeader';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';
import api from '../../lib/api';

const ICON_TABS = [
  { label: 'Employees',          icon: Users      },
  { label: 'Skills',             icon: Award      },
  // { label: 'Education',          icon: BookOpen   },
  { label: 'Certifications',     icon: FileBadge  },
  { label: 'Languages',          icon: Globe      },
  { label: 'Dependents',         icon: Baby       },
  { label: 'Emergency Contacts', icon: HeartPulse },
];

const DEACTIVATED_TABS = ['Suspended Employees', 'Terminated Employees'];

// Status pill helpers
function LifecyclePill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING:    'pill pill-warning',
    ACTIVE:     'pill pill-success',
    SUSPENDED:  'pill pill-warning',
    TERMINATED: 'pill pill-danger',
    RESIGNED:   'pill pill-accent',
  };
  return <span className={styles[status] ?? 'pill'}>{status}</span>;
}

function ApprovalPill({ status }: { status: string }) {
  if (status !== 'REJECTED') return null;
  return <span className="pill pill-danger">REJECTED</span>;
}

export function Employees() {
  const [activeTab, setActiveTab]     = useState('Employees');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState(10);
  const [filters, setFilters]         = useState({ department: '', jobTitle: '', employmentStatus: '', approvalStatus: '' });

  const [employees, setEmployees]         = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [isFormOpen, setIsFormOpen]       = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen]     = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(res.data.data ?? []);
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { setPage(1); }, [searchQuery, activeTab]);

  // ── Filter by active tab ─────────────────────────────────────────────────
  const visibleEmployees = useMemo(() => {
    let list = employees;
    if (activeTab === 'Suspended Employees')  list = employees.filter(e => e.lifecycleStatus === 'SUSPENDED');
    else if (activeTab === 'Terminated Employees') list = employees.filter(e => e.lifecycleStatus === 'TERMINATED');
    else if (activeTab === 'Employees') list = employees.filter(e => !['SUSPENDED','TERMINATED','RESIGNED'].includes(e.lifecycleStatus));
    return list;
  }, [employees, activeTab]);

  const filtered = useMemo(() => {
    let list = visibleEmployees;
    const q = searchQuery.toLowerCase();
    if (q) list = list.filter((e: any) =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      e.employee_id?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q)
    );
    if (filters.department)       list = list.filter((e: any) => e.department?.title       === filters.department);
    if (filters.jobTitle)         list = list.filter((e: any) => e.jobTitle?.label          === filters.jobTitle);
    if (filters.employmentStatus) list = list.filter((e: any) => e.employmentStatus?.label  === filters.employmentStatus);
    if (filters.approvalStatus)   list = list.filter((e: any) => e.approvalStatus           === filters.approvalStatus);
    return list;
  }, [visibleEmployees, searchQuery, filters]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleAddClick  = () => { setSelectedEmployee(null); setIsFormOpen(true); };
  const handleEditClick = (emp: any) => { setSelectedEmployee(emp); setIsFormOpen(true); };
  const handleViewClick = (emp: any) => { setSelectedEmployee(emp); setIsDetailsOpen(true); };


  const handleSave = async (data: any, id?: string) => {
    try {
      if (id) {
        await api.put(`/employees/${id}`, data);
        toast.success('Employee updated');
      } else {
        await api.post('/employees', data);
        toast.success('Employee created — pending approval');
      }
      await fetchEmployees();
      setIsFormOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save employee');
    }
  };

  // ── Filters ──────────────────────────────────────────────────────────────
  const setFilter = (k: keyof typeof filters, v: string) => { setFilters((p: typeof filters) => ({ ...p, [k]: v })); setPage(1); };
  const clearFilters = () => { setFilters({ department: '', jobTitle: '', employmentStatus: '', approvalStatus: '' }); setPage(1); };
  const hasFilters = Object.values(filters).some(Boolean);

  const deptOptions    = useMemo(() => [...new Set(employees.map((e: any) => e.department?.title).filter(Boolean))].sort(), [employees]);
  const jtOptions      = useMemo(() => [...new Set(employees.map((e: any) => e.jobTitle?.label).filter(Boolean))].sort(), [employees]);
  const empStOptions   = useMemo(() => [...new Set(employees.map((e: any) => e.employmentStatus?.label).filter(Boolean))].sort(), [employees]);

  const filterBar = (
    <div className="flex flex-wrap items-end gap-3 py-3">
      {([
        { key: 'department',      label: 'Department',        options: deptOptions  },
        { key: 'jobTitle',        label: 'Job Title',         options: jtOptions    },
        { key: 'employmentStatus',label: 'Employment Status', options: empStOptions },
        { key: 'approvalStatus',  label: 'Approval Status',   options: ['PENDING', 'APPROVED', 'REJECTED'] },
      ] as const).map(({ key, label, options }) => (
        <div key={key} className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">{label}</label>
          <select
            value={filters[key]}
            onChange={(e: { target: { value: string } }) => setFilter(key, e.target.value)}
            className="text-[12px] h-8 px-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">All</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      ))}
      {hasFilters && (
        <button onClick={clearFilters} className="flex items-center gap-1 text-[12px] text-[var(--danger)] hover:underline h-8 self-end">
          <X size={12} /> Clear
        </button>
      )}
    </div>
  );

  const isTableTab = activeTab === 'Employees' || DEACTIVATED_TABS.includes(activeTab);

  if (isDetailsOpen && selectedEmployee) {
    return (
      <EmployeeDetailsSlideOver
        isOpen
        onClose={() => setIsDetailsOpen(false)}
        employee={selectedEmployee}
        onRefresh={fetchEmployees}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-6 w-full max-w-[1400px] mx-auto overflow-x-hidden flex flex-col h-full relative">
      <PageHeader title="Employee Directory" subtitle="Manage and view all employee records and details." />

      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-2 mt-2 mb-4">
        {ICON_TABS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => setActiveTab(label)}
            className={`tab-btn flex items-center gap-2 ${activeTab === label ? 'active' : ''}`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
            className={`tab-btn flex items-center gap-1 ${DEACTIVATED_TABS.includes(activeTab) ? 'active' : ''}`}
          >
            Deactivated <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-52 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-lg z-50 py-1.5 flex flex-col">
              {DEACTIVATED_TABS.map(tab => (
                <button
                  key={tab}
                  onMouseDown={e => { e.preventDefault(); setActiveTab(tab); setDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-[13px] hover:bg-[var(--surface-hover)] transition-colors ${activeTab === tab ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-secondary)] font-medium'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isTableTab ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col min-h-0">
          <TableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by name, ID or email..."
            showFilters={showFilters}
            filterBar={filterBar}
            actions={
              <>
                {activeTab === 'Employees' && (
                  <button onClick={handleAddClick} className="primary-btn shrink-0">
                    <span className="hidden sm:inline">Add New</span>
                    <span className="sm:hidden">Add</span>
                    <Plus className="w-[14px] h-[14px]" />
                  </button>
                )}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`secondary-btn shrink-0 ${showFilters ? 'ring-2 ring-[var(--accent)] border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-dim)]' : ''}`}
                >
                  Filter <Filter className="w-[14px] h-[14px] fill-current opacity-80" />
                </button>
              </>
            }
          />

          <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th w-10"><span className="sr-only">Avatar</span></th>
                  <th className="th">ID</th>
                  <th className="th">Name</th>
                  <th className="th">Mobile</th>
                  <th className="th">Job Title</th>
                  <th className="th">Emp. Status</th>
                  <th className="th">Status</th>
                  <th className="th text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="td text-center py-10 text-[var(--text-muted)]">Loading...</td></tr>
                ) : paged.length > 0 ? (
                  paged.map((row, i) => (
                    <motion.tr key={row.id} className="tr" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 + i * 0.03 }}>
                      <td className="td">
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-[var(--border)] shrink-0">
                          {row.profile_imagebase64 ? (
                            <img src={row.profile_imagebase64} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-[var(--accent-dim)] flex items-center justify-center">
                              <span className="font-bold text-[13px] text-[var(--accent)]">
                                {row.firstName?.charAt(0)?.toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="td font-medium text-[var(--text-primary)]">{row.employee_id ?? '—'}</td>
                      <td className="td">
                        <span className="font-medium text-[var(--text-primary)]">
                          {[row.title?.label, row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ')}
                        </span>
                      </td>
                      <td className="td">{row.mobilePhone || '—'}</td>
                      <td className="td">{row.jobTitle?.label || '—'}</td>
                      <td className="td">{row.employmentStatus?.label || '—'}</td>
                      <td className="td">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <LifecyclePill status={row.lifecycleStatus} />
                          <ApprovalPill  status={row.approvalStatus}  />
                        </div>
                      </td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleViewClick(row)} className="action-btn text-[var(--accent)]" title="View Details">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => handleEditClick(row)} className="action-btn text-[var(--warning)]" title="Edit">
                            <FileEdit size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="td text-center py-10">No employees found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            total={visibleEmployees.length}
            filtered={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={s => { setPageSize(s); setPage(1); }}
          />
        </div>
      ) : (
        <RelationalTab activeTab={activeTab} mockEmployees={employees} />
      )}

      {isFormOpen && (
        <EmployeeFormFull
          onClose={() => setIsFormOpen(false)}
          initialData={selectedEmployee}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
