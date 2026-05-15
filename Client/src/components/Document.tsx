import { useState, useMemo } from 'react';
import { Eye, FileEdit, Trash2, Filter, Plus, Download, X } from 'lucide-react';
import { motion } from 'motion/react';
import { ConfirmAlert } from './ConfirmAlert';
import { CompanyDocumentForm } from './CompanyDocumentForm';
import { EmployeeDocumentForm } from './EmployeeDocumentForm';
import { DocumentViewer } from './DocumentViewer';
import { PageHeader } from './ui/PageHeader';
import { TabBar } from './ui/TabBar';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';

const initialCompanyDocs = [
  { id: 1, name: 'Employee Handbook 2026', details: 'Updated policies for remote work', departments: ['All'], employees: [], attachmentName: 'handbook2026.pdf' },
  { id: 2, name: 'Health & Safety Guidelines', details: 'Office safety protocols', departments: ['Human Resources', 'Engineering'], employees: [], attachmentName: 'safety.pdf' },
  { id: 3, name: 'Q1 Product Roadmap', details: 'Confidential roadmap', departments: ['Engineering', 'Marketing'], employees: ['MICHAEL CHEN'], attachmentName: 'q1_roadmap.pdf' },
];

const initialEmployeeDocs = [
  { id: 101, employee: 'UNION ADMIN', documentType: 'Passport', dateOfIssue: '2023-01-15', placeOfIssue: 'Accra', expiryDate: '2033-01-14', details: 'Valid passport', attachmentName: 'passport_admin.pdf' },
  { id: 102, employee: 'SAMUEL BANDOH', documentType: 'National ID', dateOfIssue: '2022-05-10', placeOfIssue: 'Kumasi', expiryDate: '2032-05-10', details: 'Ghana Card', attachmentName: 'gh_card_samuel.jpg' },
  { id: 103, employee: 'SARAH JENKS', documentType: 'Tax Certificate', dateOfIssue: '2025-02-01', placeOfIssue: 'Accra', expiryDate: '2026-02-01', details: '2025 Tax clearance', attachmentName: 'tax_clearance.pdf' },
];

const TABS = ['Company Document', 'Employee Document'];

