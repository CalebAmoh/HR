import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { motion } from 'motion/react';
import { TableToolbar } from './ui/TableToolbar';
import { TablePagination } from './ui/TablePagination';

const mockReports = [
  { id: 1, name: 'Employee Details Report', description: 'Comprehensive list of all employees and their personal information.' },
  { id: 2, name: 'Payroll Summary', description: 'Overview of salary disbursements, deductions, and net pay across the company.' },
  { id: 3, name: 'Leave Utilization', description: 'Detailed view of leave balances, taken days, and requests for all employees.' },
  { id: 4, name: 'Attendance & Timelog', description: 'Monthly log of employee clock-ins, clock-outs, and total hours worked.' },
  { id: 5, name: 'Department Headcount', description: 'Employee distribution mapped by department and location.' },
];

export function AdminReports() {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = mockReports.filter(
    (r) =>
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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
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
                  filtered.map((row, i) => (
                    <motion.tr key={row.id} className="tr" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }}>
                      <td className="td font-medium text-[var(--text-primary)] w-[30%]">{row.name}</td>
                      <td className="td w-[50%]"><span className="text-[var(--text-muted)] line-clamp-1">{row.description}</span></td>
                      <td className="td text-right">
                        <button className="primary-btn shrink-0" title="Generate Report">
                          <Download size={14} /> <span>Generate</span>
                        </button>
                      </td>
                    </motion.tr>
                  ))
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

          <TablePagination total={mockReports.length} filtered={filtered.length} />
        </motion.div>
      </div>
    </div>
  );
}
