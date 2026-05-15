import { useState } from 'react';
import type { ReactNode } from 'react';
import { Eye, FileEdit, Trash2, ArrowUpDown } from 'lucide-react';
import { PageHeader } from './ui/PageHeader';
import { TabBar } from './ui/TabBar';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';

const mockData = [
  { id: 1, employee: 'SAMUEL BANDOH', type: 'Annual leave', start: '2026-05-07', end: '2026-05-14', status: 'Approved' },
  { id: 2, employee: 'UNION ADMIN', type: 'Annual leave', start: '2026-05-01', end: '2026-05-22', status: 'Pending' },
  { id: 3, employee: 'UNION ADMIN', type: 'Business Leave', start: '2026-02-24', end: '2026-02-27', status: 'Pending' },
  { id: 4, employee: 'UNION ADMIN', type: 'Business Leave', start: '2026-02-24', end: '2026-02-28', status: 'Pending' },
  { id: 5, employee: 'UNION ADMIN', type: 'Casual leave', start: '2026-02-24', end: '2026-02-28', status: 'Pending' },
  { id: 6, employee: 'UNION ADMIN', type: 'Maternity Leave', start: '2026-02-18', end: '2026-02-28', status: 'Pending' },
  { id: 7, employee: 'UNION ADMIN', type: 'Business Leave', start: '2026-02-18', end: '2026-02-28', status: 'Pending' },
  { id: 8, employee: '211', type: 'Annual leave', start: '2022-03-21', end: '2022-04-22', status: 'Pending' },
  { id: 9, employee: '11', type: 'Annual leave', start: '2022-02-07', end: '2022-02-18', status: 'Approved' },
  { id: 10, employee: '231', type: 'Annual leave', start: '2022-02-02', end: '2022-03-03', status: 'Approved' },
  { id: 11, employee: 'UNION ADMIN', type: 'Annual leave', start: '2022-01-26', end: '2022-02-08', status: 'Approved' },
];

const TYPE_COLORS: Record<string, string> = {
  'Annual leave': 'bg-sky-500/10 text-sky-700 border border-sky-200/50',
  'Business Leave': 'bg-amber-500/10 text-amber-700 border border-amber-200/50',
  'Casual leave': 'bg-violet-500/10 text-violet-700 border border-violet-200/50',
  'Maternity Leave': 'bg-rose-500/10 text-rose-700 border border-rose-200/50',
};

const TABS = ['All my Leave', 'Leave Entitlement', 'Approved Leave', 'Pending Leave', 'Subordinate Leave', 'Cancellation Request', 'Approval Request'];

const SortableHeader = ({ children }: { children: ReactNode }) => (
  <th scope="col" className="th">
    <button className="flex items-center gap-1 hover:text-[var(--text-primary)] group">
      {children}
      <ArrowUpDown size={12} className="text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]" />
    </button>
  </th>
);

export function LeaveManagement() {
  const [activeTab, setActiveTab] = useState('All my Leave');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="p-4 sm:p-6 md:p-6 w-full max-w-[1400px] mx-auto overflow-x-hidden flex flex-col h-full">
      <PageHeader title="Leave" subtitle="Manage leave requests and approvals." />

      <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden min-h-[500px] flex flex-col">
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search leaves..."
          searchWidth="sm:w-[280px]"
        />

        <div className="overflow-x-auto flex-1">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <SortableHeader>Employee</SortableHeader>
                <SortableHeader>Leave Type</SortableHeader>
                <SortableHeader>Leave Start Date</SortableHeader>
                <SortableHeader>Leave End Date</SortableHeader>
                <SortableHeader>Status</SortableHeader>
                <th scope="col" className="th text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {mockData.map((row) => (
                <tr key={row.id} className="tr">
                  <td className="td text-[var(--text-primary)] font-medium">{row.employee}</td>
                  <td className="td">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-[6px] text-[11px] font-bold tracking-wide uppercase ${TYPE_COLORS[row.type] || 'bg-[var(--surface-hover)] text-[var(--text-secondary)] border border-[var(--border)]'}`}>
                      {row.type}
                    </span>
                  </td>
                  <td className="td">{row.start}</td>
                  <td className="td">{row.end}</td>
                  <td className="td">
                    {row.status === 'Approved' ? (
                      <span className="pill pill-success">Approved</span>
                    ) : (
                      <span className="pill" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Pending</span>
                    )}
                  </td>
                  <td className="td text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="action-btn text-[var(--success)]" title="View Details"><Eye size={14} /></button>
                      <button className="action-btn text-[var(--warning)]" title="Edit"><FileEdit size={14} /></button>
                      <button className="action-btn text-[var(--danger)]" title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination total={mockData.length} filtered={mockData.length} />
      </div>
    </div>
  );
}
