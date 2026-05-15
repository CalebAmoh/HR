import { useState, useMemo } from 'react';
import { ChevronDown, Eye, FileEdit, Trash2, Filter, Plus, Download, X, RotateCcw, Users, Award, BookOpen, FileBadge, Globe, Baby, HeartPulse } from 'lucide-react';
import { motion } from 'motion/react';
import { ConfirmAlert } from './ConfirmAlert';
import { EmployeeFormFull } from './EmployeeFormFull';
import { EmployeeDetailsSlideOver } from './EmployeeDetailsSlideOver';
import { RelationalTab } from './EmployeeTabs';
import { PageHeader } from './ui/PageHeader';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';

const initialMockData = [
  { id: 1, number: 'TEST001', firstName: 'UNION', middleName: '', lastName: 'ADMIN', phone: '02543069666', gender: 'M', supervisor: '' },
  { id: 2, number: 'P0092882', firstName: 'SAMUEL', middleName: '', lastName: 'BANDOH', phone: '0567864783', gender: 'M', supervisor: 'UNION ADMIN' },
  { id: 3, number: 'E0045122', firstName: 'SARAH', middleName: 'J.', lastName: 'JENKS', phone: '0551234567', gender: 'F', supervisor: 'SAMUEL BANDOH' },
  { id: 4, number: 'E0045123', firstName: 'MICHAEL', middleName: '', lastName: 'CHEN', phone: '0559876543', gender: 'M', supervisor: 'SAMUEL BANDOH' },
];

const ICON_TABS = [
  { label: 'Employees', icon: Users },
  { label: 'Skills', icon: Award },
  { label: 'Education', icon: BookOpen },
  { label: 'Certifications', icon: FileBadge },
  { label: 'Languages', icon: Globe },
  { label: 'Dependents', icon: Baby },
  { label: 'Emergency Contacts', icon: HeartPulse },
];

const DEACTIVATED_TABS = ['Temporarily deactivated employees', 'Terminated employees'];

