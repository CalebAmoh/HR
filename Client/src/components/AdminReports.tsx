import { useState, useEffect, type ComponentType } from 'react';
import { Download, FileText, Users, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';
import { FormModal } from './ui/FormModal';
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

export function AdminReports() {
  const [searchQuery, setSearchQuery] = useState('');

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
        const data: any[] = r.data.data ?? [];
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

  async function downloadPayslipReport() {
    if (!selectedRun) return toast.error('Select a payroll run');
    setDownloading(true);
    try {
      if (selectedEmp === 'all') {
        // Download all payslips as sequential requests; browsers will trigger multiple downloads
        if (employees.length === 0) return toast.error('No employees in this run');
        toast.info(`Downloading ${employees.length} payslip${employees.length > 1 ? 's' : ''}…`);
        for (const emp of employees) {
          try {
            const res = await api.get(`/payroll/runs/${selectedRun}/employees/${emp.id}/payslip.pdf`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
            const a   = document.createElement('a');
            a.href     = url;
            a.download = `payslip-${emp.name.replace(/\s+/g, '-')}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
          } catch { /* skip individual failures */ }
        }
        toast.success('All payslips downloaded');
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
      toast.error(e.response?.data?.message || 'Download failed');
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

      {/* Payslip Report modal */}
      <AnimatePresence>
        {payslipOpen && (
          <FormModal
            title="Payslip Report"
            subtitle="Download payslips for a completed payroll run"
            maxWidth="md"
            onClose={() => setPayslipOpen(false)}
            onSave={downloadPayslipReport}
            saveLabel={downloading ? 'Downloading…' : 'Download PDF(s)'}
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
