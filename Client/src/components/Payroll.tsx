import { useState } from 'react';
import { Search, Plus, Edit, Trash2, Filter, FileText, Eye, CheckCircle, TrendingUp, Users, DollarSign, ArrowLeft, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MultiSelect } from './MultiSelect';
import { FormModal } from './ui/FormModal';
import { TabBar } from './ui/TabBar';
import { TableToolbar } from './ui/TableToolbar';

const AVATAR_COLORS = [
  { bg: '#1a2d4a', color: '#4f8ef7' },
  { bg: '#2a1a4a', color: '#a78bfa' },
  { bg: '#1a3a2a', color: '#34d399' },
  { bg: '#3a2a1a', color: '#fbbf24' },
  { bg: '#3a1a1a', color: '#f87171' },
];

const getAvatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const TABS = ['Payroll Employees', 'Payroll Reports', 'Payroll Columns', 'Calculation Groups', 'Saved Calculations', 'Payslip Templates'];

const reports = [
  { name: 'Rent Allowance — January 2022', freq: 'Yearly', dept: 'Head Office', type: 'Rent Allowance', period: 'JAN-2022', ref: 'pq1641350214' },
  { name: 'JAN 2022 Rice Subsidy — Permanent', freq: 'Semi Monthly', dept: 'Head Office', type: 'Rice Subsidy', period: 'JAN-2022', ref: 'cb1642172217' },
  { name: 'January 2022 Salary — Permanent Staff', freq: 'Monthly', dept: 'Head Office', type: 'Salary', period: 'JAN-2022', ref: 'ap1643021200' },
];

const employees = [
  { initials: 'JD', name: 'John Doe', salary: '$5,000.00', deductions: '-$1,000.00', net: '$4,000.00' },
  { initials: 'JS', name: 'Jane Smith', salary: '$6,200.00', deductions: '-$1,240.00', net: '$4,960.00' },
  { initials: 'MT', name: 'Michael Thompson', salary: '$4,500.00', deductions: '-$900.00', net: '$3,600.00' },
];