export function Employees() {
  const [employees, setEmployees] = useState(initialMockData);
  const [activeTab, setActiveTab] = useState('Employees');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [genderFilter, setGenderFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  const filteredEmployees = useMemo(
    () =>
      employees.filter((emp: any) => {
        const q = searchQuery.toLowerCase();
        return (
          (emp.firstName.toLowerCase().includes(q) ||
            emp.lastName.toLowerCase().includes(q) ||
            emp.number.toLowerCase().includes(q)) &&
          (!genderFilter || emp.gender === genderFilter)
        );
      }),
    [employees, searchQuery, genderFilter]
  );

  const handleAddClick = () => { setSelectedEmployee(null); setIsFormOpen(true); };
  const handleEditClick = (emp: any) => { setSelectedEmployee(emp); setIsFormOpen(true); };
  const handleViewClick = (emp: any) => { setSelectedEmployee(emp); setIsDetailsOpen(true); };
  const handleDeleteClick = (emp: any) => { setSelectedEmployee(emp); setIsAlertOpen(true); };

  const handleSave = (data: any) => {
    setEmployees((prev: any[]) =>
      data.id ? prev.map((e: any) => (e.id === data.id ? data : e)) : [...prev, { ...data, id: Date.now() }]
    );
  };

  const handleConfirmDelete = () => {
    if (selectedEmployee) {
      setEmployees((prev: any[]) => prev.filter((e: any) => e.id !== selectedEmployee.id));
      setIsAlertOpen(false);
      setSelectedEmployee(null);
    }
  };

  if (isDetailsOpen && selectedEmployee) {
    return <EmployeeDetailsSlideOver isOpen onClose={() => setIsDetailsOpen(false)} employee={selectedEmployee} />;
  }

  const isTableTab = activeTab === 'Employees' || DEACTIVATED_TABS.includes(activeTab);

  const filterBar = (
    <>
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide syne">Gender:</label>
        <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} className="w-[120px] py-1 text-xs">
          <option value="">All</option>
          <option value="M">Male</option>
          <option value="F">Female</option>
          <option value="Other">Other</option>
        </select>
      </div>
      {genderFilter && (
        <button onClick={() => setGenderFilter('')} className="text-[12px] font-bold text-[var(--accent)] hover:text-blue-800 flex items-center gap-1">
          <X className="w-3 h-3" /> Clear Filters
        </button>
      )}
    </>
  );

  return (
    <div className="p-4 sm:p-6 md:p-6 w-full max-w-[1400px] mx-auto overflow-x-hidden flex flex-col h-full relative">
      <PageHeader title="Employee Directory" subtitle="Manage and view all employee records and details." />

      {/* Tab bar with dropdown — kept custom due to icons + dropdown */}
      <div className="flex flex-wrap items-center gap-2 mt-2 mb-4">
        {ICON_TABS.map(({ label, icon: Icon }) => (
          <button
            key={label}
            onClick={() => setActiveTab(label)}
            className={`tab-btn flex flex-row items-center justify-center gap-2 ${activeTab === label ? 'active' : ''}`}
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
            Deactivated Employees <ChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1.5 flex flex-col">
              {DEACTIVATED_TABS.map((tab) => (
                <button
                  key={tab}
                  onMouseDown={(e) => { e.preventDefault(); setActiveTab(tab); setDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-[13px] hover:bg-slate-50 transition-colors ${activeTab === tab ? 'text-[var(--accent)] font-bold' : 'text-slate-600 font-medium'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isTableTab ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col">
          <TableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search by name or number..."
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
                <button className="secondary-btn shrink-0">
                  <span className="hidden sm:inline">Download (Excel)</span>
                  <span className="sm:hidden">Export</span>
                  <Download className="w-[14px] h-[14px]" />
                </button>
              </>
            }
          />

          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className="th w-10"><span className="sr-only">Avatar</span></th>
                  <th scope="col" className="th">Employee Number</th>
                  <th scope="col" className="th">First Name</th>
                  <th scope="col" className="th">Middle Name</th>
                  <th scope="col" className="th">Last Name</th>
                  <th scope="col" className="th">Mobile Phone</th>
                  <th scope="col" className="th">Gender</th>
                  <th scope="col" className="th">Supervisor</th>
                  <th scope="col" className="th text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((row, i) => (
                    <motion.tr key={row.id} className="tr" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                      <td className="td">
                        <div className="avatar w-8 h-8 rounded-lg bg-[var(--surface-hover)] flex items-center justify-center shadow-sm overflow-hidden border border-[var(--border)]">
                          <span className="font-bold text-[14px] text-[var(--accent)]">{row.firstName.charAt(0)}</span>
                        </div>
                      </td>
                      <td className="td font-medium text-[var(--text-primary)]">{row.number}</td>
                      <td className="td">{row.firstName}</td>
                      <td className="td">{row.middleName}</td>
                      <td className="td">{row.lastName}</td>
                      <td className="td">{row.phone}</td>
                      <td className="td">{row.gender}</td>
                      <td className="td">{row.supervisor}</td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          {activeTab === 'Temporarily deactivated employees' ? (
                            <button className="secondary-btn text-[var(--success)] !py-1 !px-2 text-xs" title="Restore Employee">
                              <RotateCcw size={14} /> Restore
                            </button>
                          ) : activeTab === 'Terminated employees' ? (
                            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">No actions</span>
                          ) : (
                            <>
                              <button onClick={() => handleViewClick(row)} className="action-btn text-[var(--accent)]" title="View Details"><Eye size={14} /></button>
                              <button onClick={() => handleEditClick(row)} className="action-btn text-[var(--warning)]" title="Edit"><FileEdit size={14} /></button>
                              <button onClick={() => handleDeleteClick(row)} className="action-btn text-[var(--danger)]" title="Delete"><Trash2 size={14} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="td text-center py-10">No employees found matching your filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination total={employees.length} filtered={filteredEmployees.length} />
        </div>
      ) : (
        <RelationalTab activeTab={activeTab} mockEmployees={employees} />
      )}

      {isFormOpen && (
        <EmployeeFormFull onClose={() => setIsFormOpen(false)} initialData={selectedEmployee} onSave={handleSave} />
      )}

      <ConfirmAlert
        isOpen={isAlertOpen}
        title="Delete Employee Record"
        message={`Are you sure you want to delete the record for ${selectedEmployee?.firstName}? This action cannot be undone.`}
        confirmText="Yes, Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsAlertOpen(false)}
        variant="danger"
      />
    </div>
  );
}
