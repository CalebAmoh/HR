import { useState, useMemo } from 'react';
import { FileEdit, Trash2, Filter, Plus, Download, X } from 'lucide-react';
import { motion } from 'motion/react';
import { ConfirmAlert } from './ConfirmAlert';
import { CompanyStructureForm } from './CompanyStructureForm';
import { Organogram } from './Organogram';
import { useCrud } from '../hooks/useCrud';
import { PageHeader } from './ui/PageHeader';
import { TabBar } from './ui/TabBar';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';

const initialMockData = [
  { id: 1, name: 'Headquarters', code: 'HQ-01', type: 'Company', details: 'Main office', address: '123 Main St', parent: 'None', manager: 'UNION ADMIN' },
  { id: 2, name: 'Engineering', code: 'ENG-01', type: 'Department', details: 'Software development', address: '123 Main St', parent: 'Headquarters', manager: 'SAMUEL BANDOH' },
  { id: 3, name: 'Human Resources', code: 'HR-01', type: 'Department', details: 'HR & Operations', address: '123 Main St', parent: 'Headquarters', manager: 'UNION ADMIN' },
  { id: 4, name: 'Frontend Team', code: 'ENG-FE', type: 'Team', details: 'Web UI', address: '2nd Floor, 123 Main St', parent: 'Engineering', manager: 'MICHAEL CHEN' },
  { id: 5, name: 'Backend Team', code: 'ENG-BE', type: 'Team', details: 'APIs', address: '123 Main St', parent: 'Engineering', manager: 'SARAH JENKS' },
  { id: 6, name: 'Recruitment', code: 'HR-REC', type: 'Team', details: 'Talent Acquisition', address: '123 Main St', parent: 'Human Resources', manager: 'UNION ADMIN' },
];

const TABS = ['Company Structure', 'Organogram'];

export function Company() {
  const [activeTab, setActiveTab] = useState('Company Structure');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');

  const {
    items: structures,
    isFormOpen, setIsFormOpen,
    isAlertOpen, setIsAlertOpen,
    selectedItem: selectedStructure,
    handleAddClick, handleEditClick, handleDeleteClick,
    handleSave, handleConfirmDelete,
  } = useCrud(initialMockData);

  const filtered = useMemo(
    () =>
      structures.filter((s) => {
        const q = searchQuery.toLowerCase();
        return (
          (s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)) &&
          (!typeFilter || s.type === typeFilter)
        );
      }),
    [structures, searchQuery, typeFilter]
  );

  const filterBar = (
    <>
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide syne">Type:</label>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-[140px] py-1 text-xs">
          <option value="">All Types</option>
          <option value="Company">Company</option>
          <option value="Branch">Branch</option>
          <option value="Department">Department</option>
          <option value="Unit">Unit</option>
          <option value="Team">Team</option>
        </select>
      </div>
      {typeFilter && (
        <button onClick={() => setTypeFilter('')} className="text-[12px] font-bold text-[var(--accent)] hover:text-blue-800 flex items-center gap-1">
          <X className="w-3 h-3" /> Clear Filters
        </button>
      )}
    </>
  );

  return (
    <div className="p-4 sm:p-6 md:p-6 w-full max-w-[1400px] mx-auto overflow-x-hidden flex flex-col h-full relative">
      <PageHeader title="Organization Structure" subtitle="Manage your company hierarchy, departments, and units." />

      <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'Company Structure' ? (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col">
          <TableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search structures..."
            showFilters={showFilters}
            filterBar={filterBar}
            actions={
              <>
                <button onClick={handleAddClick} className="primary-btn shrink-0">
                  <span className="hidden sm:inline">Add New</span>
                  <span className="sm:hidden">Add</span>
                  <Plus className="w-[14px] h-[14px]" />
                </button>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`secondary-btn shrink-0 ${showFilters ? 'ring-2 ring-[var(--accent)] border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-dim)]' : ''}`}
                >
                  Filter
                  <Filter className="w-[14px] h-[14px] fill-current opacity-80" />
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
                  <th scope="col" className="th">Name</th>
                  <th scope="col" className="th">Code</th>
                  <th scope="col" className="th">Type</th>
                  <th scope="col" className="th">Parent</th>
                  <th scope="col" className="th">Manager</th>
                  <th scope="col" className="th">Address</th>
                  <th scope="col" className="th text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((row, i) => (
                    <motion.tr key={row.id} className="tr" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                      <td className="td font-medium text-[var(--text-primary)]">{row.name}</td>
                      <td className="td">{row.code}</td>
                      <td className="td font-medium text-[var(--text-secondary)]">{row.type}</td>
                      <td className="td">{row.parent}</td>
                      <td className="td">{row.manager || '—'}</td>
                      <td className="td">{row.address}</td>
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleEditClick(row)} className="action-btn text-[var(--warning)]" title="Edit">
                            <FileEdit size={14} />
                          </button>
                          <button onClick={() => handleDeleteClick(row)} className="action-btn text-[var(--danger)]" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="td text-center py-10">No structures found matching your criteria.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination total={structures.length} filtered={filtered.length} />
        </div>
      ) : (
        <Organogram data={structures} />
      )}

      {isFormOpen && (
        <CompanyStructureForm
          onClose={() => setIsFormOpen(false)}
          initialData={selectedStructure}
          onSave={handleSave}
        />
      )}

      <ConfirmAlert
        isOpen={isAlertOpen}
        title="Delete Structure"
        message={`Are you sure you want to delete ${selectedStructure?.name}? This action cannot be undone.`}
        confirmText="Yes, Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsAlertOpen(false)}
        variant="danger"
      />
    </div>
  );
}
