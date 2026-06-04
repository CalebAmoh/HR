import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Eye, FileEdit, Trash2, Filter, Plus, Download, X, Loader2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { ConfirmAlert } from './ConfirmAlert';
import { CompanyDocumentForm } from './CompanyDocumentForm';
import { EmployeeDocumentForm } from './EmployeeDocumentForm';
import { DocumentViewer } from './DocumentViewer';
import { PageHeader } from './ui/PageHeader';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';
import api from '../../lib/api';
import { toast } from 'sonner';

const initialEmployeeDocs = [
  { id: 101, employee: 'UNION ADMIN', documentType: 'Passport', dateOfIssue: '2023-01-15', placeOfIssue: 'Accra', expiryDate: '2033-01-14', details: 'Valid passport', attachmentName: 'passport_admin.pdf' },
  { id: 102, employee: 'SAMUEL BANDOH', documentType: 'National ID', dateOfIssue: '2022-05-10', placeOfIssue: 'Kumasi', expiryDate: '2032-05-10', details: 'Ghana Card', attachmentName: 'gh_card_samuel.jpg' },
  { id: 103, employee: 'SARAH JENKS', documentType: 'Tax Certificate', dateOfIssue: '2025-02-01', placeOfIssue: 'Accra', expiryDate: '2026-02-01', details: '2025 Tax clearance', attachmentName: 'tax_clearance.pdf' },
];

const fmtSharing = (doc: any) => {
  if (doc.share_userlevel === 'All') return 'All';
  const parts: string[] = [];
  if (doc.share_departments) parts.push(`Depts: ${doc.share_departments}`);
  if (doc.share_employees)   parts.push(`Emps: ${doc.share_employees}`);
  return parts.join(' | ') || '—';
};

type DocTab = 'Company Documents' | 'Employee Documents';
const TABS: DocTab[] = ['Company Documents', 'Employee Documents'];

