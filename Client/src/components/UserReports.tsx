import { useState, useEffect, type ComponentType } from 'react';
import { Download, FileSpreadsheet, FileText, Receipt, X, Stethoscope, Printer } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';
import { FormModal } from './ui/FormModal';
import { AnimatePresence } from 'motion/react';
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

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: `${filename}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

function printTable(title: string, headers: string[], rows: (string | number)[][]) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!DOCTYPE html><html><head><title>${esc(title)}</title>
    <style>body{font-family:sans-serif;padding:20px}h2{margin-bottom:16px}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px 12px;font-size:13px}
    th{background:#f3f4f6;font-weight:600;text-align:left}tr:nth-child(even){background:#f9fafb}
    @media print{button{display:none}}</style></head><body>
    <h2>${esc(title)}</h2><table>
    <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(String(c ?? ''))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.print();
}

export function UserReports() {
  const [searchQuery, setSearchQuery] = useState('');

  // Medical statement modal state
  const [medOpen,    setMedOpen]    = useState(false);
  const [medData,    setMedData]    = useState<any>(null);
  const [medLoading, setMedLoading] = useState(false);

  function openMedStatement() {
    setMedOpen(true);
    if (!medData && !medLoading) {
      setMedLoading(true);
      api.get('/medical/my-enquiry')
        .then(r => setMedData(r.data.data ?? null))
        .catch(() => {})
        .finally(() => setMedLoading(false));
    }
  }

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
    {
      id: 5,
      name: 'My Medical Statement',
      description: 'View your medical limit, amount utilised, remaining balance, and full records history.',
      icon: Stethoscope,
      action: openMedStatement,
      actionLabel: 'View Statement',
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

      {/* My Medical Statement modal */}
      <AnimatePresence>
        {medOpen && (
          <FormModal title="My Medical Statement" subtitle="Medical limit balance and records history"
            maxWidth="3xl" onClose={() => setMedOpen(false)} onSave={() => setMedOpen(false)} saveLabel="Close">
            {medLoading ? (
              <p className="text-center text-[var(--text-muted)] text-sm py-8">Loading…</p>
            ) : !medData ? (
              <p className="text-center text-[var(--text-muted)] text-sm py-8">No employee record linked to your account.</p>
            ) : (() => {
              const fmt = (v: any) => v != null ? parseFloat(String(v)).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—';
              const cur = medData.currency ?? '';
              return (
                <div className="space-y-5">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Medical Limit',     value: medData.medical_limit    != null ? `${cur} ${fmt(medData.medical_limit)}`    : '—' },
                      { label: 'Amount Utilised',   value: `${cur} ${fmt(medData.amount_utilized)}` },
                      { label: 'Remaining Balance', value: medData.limit_balance    != null ? `${cur} ${fmt(medData.limit_balance)}`   : '—' },
                    ].map(c => (
                      <div key={c.label} className="rounded-[12px] border border-[var(--border)] px-4 py-3 bg-[var(--bg)]">
                        <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">{c.label}</p>
                        <p className="text-[16px] font-extrabold syne text-[var(--text-primary)]">{c.value}</p>
                      </div>
                    ))}
                  </div>
                  {(medData.staff_records?.length > 0 || medData.dependent_records?.length > 0) ? (() => {
                    const recHeaders = ['Type', 'Date', 'Illness', 'Cost', 'Status'];
                    const staffRows  = (medData.staff_records ?? []).map((r: any) => ['Staff', r.admission_date?.slice(0,10) ?? '', r.illness_type ?? '', fmt(r.cost), r.status ?? '']);
                    const depRows    = (medData.dependent_records ?? []).map((r: any) => ['Dependent', r.date_attended?.slice(0,10) ?? '', r.illness_type ?? '', fmt(r.cost), r.status ?? '']);
                    const allRecRows = [...staffRows, ...depRows];
                    return (
                      <>
                        <div className="flex justify-end gap-2 mb-2">
                          <button onClick={() => printTable('My Medical Statement', recHeaders, allRecRows)}
                            className="secondary-btn !py-1.5 !px-3 !text-[12px]">
                            <Printer size={13} />Print
                          </button>
                          <button onClick={() => exportCSV('my-medical-statement', recHeaders, allRecRows)}
                            className="secondary-btn !py-1.5 !px-3 !text-[12px]">
                            <Download size={13} />Export CSV
                          </button>
                        </div>
                        <div className="overflow-x-auto rounded-[10px] border border-[var(--border)]">
                          <table className="w-full border-collapse text-sm">
                            <thead><tr>
                              <th className="th">Type</th><th className="th">Date</th>
                              <th className="th">Illness</th><th className="th">Cost</th><th className="th">Status</th>
                            </tr></thead>
                            <tbody>
                              {(medData.staff_records ?? []).map((r: any, i: number) => (
                                <tr key={`s${i}`} className="tr">
                                  <td className="td"><span className="pill pill-accent text-[10px]">Staff</span></td>
                                  <td className="td">{r.admission_date?.slice(0,10)}</td>
                                  <td className="td">{r.illness_type}</td>
                                  <td className="td">{fmt(r.cost)}</td>
                                  <td className="td"><span className={`pill text-[11px] ${r.status === 'Approved' ? 'pill-success' : r.status === 'Rejected' ? 'pill-danger' : r.status === 'Pending Approval' ? 'pill-warning' : ''}`}>{r.status}</span></td>
                                </tr>
                              ))}
                              {(medData.dependent_records ?? []).map((r: any, i: number) => (
                                <tr key={`d${i}`} className="tr">
                                  <td className="td"><span className="pill text-[10px]">Dependent</span></td>
                                  <td className="td">{r.date_attended?.slice(0,10)}</td>
                                  <td className="td">{r.illness_type}</td>
                                  <td className="td">{fmt(r.cost)}</td>
                                  <td className="td"><span className={`pill text-[11px] ${r.status === 'Approved' ? 'pill-success' : r.status === 'Rejected' ? 'pill-danger' : r.status === 'Pending Approval' ? 'pill-warning' : ''}`}>{r.status}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })() : (
                    <p className="text-center text-[var(--text-muted)] text-sm py-4">No records on file.</p>
                  )}
                </div>
              );
            })()}
          </FormModal>
        )}
      </AnimatePresence>

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