export function Documents() {
  const [companyDocs, setCompanyDocs] = useState(initialCompanyDocs);
  const [employeeDocs, setEmployeeDocs] = useState(initialEmployeeDocs);
  const [activeTab, setActiveTab] = useState('Company Document');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [documentToView, setDocumentToView] = useState<any | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);

  const filteredCompanyDocs = useMemo(
    () => companyDocs.filter((doc) => doc.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [companyDocs, searchQuery]
  );

  const filteredEmployeeDocs = useMemo(
    () =>
      employeeDocs.filter((doc) => {
        const q = searchQuery.toLowerCase();
        return (
          (doc.employee.toLowerCase().includes(q) || doc.documentType.toLowerCase().includes(q)) &&
          (!docTypeFilter || doc.documentType === docTypeFilter)
        );
      }),
    [employeeDocs, searchQuery, docTypeFilter]
  );

  const handleAddClick = () => { setSelectedDoc(null); setIsFormOpen(true); };
  const handleEditClick = (doc: any) => { setSelectedDoc(doc); setIsFormOpen(true); };
  const handleDeleteClick = (doc: any) => { setSelectedDoc(doc); setIsAlertOpen(true); };

  const handleSave = (data: any) => {
    if (activeTab === 'Company Document') {
      setCompanyDocs((prev) =>
        data.id ? prev.map((d) => (d.id === data.id ? data : d)) : [...prev, { ...data, id: Date.now() }]
      );
    } else {
      setEmployeeDocs((prev) =>
        data.id ? prev.map((d) => (d.id === data.id ? data : d)) : [...prev, { ...data, id: Date.now() }]
      );
    }
  };

  const handleConfirmDelete = () => {
    if (!selectedDoc) return;
    if (activeTab === 'Company Document') {
      setCompanyDocs((prev) => prev.filter((d) => d.id !== selectedDoc.id));
    } else {
      setEmployeeDocs((prev) => prev.filter((d) => d.id !== selectedDoc.id));
    }
    setIsAlertOpen(false);
    setSelectedDoc(null);
  };

  const onTabChange = (tab: string) => {
    setActiveTab(tab);
    setSearchQuery('');
    setDocTypeFilter('');
    setShowFilters(false);
  };

  const isEmployee = activeTab === 'Employee Document';
  const filtered = isEmployee ? filteredEmployeeDocs : filteredCompanyDocs;
  const total = isEmployee ? employeeDocs.length : companyDocs.length;

  const filterBar = isEmployee ? (
    <>
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide syne">Doc Type:</label>
        <select value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)} className="w-[140px] py-1 text-xs px-2 border rounded">
          <option value="">All Types</option>
          <option value="National ID">National ID</option>
          <option value="Passport">Passport</option>
          <option value="Driver's License">Driver's License</option>
          <option value="Tax Certificate">Tax Certificate</option>
          <option value="SSNIT Card">SSNIT Card</option>
        </select>
      </div>
      {docTypeFilter && (
        <button onClick={() => setDocTypeFilter('')} className="text-[12px] font-bold text-[var(--accent)] hover:text-blue-800 flex items-center gap-1">
          <X className="w-3 h-3" /> Clear Filters
        </button>
      )}
    </>
  ) : null;

  return (
    <div className="p-4 sm:p-6 md:p-6 w-full max-w-[1400px] mx-auto overflow-x-hidden flex flex-col h-full relative">
      <PageHeader title="Company Documents" subtitle="Manage and view all documents details." />

      <TabBar tabs={TABS} activeTab={activeTab} onChange={onTabChange} />

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col flex-1 max-h-min drop-shadow-sm">
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={isEmployee ? 'Search employee or type...' : 'Search company documents...'}
          showFilters={showFilters && isEmployee}
          filterBar={filterBar}
          actions={
            <>
              <button onClick={handleAddClick} className="primary-btn shrink-0">
                <span className="hidden sm:inline">Add New</span>
                <span className="sm:hidden">Add</span>
                <Plus className="w-[14px] h-[14px]" />
              </button>
              {isEmployee && (
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`secondary-btn shrink-0 ${showFilters ? 'ring-2 ring-[var(--accent)] border-[var(--accent)] text-[var(--accent)] bg-[var(--accent-dim)]' : ''}`}
                >
                  Filter <Filter className="w-[14px] h-[14px] fill-current opacity-80" />
                </button>
              )}
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
                {isEmployee ? (
                  <>
                    <th scope="col" className="th">Employee</th>
                    <th scope="col" className="th">Document Type</th>
                    <th scope="col" className="th">Date of Issue</th>
                    <th scope="col" className="th">Expiry Date</th>
                    <th scope="col" className="th">Place of Issue</th>
                  </>
                ) : (
                  <>
                    <th scope="col" className="th">Name</th>
                    <th scope="col" className="th">Shared With (Depts)</th>
                    <th scope="col" className="th">Shared With (Employees)</th>
                    <th scope="col" className="th">Details</th>
                  </>
                )}
                <th scope="col" className="th text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((row: any, i) => (
                  <motion.tr key={row.id} className="tr" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                    {isEmployee ? (
                      <>
                        <td className="td font-medium text-[var(--text-primary)]">{row.employee}</td>
                        <td className="td">{row.documentType}</td>
                        <td className="td">{row.dateOfIssue}</td>
                        <td className="td">{row.expiryDate || 'N/A'}</td>
                        <td className="td">{row.placeOfIssue}</td>
                      </>
                    ) : (
                      <>
                        <td className="td font-medium text-[var(--text-primary)]">{row.name}</td>
                        <td className="td">{row.departments?.length ? row.departments.join(', ') : 'None'}</td>
                        <td className="td">{row.employees?.length ? row.employees.join(', ') : 'None'}</td>
                        <td className="td truncate max-w-[200px]">{row.details}</td>
                      </>
                    )}
                    <td className="td">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setDocumentToView(row)} className="action-btn text-[var(--accent)]" title="View Document"><Eye size={14} /></button>
                        <button onClick={() => handleEditClick(row)} className="action-btn text-[var(--warning)]" title="Edit"><FileEdit size={14} /></button>
                        <button onClick={() => handleDeleteClick(row)} className="action-btn text-[var(--danger)]" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isEmployee ? 6 : 5} className="td text-center py-10">
                    No {isEmployee ? 'employee' : 'company'} documents found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination total={total} filtered={filtered.length} />
      </div>

      {isFormOpen && isEmployee && (
        <EmployeeDocumentForm onClose={() => setIsFormOpen(false)} initialData={selectedDoc} onSave={handleSave} />
      )}
      {isFormOpen && !isEmployee && (
        <CompanyDocumentForm onClose={() => setIsFormOpen(false)} initialData={selectedDoc} onSave={handleSave} />
      )}

      <DocumentViewer document={documentToView} onClose={() => setDocumentToView(null)} />

      <ConfirmAlert
        isOpen={isAlertOpen}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Yes, Delete"
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsAlertOpen(false)}
        variant="danger"
      />
    </div>
  );
}