export function Documents() {
  const [activeTab, setActiveTab]       = useState<DocTab>('Company Documents');
  const [companyDocs, setCompanyDocs]   = useState<any[]>([]);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [employeeDocs, setEmployeeDocs] = useState(initialEmployeeDocs);
  const [search, setSearch]             = useState('');
  const [showFilters, setShowFilters]   = useState(false);
  const [docTypeFilter, setDocTypeFilter] = useState('');
  const [isFormOpen, setIsFormOpen]     = useState(false);
  const [isAlertOpen, setIsAlertOpen]   = useState(false);
  const [selectedDoc, setSelectedDoc]   = useState<any>(null);
  const [documentToView, setDocumentToView] = useState<any>(null);

  const isEmployee = activeTab === 'Employee Documents';

  const fetchCompanyDocs = useCallback(() => {
    setCompanyLoading(true);
    api.get('/documents/company')
      .then(r => setCompanyDocs(r.data.data ?? []))
      .catch(() => toast.error('Failed to load company documents'))
      .finally(() => setCompanyLoading(false));
  }, []);

  useEffect(() => { fetchCompanyDocs(); }, [fetchCompanyDocs]);

  const filteredCompany = useMemo(
    () => companyDocs.filter(d => (d.name ?? '').toLowerCase().includes(search.toLowerCase())),
    [companyDocs, search]
  );
  const filteredEmployee = useMemo(
    () => employeeDocs.filter(d => {
      const q = search.toLowerCase();
      return (d.employee.toLowerCase().includes(q) || d.documentType.toLowerCase().includes(q))
        && (!docTypeFilter || d.documentType === docTypeFilter);
    }),
    [employeeDocs, search, docTypeFilter]
  );

  const handleSave = () => {
    if (!isEmployee) fetchCompanyDocs();
    toast.success('Document saved');
  };

  const handleDelete = async () => {
    if (!selectedDoc) return;
    if (!isEmployee) {
      try {
        await api.delete(`/documents/company/${selectedDoc.id}`);
        toast.success('Document deleted');
        fetchCompanyDocs();
      } catch { toast.error('Delete failed'); }
    } else {
      setEmployeeDocs(prev => prev.filter(d => d.id !== selectedDoc.id));
    }
    setIsAlertOpen(false);
    setSelectedDoc(null);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-[1400px] mx-auto flex flex-col h-full overflow-hidden">
      <PageHeader title="Documents" subtitle="Manage company-wide and employee documents." />

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col flex-1 drop-shadow-sm">
        {/* Tabs */}
        <div className="flex items-end gap-0.5 px-4 pt-3 border-b border-[var(--border)] shrink-0">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSearch(''); setDocTypeFilter(''); setShowFilters(false); }}
              className={[
                'px-3.5 py-2 text-[12px] font-semibold rounded-t-lg transition-colors whitespace-nowrap',
                tab === activeTab
                  ? 'bg-[var(--surface)] border border-b-[var(--surface)] border-[var(--border)] text-[var(--accent)] -mb-px z-10'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg)]',
              ].join(' ')}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <TableToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchPlaceholder={isEmployee ? 'Search employee or type…' : 'Search company documents…'}
          showFilters={showFilters && isEmployee}
          filterBar={isEmployee ? (
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide syne">Doc Type:</label>
              <select value={docTypeFilter} onChange={e => setDocTypeFilter(e.target.value)} className="w-[140px] py-1 text-xs px-2 border rounded">
                <option value="">All Types</option>
                <option value="National ID">National ID</option>
                <option value="Passport">Passport</option>
                <option value="Driver's License">Driver's License</option>
                <option value="Tax Certificate">Tax Certificate</option>
                <option value="SSNIT Card">SSNIT Card</option>
              </select>
              {docTypeFilter && (
                <button onClick={() => setDocTypeFilter('')} className="text-[12px] font-bold text-[var(--accent)] hover:text-blue-800 flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          ) : null}
          actions={
            <>
              <button onClick={() => { setSelectedDoc(null); setIsFormOpen(true); }} className="primary-btn shrink-0">
                <span className="hidden sm:inline">Add New</span><span className="sm:hidden">Add</span>
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

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          {!isEmployee && companyLoading ? (
            <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading…
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {isEmployee ? (
                    <>
                      <th className="th">Employee</th>
                      <th className="th">Document Type</th>
                      <th className="th">Date of Issue</th>
                      <th className="th">Expiry Date</th>
                      <th className="th">Place of Issue</th>
                    </>
                  ) : (
                    <>
                      <th className="th">Name</th>
                      <th className="th">Shared With</th>
                      <th className="th">Details</th>
                      <th className="th">Valid Until</th>
                    </>
                  )}
                  <th className="th text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {(isEmployee ? filteredEmployee : filteredCompany).length > 0 ? (
                  (isEmployee ? filteredEmployee : filteredCompany).map((row: any, i) => (
                    <motion.tr key={row.id} className="tr" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
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
                          <td className="td text-[var(--text-muted)] text-[12px]">{fmtSharing(row)}</td>
                          <td className="td truncate max-w-[220px]">{row.details || '—'}</td>
                          <td className="td">{row.valid_until ? String(row.valid_until).substring(0, 10) : '—'}</td>
                        </>
                      )}
                      <td className="td">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setDocumentToView({ ...row, attachmentName: row.attachment, sourceUrl: row.attachment ? `/documents/${row.attachment}` : null })} className="action-btn text-[var(--accent)]" title="View"><Eye size={14} /></button>
                          <button onClick={() => { setSelectedDoc(row); setIsFormOpen(true); }} className="action-btn text-[var(--warning)]" title="Edit"><FileEdit size={14} /></button>
                          <button onClick={() => { setSelectedDoc(row); setIsAlertOpen(true); }} className="action-btn text-[var(--danger)]" title="Delete"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isEmployee ? 6 : 5} className="td text-center py-10 text-[var(--text-muted)]">
                      No {isEmployee ? 'employee' : 'company'} documents found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        <TablePagination
          total={isEmployee ? employeeDocs.length : companyDocs.length}
          filtered={isEmployee ? filteredEmployee.length : filteredCompany.length}
        />
      </div>

      {isFormOpen && isEmployee  && <EmployeeDocumentForm onClose={() => setIsFormOpen(false)} initialData={selectedDoc} onSave={handleSave} />}
      {isFormOpen && !isEmployee && <CompanyDocumentForm  onClose={() => setIsFormOpen(false)} initialData={selectedDoc} onSave={handleSave} />}
      <DocumentViewer document={documentToView} onClose={() => setDocumentToView(null)} allowDownload />
      <ConfirmAlert
        isOpen={isAlertOpen}
        title="Delete Document"
        message="Are you sure you want to delete this document? This action cannot be undone."
        confirmText="Yes, Delete"
        onConfirm={handleDelete}
        onCancel={() => setIsAlertOpen(false)}
        variant="danger"
      />
    </div>
  );
}
