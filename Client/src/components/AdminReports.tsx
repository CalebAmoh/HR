import { useState, useEffect, type ComponentType } from 'react';
import { Download, FileText, Users, Receipt, Stethoscope, Printer } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';
import { FormModal } from './ui/FormModal';
import { AnimatePresence } from 'motion/react';
import { FormField, inputClass } from './ui/FormField';
import api from '../../lib/api';

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

export function AdminReports() {
  const [searchQuery, setSearchQuery] = useState('');

  // Medical utilisation modal state
  const [medOpen,    setMedOpen]    = useState(false);
  const [medRows,    setMedRows]    = useState<any[]>([]);
  const [medLoading, setMedLoading] = useState(false);

  function openMedicalReport() {
    setMedOpen(true);
    if (medRows.length === 0) {
      setMedLoading(true);
      api.get('/medical/enquiry')
        .then(r => setMedRows(r.data.data ?? []))
        .catch(() => toast.error('Failed to load medical data'))
        .finally(() => setMedLoading(false));
    }
  }

  // Payslip report state
  const [payslipOpen,   setPayslipOpen]   = useState(false);
  const [runs,          setRuns]          = useState<any[]>([]);
  const [runsLoading,   setRunsLoading]   = useState(false);
  const [selectedRun,   setSelectedRun]   = useState('');
  const [downloading,   setDownloading]   = useState(false);
  const [employees,     setEmployees]     = useState<any[]>([]);
  const [empLoading,    setEmpLoading]    = useState(false);
  const [selectedEmp,   setSelectedEmp]   = useState('all');

  function openPayslipReport() {
    setPayslipOpen(true);
    setSelectedRun('');
    setSelectedEmp('all');
    setEmployees([]);
    if (runs.length === 0) {
      setRunsLoading(true);
      api.get('/payroll/runs')
        .then(r => setRuns((r.data.data ?? []).filter((x: any) => x.status === 'Completed' || x.status === 'Approved')))
        .catch(() => toast.error('Failed to load payroll runs'))
        .finally(() => setRunsLoading(false));
    }
  }

  useEffect(() => {
    if (!selectedRun) { setEmployees([]); return; }
    setEmpLoading(true);
    api.get(`/payroll/runs/${selectedRun}/data`)
      .then(r => {
        const rd = r.data.data;
        const data: any[] = Array.isArray(rd) ? rd : (rd?.cells ?? []);
        const seen = new Set<string>();
        const emps: any[] = [];
        data.forEach((row: any) => {
          if (!seen.has(String(row.employee))) {
            seen.add(String(row.employee));
            emps.push({ id: String(row.employee), name: row.emp_name ?? String(row.employee) });
          }
        });
        setEmployees(emps);
      })
      .catch(() => {})
      .finally(() => setEmpLoading(false));
  }, [selectedRun]);

  async function blobErrMessage(e: any): Promise<string> {
    const data = e.response?.data;
    if (data instanceof Blob) {
      try { const j = JSON.parse(await data.text()); return j.message || 'Download failed'; } catch { /* ignore */ }
    }
    return data?.message || e.message || 'Download failed';
  }

  async function downloadPayslipReport() {
    if (!selectedRun) return toast.error('Select a payroll run');
    if (empLoading)   return toast.error('Employees still loading — please wait');
    setDownloading(true);
    try {
      if (selectedEmp === 'all') {
        if (employees.length === 0) return toast.error('No employees found in this run');
        toast.info(`Downloading ${employees.length} payslip${employees.length > 1 ? 's' : ''}…`);
        let ok = 0;
        for (const emp of employees) {
          try {
            const res = await api.get(`/payroll/runs/${selectedRun}/employees/${emp.id}/payslip.pdf`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const a   = document.createElement('a');
            a.href     = url;
            a.download = `payslip-${emp.name.replace(/\s+/g, '-')}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
            ok++;
          } catch { /* skip individual failures silently */ }
        }
        if (ok > 0) toast.success(`${ok} payslip${ok !== 1 ? 's' : ''} downloaded`);
        else toast.error('No payslips could be downloaded for this run');
      } else {
        const res = await api.get(`/payroll/runs/${selectedRun}/employees/${selectedEmp}/payslip.pdf`, { responseType: 'blob' });
        const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
        const emp = employees.find(e => e.id === selectedEmp);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `payslip-${emp?.name?.replace(/\s+/g, '-') ?? selectedEmp}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Payslip downloaded');
      }
    } catch (e: any) {
      toast.error(await blobErrMessage(e));
    } finally {
      setDownloading(false);
    }
  }

  const reports: Report[] = [
    {
      id: 1,
      name: 'Employee Details Report',
      description: 'Comprehensive list of all employees and their personal information.',
      icon: Users,
    },
    {
      id: 2,
      name: 'Payroll Summary',
      description: 'Overview of salary disbursements, deductions, and net pay across the company.',
      icon: FileText,
    },
    {
      id: 3,
      name: 'Payslip Report',
      description: 'Download individual or all employee payslips for any completed payroll run.',
      icon: Receipt,
      action: openPayslipReport,
      actionLabel: 'Generate',
    },
    {
      id: 4,
      name: 'Leave Utilization',
      description: 'Detailed view of leave balances, taken days, and requests for all employees.',
      icon: FileText,
    },
    {
      id: 5,
      name: 'Department Headcount',
      description: 'Employee distribution mapped by department and location.',
      icon: Users,
    },
    {
      id: 6,
      name: 'Medical Utilisation Report',
      description: 'View medical limit balances and utilisation for all employees by pay grade.',
      icon: Stethoscope,
      action: openMedicalReport,
      actionLabel: 'View Report',
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
            <FileText className="text-[var(--accent)]" size={28} />
            Admin Reports
          </h1>
          <p className="text-[13px] text-[var(--text-muted)] mt-1.5">Generate and view company-wide reports for all employees.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden flex flex-col flex-1 max-h-min drop-shadow-sm"
        >
          <TableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search admin reports..."
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
                      <motion.tr key={row.id} className="tr" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                        <td className="td font-medium text-[var(--text-primary)] w-[30%]">
                          <div className="flex items-center gap-2">
                            <Icon size={15} className="text-[var(--accent)] shrink-0" />
                            {row.name}
                          </div>
                        </td>
                        <td className="td w-[50%]"><span className="text-[var(--text-muted)] line-clamp-1">{row.description}</span></td>
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

      {/* Medical Utilisation modal */}
      <AnimatePresence>
        {medOpen && (
          <FormModal title="Medical Utilisation Report" subtitle="Medical limit balances per employee"
            maxWidth="4xl" onClose={() => setMedOpen(false)} onSave={() => setMedOpen(false)} saveLabel="Close">
            {medLoading ? (
              <p className="text-center text-[var(--text-muted)] text-sm py-8">Loading…</p>
            ) : medRows.length === 0 ? (
              <p className="text-center text-[var(--text-muted)] text-sm py-8">No medical data found.</p>
            ) : (() => {
              const medHeaders = ['Employee', 'Grade', 'Medical Limit', 'Amount Utilised', 'Remaining Balance'];
              const medCsvRows = medRows.map((r: any) => [
                r.employee_name ?? '', r.grade ?? '',
                r.medical_limit ?? '', r.amount_utilized ?? '', r.limit_balance ?? '',
              ]);
              return (
                <>
                  <div className="flex justify-end gap-2 mb-3">
                    <button onClick={() => printTable('Medical Utilisation Report', medHeaders, medCsvRows)}
                      className="secondary-btn !py-1.5 !px-3 !text-[12px]">
                      <Printer size={13} />Print
                    </button>
                    <button onClick={() => exportCSV('medical-utilisation-report', medHeaders, medCsvRows)}
                      className="secondary-btn !py-1.5 !px-3 !text-[12px]">
                      <Download size={13} />Export CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-[10px] border border-[var(--border)]">
                    <table className="w-full border-collapse text-sm">
                      <thead><tr>
                        <th className="th">Employee</th><th className="th">Grade</th>
                        <th className="th">Medical Limit</th><th className="th">Amount Utilised</th>
                        <th className="th">Remaining Balance</th>
                      </tr></thead>
                      <tbody>{medRows.map((row: any, i: number) => (
                        <tr key={i} className="tr">
                          <td className="td font-medium">{row.employee_name}</td>
                          <td className="td">{row.grade}</td>
                          <td className="td">{row.medical_limit}</td>
                          <td className="td">{row.amount_utilized}</td>
                          <td className="td">{row.limit_balance}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </FormModal>
        )}
      </AnimatePresence>

      {/* Payslip Report modal */}
      <AnimatePresence>
        {payslipOpen && (
          <FormModal
            title="Payslip Report"
            subtitle="Download payslips for a completed payroll run"
            maxWidth="md"
            onClose={() => setPayslipOpen(false)}
            onSave={downloadPayslipReport}
            saveLabel={downloading ? 'Downloading…' : empLoading ? 'Loading…' : 'Download PDF(s)'}
          >
            <div className="space-y-4">
              <FormField label="Payroll Run" required>
                <select
                  className={inputClass}
                  value={selectedRun}
                  onChange={e => { setSelectedRun(e.target.value); setSelectedEmp('all'); }}
                  disabled={runsLoading}
                >
                  <option value="">{runsLoading ? 'Loading runs…' : 'Select a completed run…'}</option>
                  {runs.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.status})</option>
                  ))}
                </select>
              </FormField>

              {selectedRun && (
                <FormField label="Employee">
                  <select
                    className={inputClass}
                    value={selectedEmp}
                    onChange={e => setSelectedEmp(e.target.value)}
                    disabled={empLoading}
                  >
                    <option value="all">{empLoading ? 'Loading…' : `All employees (${employees.length})`}</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </FormField>
              )}

              {selectedRun && selectedEmp === 'all' && employees.length > 0 && (
                <p className="text-[12px] text-[var(--text-muted)]">
                  This will download {employees.length} separate PDF file{employees.length !== 1 ? 's' : ''}, one per employee.
                </p>
              )}
            </div>
          </FormModal>
        )}
      </AnimatePresence>
    </div>
  );
}