export function Payroll() {
  const [activeTab, setActiveTab] = useState('Payroll Reports');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewingReport, setViewingReport] = useState<string | null>(null);
  const [reportSearch, setReportSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const renderModalContent = () => {
    if (activeTab === 'Payroll Employees') return (
      <>
        <div className="mb-[18px]"><label className="label">Employee</label><MultiSelect options={['John Doe', 'Jane Smith', 'Michael Thompson', 'Sarah Williams', 'David Chen']} placeholder="Select employees" /></div>
        <div className="mb-[18px]"><label className="label">Pay Frequency</label><select><option value="">Select Frequency</option><option>Monthly</option><option>Semi Monthly</option><option>Weekly</option><option>Yearly</option></select></div>
        <div className="mb-[18px]"><label className="label">Currency</label><div className="search-wrap"><Search size={15} /><input type="text" placeholder="Search Currency..." /></div></div>
        <div className="mb-[18px]"><label className="label">Calculation Group</label><select><option value="">Select Group</option><option>Standard Tax Group</option><option>Contractor Exempt Group</option></select></div>
        <div className="mb-px"><label className="label">Calculation Exemptions</label><MultiSelect options={['Tax', 'Health Insurance', 'Pension', 'Union Dues']} placeholder="Select exemptions" /></div>
      </>
    );
    if (activeTab === 'Payroll Reports') return (
      <>
        <div className="mb-[18px]"><label className="label">Report Name</label><input type="text" placeholder="Enter report name..." /></div>
        <div className="grid grid-cols-2 gap-[14px] mb-[18px]">
          <div><label className="label">Pay Frequency</label><select><option value="">Select Frequency</option><option>Monthly</option><option>Semi Monthly</option><option>Weekly</option><option>Yearly</option></select></div>
          <div><label className="label">Payment Type</label><select><option value="">Select Type</option><option>Salary</option><option>Rice Subsidy</option><option>Rent Allowance</option></select></div>
        </div>
        <div className="mb-[18px]"><label className="label">Calculation Group</label><select><option value="">Select Group</option><option>Standard Tax Group</option><option>Contractor Exempt Group</option></select></div>
        <div className="mb-[18px]"><label className="label">Payslip Template</label><select><option value="">Select Template</option><option>Standard</option><option>Detailed</option></select></div>
        <div className="grid grid-cols-2 gap-[14px] mb-[18px]">
          <div><label className="label">Start Date</label><input type="date" /></div>
          <div><label className="label">End Date</label><input type="date" /></div>
        </div>
        <div className="mb-[4px]"><label className="label">Payroll Columns</label><MultiSelect options={['Basic Salary', 'Tax', 'Benefits', 'Net Pay', 'Deductions', 'Gross Pay', 'Overtime']} placeholder="Select columns" /></div>
      </>
    );
    return <div className="p-8 text-center text-[var(--text-muted)] text-[13px]">Form for {activeTab} coming soon.</div>;
  };

  const filteredReportEmployees = employees.filter((emp) => emp.name.toLowerCase().includes(reportSearch.toLowerCase()));

  const renderReportView = () => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="mb-7">
        <button onClick={() => setViewingReport(null)} className="text-[var(--accent)] text-[13px] font-semibold flex items-center gap-1.5 mb-3 bg-transparent border-none cursor-pointer dm-sans hover:underline">
          <ArrowLeft size={15} /> Back to Reports
        </button>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="syne text-[22px] font-extrabold text-[var(--text-primary)] m-0">{viewingReport}</h2>
            <p className="text-[13px] text-[var(--text-muted)] mt-1">Review employee salaries and process payroll</p>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            <button className="secondary-btn"><FileText size={14} /> Export</button>
            <button className="success-btn"><CheckCircle size={14} /> Process Payroll</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-[14px] mb-6">
        {[
          { icon: <DollarSign size={16} />, label: 'Total Payroll', value: '$12,560', color: 'text-[var(--accent)]', bg: 'bg-[var(--accent-dim)]' },
          { icon: <TrendingUp size={16} />, label: 'Total Net Pay', value: '$9,420', color: 'text-[var(--success)]', bg: 'bg-[var(--success-dim)]' },
          { icon: <TrendingUp size={16} />, label: 'Total Deductions', value: '$3,140', color: 'text-[var(--danger)]', bg: 'bg-[var(--danger-dim)]' },
          { icon: <Users size={16} />, label: 'Employees', value: '3 / 3', color: 'text-[var(--purple)]', bg: 'bg-[var(--purple-dim)]' },
        ].map((s, i) => (
          <motion.div key={i} className="stat-card relative overflow-hidden" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <div className="flex items-center gap-2 mb-2.5">
              <div className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center ${s.bg} ${s.color}`}>{s.icon}</div>
              <span className="text-[11px] font-bold text-[var(--text-muted)] tracking-[0.06em] uppercase syne">{s.label}</span>
            </div>
            <div className={`syne text-[26px] font-extrabold ${s.color}`}>{s.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[14px] overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between gap-3">
          <h3 className="syne text-[14px] font-bold text-[var(--text-primary)] m-0">Employee Breakdown</h3>
          <div className="search-wrap w-[220px]">
            <Search size={14} />
            <input type="text" placeholder="Search employees..." value={reportSearch} onChange={(e) => setReportSearch(e.target.value)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {['Employee', 'Basic Salary', 'Tax & Deductions', 'Net Pay', 'Status'].map((h, i) => (
                  <th key={h} className={`th ${i === 0 ? 'text-left' : i === 4 ? 'text-center' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredReportEmployees.length > 0 ? filteredReportEmployees.map((emp, i) => {
                const av = getAvatarColor(emp.name);
                return (
                  <motion.tr key={i} className="tr" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <div className="avatar" style={{ background: av.bg, color: av.color }}>{emp.initials}</div>
                        <span className="text-[var(--text-primary)] font-medium text-[13px]">{emp.name}</span>
                      </div>
                    </td>
                    <td className="td text-right">{emp.salary}</td>
                    <td className="td text-right text-[var(--danger)]">{emp.deductions}</td>
                    <td className="td text-right text-[var(--success)] font-bold text-[14px]">{emp.net}</td>
                    <td className="td text-center"><span className="pill pill-success">Ready</span></td>
                  </motion.tr>
                );
              }) : (
                <tr><td colSpan={5} className="td text-center py-8 text-slate-500">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="flex-1 w-full relative">
      <div className="max-w-[1300px] mx-auto px-6 py-8">
        {!viewingReport && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-7">
            <h1 className="syne text-[26px] font-extrabold text-[var(--text-primary)] m-0">Payroll Processing</h1>
            <p className="text-[13px] text-[var(--text-muted)] mt-1.5">Manage employees, reports, and calculations from one place.</p>
          </motion.div>
        )}

        {viewingReport ? renderReportView() : (
          <>
            <TabBar tabs={TABS} activeTab={activeTab} onChange={setActiveTab} className="flex flex-wrap gap-1 mb-5" />

            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[16px] overflow-hidden">
              <TableToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search reports..."
                searchWidth="w-[240px]"
                actions={
                  <>
                    <button className="primary-btn" onClick={() => setIsModalOpen(true)}><Plus size={15} /> Add New</button>
                    <button className="secondary-btn"><Filter size={14} /> Filter</button>
                  </>
                }
              />

              <div className="overflow-x-auto">
                {activeTab === 'Payroll Reports' ? (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {['Name', 'Pay Frequency', 'Department', 'Payment Type', 'Pay Period', 'Status', 'Reference', ''].map((h, i) => (
                          <th key={i} className={`th ${i === 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r, i) => (
                        <motion.tr key={i} className="tr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                          <td className="td text-[var(--text-primary)] font-medium">{r.name}</td>
                          <td className="td"><span className="pill pill-accent">{r.freq}</span></td>
                          <td className="td">{r.dept}</td>
                          <td className="td">{r.type}</td>
                          <td className="td">{r.period}</td>
                          <td className="td"><span className="pill pill-success">Completed</span></td>
                          <td className="td"><span className="font-mono text-[11px] text-[var(--text-muted)] bg-[var(--bg)] px-2 py-0.5 rounded border border-[var(--border)]">{r.ref}</span></td>
                          <td className="td text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button className="action-btn text-[var(--warning)]"><Edit size={14} /></button>
                              <button className="action-btn text-[var(--success)]" onClick={() => setViewingReport(r.name)}><Eye size={14} /></button>
                              <button className="action-btn text-[var(--danger)]"><Trash2 size={14} /></button>
                              <button className="action-btn text-[var(--text-muted)]"><MoreHorizontal size={14} /></button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-12 text-center text-[var(--text-muted)] text-[13px]">No data available for {activeTab}</div>
                )}
              </div>

              {/* Pagination — kept custom as it has multi-page buttons */}
              <div className="px-5 py-[14px] border-t border-[var(--border)] flex items-center justify-between flex-wrap gap-3">
                <span className="text-[12px] text-[var(--text-muted)]">Showing <b className="text-[var(--text-secondary)]">1–15</b> of <b className="text-[var(--text-secondary)]">177</b> entries</span>
                <div className="flex gap-1.5">
                  {['← First', '1', '2', '3', '4', '5', 'Last →'].map((p, i) => (
                    <button key={p} className={`px-3 py-[5px] rounded-lg text-[12px] font-bold cursor-pointer dm-sans transition-all duration-150 ${i === 1 ? 'border border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--accent)]' : 'border border-[var(--border)] bg-transparent text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]'}`}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        <AnimatePresence>
          {isModalOpen && (
            <FormModal
              title={`Add New ${activeTab}`}
              onClose={() => setIsModalOpen(false)}
              onSave={() => setIsModalOpen(false)}
            >
              {renderModalContent()}
            </FormModal>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
