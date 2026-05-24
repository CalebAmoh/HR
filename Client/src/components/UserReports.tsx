import { useState, useEffect, type ComponentType } from 'react';
import { Download, FileSpreadsheet, FileText, Receipt, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';
import { FormModal } from './ui/FormModal';
import api from '../../lib/api';

interface PayslipRun {
  run_id: string;
  name: string;
  date_start: string | null;
  date_end: string | null;
  status: string;
  freq_name: string | null;
}

interface Report {
  id: number;
  name: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  action?: () => void;
  actionLabel?: string;
}

export function UserReports() {
  const [searchQuery, setSearchQuery] = useState('');

  // Payslip modal state
  const [payslipOpen,   setPayslipOpen]   = useState(false);
  const [payslipRuns,   setPayslipRuns]   = useState<PayslipRun[]>([]);
  const [empId,         setEmpId]         = useState<string | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [downloading,   setDownloading]   = useState<string | null>(null);
  const [runSearch,     setRunSearch]     = useState('');

  function openPayslips() {
    setPayslipOpen(true);
    setRunSearch('');
    if (payslipRuns.length === 0 && !loading) {
      setLoading(true);
      api.get('/payroll/my-payslips')
        .then(res => {
          const d = res.data.data ?? {};
          setEmpId(d.employeeId ?? null);
          setPayslipRuns(d.runs ?? []);
        })
        .catch(() => { /* user may not have an employee record */ })
        .finally(() => setLoading(false));
    }
  }

  async function downloadPayslip(run: PayslipRun) {
    if (!empId) return;
    setDownloading(run.run_id);
    try {
      const res = await api.get(`/payroll/runs/${run.run_id}/employees/${empId}/payslip.pdf`, {
        responseType: 'blob',
      });
      const url  = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href     = url;
      link.download = `payslip-${run.name.replace(/\s+/g, '-')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Payslip downloaded');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Download failed');
    } finally {
      setDownloading(null);
    }
  }

  const filteredRuns = payslipRuns.filter(r =>
    r.name.toLowerCase().includes(runSearch.toLowerCase()) ||
    (r.freq_name ?? '').toLowerCase().includes(runSearch.toLowerCase())
  );

  const reports: Report[] = [
    {
      id: 1,
      name: 'My Payslips',
      description: 'Download your payslips for completed payroll runs.',
      icon: Receipt,
      action: openPayslips,
      actionLabel: 'View Payslips',
    },
    {
      id: 2,
      name: 'My Personal Info Summary',
      description: 'Export a summary of your profile and demographic details.',
      icon: FileSpreadsheet,
    },
    {
      id: 3,
      name: 'My Leave Statement',
      description: 'Get a statement of all your past leave requests and remaining balances.',
      icon: FileText,
    },
    {
      id: 4,
      name: 'My Tax Documents',
      description: 'End-of-year tax summary documents and declarations.',
      icon: FileText,
    },
  ];

  const filtered = reports.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 w-full relative h-full flex flex-col">
      <div className="max-w-[1300px] w-full mx-auto px-6 py-8 flex-1 flex flex-col">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
          <h1 className="syne text-[26px] font-extrabold text-[var(--text-primary)] m-0 flex items-center gap-2">
            <FileSpreadsheet className="text-[var(--accent)]" size={28} />
            My Reports
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1.5">Generate and download your personal employment records.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col flex-1 max-h-min drop-shadow-sm"
        >
          <TableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search reports..."
            searchWidth="sm:min-w-[300px]"
          />

          <div className="overflow-x-auto flex-1">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className="th">Report Name</th>
                  <th scope="col" className="th">Description</th>
                  <th scope="col" className="th text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((row, i) => {
                    const Icon = row.icon;
                    return (
                      <motion.tr
                        key={row.id}
                        className="tr"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.06 }}
                      >
                        <td className="td font-medium text-[var(--text-primary)] w-[30%]">
                          <div className="flex items-center gap-2">
                            <Icon size={15} className="text-[var(--accent)] shrink-0" />
                            {row.name}
                          </div>
                        </td>
                        <td className="td w-[50%]">
                          <span className="text-[var(--text-muted)] line-clamp-1">{row.description}</span>
                        </td>
                        <td className="td text-right">
                          <button
                            className="primary-btn shrink-0"
                            onClick={row.action}
                            disabled={!row.action}
                            title={!row.action ? 'Coming soon' : undefined}
                          >
                            <Download size={14} />
                            <span>{row.actionLabel ?? 'Generate'}</span>
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={3} className="td text-center py-10">
                      <p className="text-[var(--text-muted)] text-[13px]">No reports found matching your search.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <TablePagination total={reports.length} filtered={filtered.length} />
        </motion.div>
      </div>

      {/* My Payslips modal */}
      <AnimatePresence>
        {payslipOpen && (
          <FormModal
            title="My Payslips"
            subtitle="Download your payslips for completed payroll runs"
            maxWidth="3xl"
            onClose={() => setPayslipOpen(false)}
            onSave={() => setPayslipOpen(false)}
            saveLabel="Close"
          >
            {/* inner search */}
            <div className="mb-4">
              <div className="search-wrap w-full">
                <FileText size={13} />
                <input
                  type="text"
                  placeholder="Filter payroll runs…"
                  value={runSearch}
                  onChange={e => setRunSearch(e.target.value)}
                />
                {runSearch && (
                  <button onClick={() => setRunSearch('')} className="ml-auto text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <p className="text-center text-[var(--text-muted)] text-sm py-8">Loading payslips…</p>
            ) : !empId ? (
              <p className="text-center text-[var(--text-muted)] text-sm py-8">No employee record is linked to your account.</p>
            ) : filteredRuns.length === 0 ? (
              <p className="text-center text-[var(--text-muted)] text-sm py-8">
                {payslipRuns.length === 0 ? 'No completed payslips available yet.' : 'No runs match your search.'}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-[10px] border border-[var(--border)]">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="th text-left">Payroll Run</th>
                      <th className="th text-left">Period</th>
                      <th className="th text-left">Frequency</th>
                      <th className="th text-left">Status</th>
                      <th className="th text-right">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRuns.map((run, ri) => (
                      <motion.tr
                        key={run.run_id}
                        className="tr"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: ri * 0.04 }}
                      >
                        <td className="td font-medium text-[var(--text-primary)]">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-[var(--accent)] shrink-0" />
                            {run.name}
                          </div>
                        </td>
                        <td className="td text-[var(--text-muted)] text-[12px]">
                          {run.date_start
                            ? `${run.date_start.slice(0, 10)}${run.date_end ? ` → ${run.date_end.slice(0, 10)}` : ''}`
                            : '—'}
                        </td>
                        <td className="td text-[var(--text-muted)]">{run.freq_name ?? '—'}</td>
                        <td className="td">
                          <span className={`pill text-[11px] ${run.status === 'Completed' ? 'pill-success' : 'pill-accent'}`}>
                            {run.status}
                          </span>
                        </td>
                        <td className="td text-right">
                          <button
                            className="primary-btn !py-1.5 !px-3 !text-xs"
                            onClick={() => downloadPayslip(run)}
                            disabled={downloading === run.run_id}
                          >
                            {downloading === run.run_id
                              ? <span>Downloading…</span>
                              : <><Download size={13} /><span>PDF</span></>
                            }
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FormModal>
        )}
      </AnimatePresence>
    </div>
  );
}
